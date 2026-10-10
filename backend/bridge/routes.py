"""HTTP routes for the PipelineGuard UI. Every route is local-only data access."""
from __future__ import annotations

import json
import os
import string
import tempfile
import urllib.request
from dataclasses import asdict, fields
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

import pipelineguard
from pipelineguard.baseline import compare_baseline, finding_key, snapshot as baseline_snapshot
from pipelineguard.config import PipelineGuardConfig, load_config
from pipelineguard.profiles import PROFILES
from pipelineguard.reporting import write_html_report, write_json_report, write_sarif_report
from scanners.dependency_scanner import DEPENDENCY_FILES
from scanners.osv_scanner import query_osv

from bridge import storage
from bridge.evidence import masked_context
from bridge.models import EngineConfigWrite, EvidenceRequest, ExportRequest, OsvQuery, ScanRequest, Settings
from bridge.presenter import present_finding, present_scan
from bridge.scan_manager import manager

APP_VERSION = "2.0.0-dev"
REPORT_EXT = {"html": ".html", "json": ".json", "sarif": ".sarif"}
WRITERS = {"html": write_html_report, "json": write_json_report, "sarif": write_sarif_report}
router = APIRouter(prefix="/api")


def _bad(message: str, code: int = 400):
    raise HTTPException(status_code=code, detail=message)


def _snapshot_or_404(scan_id: str) -> dict:
    snap = storage.load_snapshot(scan_id)
    if snap is None:
        _bad("Scan not found in local history", 404)
    return snap


def _profile_info(p) -> dict:
    notes = [f"{p.workers} fingerprint workers"]
    notes.append("Online OSV lookup allowed" if p.online_intelligence else "Online OSV lookup disabled by profile")
    notes.append("Incremental fingerprinting" if p.incremental else "No fingerprinting (full scan)")
    notes.append("Content-verified secret cache" if p.name in {"quick", "standard", "deep"} else "Full secret scan, no cache")
    if p.git_context:
        notes.append("Git context (credential-redacted)")
    return {"name": p.name, "workers": p.workers, "online_intelligence": p.online_intelligence,
            "incremental": p.incremental, "git_context": p.git_context,
            "secret_cache": p.name in {"quick", "standard", "deep"},
            "declared_flags": {"deep_analysis": p.deep_analysis, "history_secrets": p.history_secrets},
            "notes": notes}


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/status")
def status():
    return {"app_version": APP_VERSION, "engine_version": pipelineguard.__version__,
            "engine_path": str(Path(pipelineguard.__file__).resolve().parent.parent),
            "data_dir": str(storage.data_dir()), "sample_project": os.environ.get("PIPELINEGUARD_SAMPLE_PROJECT"),
            "desktop_mode": bool(os.environ.get("PIPELINEGUARD_TOKEN")),
            "supported_manifests": DEPENDENCY_FILES, "scan": manager.snapshot().get("status")}


@router.get("/profiles")
def profiles():
    return [_profile_info(p) for p in PROFILES.values()]


@router.get("/fs/list")
def fs_list(path: str | None = None):
    target = Path(path) if path else Path(os.environ.get("PIPELINEGUARD_SAMPLE_PROJECT") or Path.home()).parent
    if not target.is_absolute() or not target.is_dir():
        _bad("Folder does not exist")
    try:
        entries = sorted(target.iterdir(), key=lambda p: p.name.lower())[:800]
    except OSError as exc:
        _bad(f"Cannot read folder: {exc.strerror}")
    drives = [f"{letter}:\\" for letter in string.ascii_uppercase if Path(f"{letter}:\\").is_dir()] if os.name == "nt" else []
    return {"path": str(target), "parent": str(target.parent) if target.parent != target else None,
            "drives": drives,
            "directories": [e.name for e in entries if e.is_dir()],
            "json_files": [e.name for e in entries if e.is_file() and e.suffix.lower() == ".json"]}


@router.post("/config/validate")
def validate_config(payload: dict):
    path = payload.get("path")
    if not isinstance(path, str) or not Path(path).is_absolute() or not Path(path).is_file():
        _bad("Configuration file does not exist")
    try:
        cfg = load_config(Path(path))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        _bad(f"Invalid configuration: {exc}")
    return {"valid": True, "config": _config_dict(cfg)}


def _config_dict(cfg: PipelineGuardConfig) -> dict:
    data = asdict(cfg)
    data["ignored_directories"] = sorted(data["ignored_directories"])
    data["blocked_rules"] = sorted(data["blocked_rules"])
    return data


