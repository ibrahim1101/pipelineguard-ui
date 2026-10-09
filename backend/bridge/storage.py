"""Local-first persistence that reuses the engine desktop's data directory."""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

HISTORY_LIMIT = 25  # Same retention as pipelineguard.desktop.save_history
ACTIVITY_LIMIT = 100
_lock = Lock()


def data_dir() -> Path:
    configured = os.environ.get("PIPELINEGUARD_DATA_DIR")
    return Path(configured) if configured else Path(os.environ.get("APPDATA", Path.home())) / "PipelineGuard"


def history_file() -> Path:
    return data_dir() / "history.json"


def scans_dir() -> Path:
    return data_dir() / "scans"


def default_reports_dir() -> Path:
    return data_dir() / "reports"


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
    except (OSError, json.JSONDecodeError):
        return default


def _atomic_write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def read_history() -> list[dict]:
    data = _read_json(history_file(), [])
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def append_history(entry: dict) -> None:
    with _lock:
        history = (read_history() + [entry])[-HISTORY_LIMIT:]
        _atomic_write(history_file(), history)
        keep = {item.get("scan_id") for item in history}
        for snap in scans_dir().glob("*.json") if scans_dir().exists() else []:
            if snap.stem not in keep:
                snap.unlink(missing_ok=True)


def update_history_entry(scan_id: str, **changes) -> None:
    with _lock:
        history = read_history()
        for item in history:
            if item.get("scan_id") == scan_id:
                for key, value in changes.items():
                    if isinstance(item.get(key), list) and isinstance(value, list):
                        item[key] = sorted(set(item[key]) | set(value))
                    else:
                        item[key] = value
        _atomic_write(history_file(), history)


def clear_history() -> None:
    with _lock:
        history_file().unlink(missing_ok=True)
        if scans_dir().exists():
            for snap in scans_dir().glob("*.json"):
                snap.unlink(missing_ok=True)


def save_snapshot(scan_id: str, report: dict, meta: dict) -> None:
    _atomic_write(scans_dir() / f"{scan_id}.json", {"report": report, "meta": meta})


def load_snapshot(scan_id: str) -> dict | None:
    if not scan_id.replace("-", "").isalnum():
        return None
    data = _read_json(scans_dir() / f"{scan_id}.json", None)
    if not isinstance(data, dict) or not isinstance(data.get("report"), dict):
        return None
    return data


def read_activity() -> list[dict]:
    data = _read_json(data_dir() / "activity.json", [])
    return data if isinstance(data, list) else []


def record_activity(kind: str, message: str, **extra) -> None:
    with _lock:
        events = read_activity()
        events.append({"kind": kind, "message": message,
                       "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"), **extra})
        _atomic_write(data_dir() / "activity.json", events[-ACTIVITY_LIMIT:])


def read_preferences() -> dict:
    data = _read_json(data_dir() / "ui-preferences.json", {})
    return data if isinstance(data, dict) else {}


def write_preferences(prefs: dict) -> None:
    _atomic_write(data_dir() / "ui-preferences.json", prefs)


def read_engine_desktop_preferences() -> dict:
    """The Tk desktop stores last_project/last_config here; read-only for us."""
    data = _read_json(data_dir() / "preferences.json", {})
    return data if isinstance(data, dict) else {}