@router.get("/engine-config")
def read_engine_config(path: str | None = None):
    defaults = _config_dict(PipelineGuardConfig())
    if not path:
        return {"path": None, "exists": False, "raw": {}, "effective": defaults, "defaults": defaults,
                "keys": [f.name for f in fields(PipelineGuardConfig)]}
    target = Path(path)
    if not target.is_absolute() or target.suffix.lower() != ".json":
        _bad("Configuration path must be an absolute .json path")
    if not target.exists():
        return {"path": path, "exists": False, "raw": {}, "effective": defaults, "defaults": defaults,
                "keys": [f.name for f in fields(PipelineGuardConfig)]}
    try:
        raw = json.loads(target.read_text(encoding="utf-8"))
        effective = _config_dict(load_config(target))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        _bad(f"Invalid configuration: {exc}")
    return {"path": path, "exists": True, "raw": raw, "effective": effective, "defaults": defaults,
            "keys": [f.name for f in fields(PipelineGuardConfig)]}


@router.put("/engine-config")
def write_engine_config(body: EngineConfigWrite):
    target = Path(body.path)
    if target.suffix.lower() != ".json" or not target.parent.is_dir():
        _bad("Choose an existing folder and a .json file name")
    fd, tmp = tempfile.mkstemp(suffix=".json", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(body.config, handle, indent=2)
            handle.write("\n")
        effective = load_config(Path(tmp))  # engine is the validation authority
        os.replace(tmp, target)
    except (OSError, ValueError) as exc:
        _bad(f"Invalid configuration: {exc}")
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    storage.record_activity("config-saved", "Engine configuration saved", path=str(target))
    return {"saved": True, "effective": _config_dict(effective)}


@router.post("/scan")
def start_scan(body: ScanRequest):
    project = Path(body.project)
    if not project.is_dir():
        _bad("Select an existing project directory")
    config = Path(body.config) if body.config else None
    if config is not None:
        try:
            load_config(config)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            _bad(f"Invalid configuration: {exc}")
    try:
        return manager.start(project.resolve(), config, body.profile, body.online)
    except RuntimeError as exc:
        _bad(str(exc), 409)


@router.get("/scan/state")
def scan_state():
    return manager.snapshot()


@router.get("/scans/latest")
def latest_scan():
    history = storage.read_history()
    for entry in reversed(history):
        snap = storage.load_snapshot(str(entry.get("scan_id", "")))
        if snap:
            return present_scan(snap)
    return None


@router.get("/scans/{scan_id}")
def get_scan(scan_id: str):
    return present_scan(_snapshot_or_404(scan_id))


@router.post("/findings/evidence")
def finding_evidence(body: EvidenceRequest):
    snap = _snapshot_or_404(body.scan_id)
    findings = snap["report"].get("findings", [])
    if body.index >= len(findings):
        _bad("Finding not found", 404)
    finding = present_finding(body.index, findings[body.index])
    if finding["category"] != "Secret" or not finding["file"] or not finding["line"]:
        _bad("Masked context is only available for secret findings with a line number")
    try:
        lines = masked_context(snap["meta"]["project"], findings[body.index]["file"], finding["line"], finding["rule"])
    except (OSError, ValueError) as exc:
        _bad(str(exc))
    return {"lines": lines, "masked": True}


@router.get("/history")
def history():
    return list(reversed(storage.read_history()))


@router.delete("/history")
def clear_history():
    storage.clear_history()
    storage.record_activity("history-cleared", "Scan history cleared")
    return {"cleared": True}


@router.get("/history/compare")
def compare(base: str, target: str):
    old, new = _snapshot_or_404(base), _snapshot_or_404(target)
    new_findings = new["report"].get("findings", [])
    result = compare_baseline(new_findings, baseline_snapshot(old["report"].get("findings", [])))
    states = result.pop("finding_states")
    changed = [present_finding(i, f) | {"state": states[finding_key(f)]} for i, f in enumerate(new_findings)
               if states[finding_key(f)] in ("new", "regressed")]
    return {**result, "changed_findings": changed,
            "fixed_findings": [{k: v for k, v in f.items()} for f in result["fixed_findings"]][:500],
            "base": old["meta"], "target": new["meta"],
            "score_delta": (new["report"].get("score") or 0) - (old["report"].get("score") or 0)}


@router.get("/activity")
def activity():
    return list(reversed(storage.read_activity()))[:50]


@router.post("/osv/query")
def osv_query(body: OsvQuery):
    results = query_osv([{"name": body.name, "version": body.version, "ecosystem": body.ecosystem}], enrich=True)
    advisories = [present_finding(i, r) for i, r in enumerate(results) if r.get("rule") == "Known dependency vulnerability"]
    notices = [present_finding(i, r) for i, r in enumerate(results) if r.get("rule") == "Dependency check incomplete"]
    storage.record_activity("osv-lookup", f"OSV lookup: {body.ecosystem} {body.name}@{body.version}")
    return {"query": body.model_dump(), "advisories": advisories, "notices": notices,
            "complete": not notices, "queried_at": datetime.now().astimezone().isoformat(timespec="seconds")}


@router.get("/osv/connectivity")
def osv_connectivity():
    try:
        with urllib.request.urlopen(urllib.request.Request("https://api.osv.dev/v1/vulns/OSV-2020-111"), timeout=5):
            return {"online": True}
    except urllib.error.HTTPError:
        return {"online": True}
    except OSError:
        return {"online": False}


def _export_dir(directory: str | None) -> Path:
    if directory:
        return Path(directory)
    prefs = storage.read_preferences()
    return Path(prefs["export_dir"]) if prefs.get("export_dir") else storage.default_reports_dir()


@router.post("/reports/export")
def export_report(body: ExportRequest):
    snap = _snapshot_or_404(body.scan_id)
    folder = _export_dir(body.directory)
    project = Path(snap["meta"].get("project", "project")).name or "project"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output = folder / f"pipelineguard-{project}-{stamp}{REPORT_EXT[body.format]}"
    try:
        WRITERS[body.format](snap["report"], output)
    except OSError as exc:
        _bad(f"Export failed: {exc.strerror or exc}")
    storage.update_history_entry(body.scan_id, reports=[str(output)])
    storage.record_activity("report-generated", f"{body.format.upper()} report generated", path=str(output))
    return {"path": str(output), "format": body.format, "size": output.stat().st_size}


@router.get("/reports")
def list_reports(directory: str | None = Query(default=None)):
    folder = _export_dir(directory)
    if not folder.is_absolute():
        _bad("Folder must be absolute")
    files = []
    if folder.is_dir():
        known_reports = {
            str(Path(report_path).resolve())
            for entry in storage.read_history()
            for report_path in entry.get("reports", [])
            if isinstance(report_path, str)
        }
        for item in folder.iterdir():
            if (item.is_file() and str(item.resolve()) in known_reports
                    and item.name.startswith("pipelineguard") and item.suffix.lower() in REPORT_EXT.values()):
                stat = item.stat()
                files.append({"name": item.name, "path": str(item), "format": item.suffix.lstrip(".").lower(),
                              "size": stat.st_size, "modified": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds")})
    return {"directory": str(folder), "exists": folder.is_dir(), "files": sorted(files, key=lambda f: f["modified"], reverse=True)}


@router.get("/reports/content")
def report_content(path: str):
    target = Path(path)
    if (not target.is_absolute() or not target.is_file() or target.suffix.lower() not in REPORT_EXT.values()
            or not target.name.startswith("pipelineguard")):
        _bad("Report not found", 404)
    # Only preview reports previously exported by this application.
    # A filename prefix and extension alone are not proof of ownership.
    known_reports = {
        str(Path(report_path).resolve())
        for entry in storage.read_history()
        for report_path in entry.get("reports", [])
        if isinstance(report_path, str)
    }
    if str(target.resolve()) not in known_reports:
        _bad("Report not found in local scan history", 404)
    if target.stat().st_size > 5_000_000:
        _bad("Report too large to preview")
    return {"path": str(target), "format": target.suffix.lstrip(".").lower(),
            "content": target.read_text(encoding="utf-8", errors="replace")}


@router.get("/settings")
def get_settings():
    prefs = storage.read_preferences()
    legacy = storage.read_engine_desktop_preferences()
    merged = {"default_project": legacy.get("last_project") or os.environ.get("PIPELINEGUARD_SAMPLE_PROJECT"),
              "default_config": legacy.get("last_config") or None, **prefs}
    try:
        settings = Settings(**merged)
    except ValueError:
        settings = Settings()
    return settings.model_dump() | {"effective_export_dir": str(_export_dir(settings.export_dir))}


@router.put("/settings")
def put_settings(body: Settings):
    if body.default_project and not Path(body.default_project).is_dir():
        _bad("Default project folder does not exist")
    if body.default_config and not Path(body.default_config).is_file():
        _bad("Default configuration file does not exist")
    storage.write_preferences(body.model_dump())
    return body.model_dump() | {"effective_export_dir": str(_export_dir(body.export_dir))}


@router.get("/diagnostics")
def diagnostics():
    import platform
    import sys
    return {"python": sys.version.split()[0], "platform": platform.platform(), "data_dir": str(storage.data_dir()),
            "history_entries": len(storage.read_history()), "engine_version": pipelineguard.__version__,
            "app_version": APP_VERSION, "scan_state": manager.snapshot().get("status")}
