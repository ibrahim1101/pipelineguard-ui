"""Single background scan runner that relays real engine progress events."""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from pipelineguard.engine import run_scan
from pipelineguard.profiles import get_profile

from bridge import storage
from bridge.presenter import clean

STAGES = [
    ("discovery", "Project discovery & fingerprinting"),
    ("dependencies", "Dependency analysis"),
    ("osv", "OSV lookup"),
    ("secrets", "Secret analysis"),
    ("evaluation", "Security evaluation & report preparation"),
]
EVENT_STAGE = {
    "fingerprint": "discovery", "fingerprint-complete": "discovery", "fingerprint-unavailable": "discovery",
    "dependencies": "dependencies", "vulnerability-intelligence": "osv", "secrets": "secrets",
    "secrets-complete": "evaluation", "complete": "evaluation",
}


class ScanManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict = {"status": "idle"}
        self._started = 0.0

    def snapshot(self) -> dict:
        with self._lock:
            state = dict(self._state)
            state["stages"] = [dict(s) for s in state.get("stages", [])]
            if state.get("status") == "running":
                state["elapsed_ms"] = (perf_counter() - self._started) * 1000
            return state

    def start(self, project: Path, config: Path | None, profile: str, online: bool) -> dict:
        selected = get_profile(profile)
        with self._lock:
            if self._state.get("status") == "running":
                raise RuntimeError("A scan is already running")
            effective = online and selected.online_intelligence
            stages = [{"key": k, "label": label, "state": "pending"} for k, label in STAGES
                      if k != "discovery" or selected.incremental]
            for stage in stages:
                if stage["key"] == "osv" and not effective:
                    stage["label"] = "OSV lookup (offline — skipped)"
            self._started = perf_counter()
            self._state = {
                "status": "running", "scan_id": uuid.uuid4().hex[:16], "project": str(project),
                "config": str(config) if config else None, "profile": selected.name,
                "online_requested": online, "online_effective": effective, "stages": stages,
                "current_stage": None, "progress": 0.0, "files_discovered": None, "files_processed": None,
                "files_cached": None, "findings_detected": 0, "error": None, "result": None,
                "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            state = dict(self._state)
        storage.record_activity("scan-started", f"Scan started ({selected.name})", project=str(project))
        threading.Thread(target=self._run, args=(state,), daemon=True, name="pipelineguard-scan").start()
        return state

    def _advance(self, key: str, fraction: float = 0.0) -> None:
        stages = self._state["stages"]
        keys = [s["key"] for s in stages]
        if key not in keys:
            return
        pos = keys.index(key)
        for i, stage in enumerate(stages):
            stage["state"] = "done" if i < pos else ("active" if i == pos else stage["state"])
            if stage["key"] == "osv" and i < pos and not self._state["online_effective"]:
                stage["state"] = "skipped"
        self._state["current_stage"] = stages[pos]["label"]
        self._state["progress"] = max(self._state["progress"], round((pos + fraction) / len(stages) * 100, 1))

    def _on_progress(self, event) -> None:
        with self._lock:
            key = EVENT_STAGE.get(event.stage)
            if key is None:
                return
            fraction = 0.0
            if event.stage.startswith("fingerprint") and event.discovered:
                self._state["files_discovered"] = event.discovered
                self._state["files_processed"] = event.processed
                self._state["files_cached"] = event.cached
                fraction = min(1.0, (event.processed or 0) / event.discovered) * 0.95
            if event.stage == "secrets-complete" and event.discovered is not None:
                self._state["files_discovered"] = event.discovered
                self._state["files_processed"] = event.processed
            self._advance(key, fraction)

    def _on_finding(self, finding: dict) -> None:
        if finding.get("severity") != "INFO":
            with self._lock:
                self._state["findings_detected"] += 1

    def _run(self, state: dict) -> None:
        timings: dict[str, float] = {}
        try:
            report = run_scan(Path(state["project"]), Path(state["config"]) if state["config"] else None,
                              state["online_requested"], profile=state["profile"], progress=self._on_progress,
                              timings=timings, on_finding=self._on_finding)
        except Exception as exc:  # engine errors are surfaced, never hidden
            with self._lock:
                self._state.update(status="failed", error=clean(exc, 300) or exc.__class__.__name__,
                                   elapsed_ms=(perf_counter() - self._started) * 1000)
            storage.record_activity("scan-failed", "Scan failed", project=state["project"])
            return
        with self._lock:
            cache = report.get("secret_cache") or {}
            files = self._state["files_discovered"] if self._state["files_discovered"] is not None else cache.get("discovered")
            meta = {"scan_id": state["scan_id"], "project": state["project"], "config": state["config"],
                    "profile": state["profile"], "online_requested": state["online_requested"],
                    "online_effective": state["online_effective"], "started_at": state["started_at"],
                    "duration_ms": round(timings.get("total_ms", (perf_counter() - self._started) * 1000), 1),
                    "timings": {k: round(v, 1) for k, v in timings.items()}, "files_discovered": files}
        storage.save_snapshot(state["scan_id"], report, meta)
        storage.append_history({
            "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"), "project": state["project"],
            "status": report["status"], "score": report["score"], "findings": len(report["findings"]),
            "scan_id": state["scan_id"], "profile": state["profile"], "duration_ms": meta["duration_ms"],
            "files": files, "dependency_check_complete": report.get("dependency_check_complete"),
            "online": state["online_effective"], "reports": [],
        })
        storage.record_activity("scan-completed", f"Scan completed — {report['status']}, score {report['score']}",
                                project=state["project"], scan_id=state["scan_id"])
        with self._lock:
            for stage in self._state["stages"]:
                stage["state"] = "skipped" if stage["state"] == "skipped" or (
                    stage["key"] == "osv" and not state["online_effective"]) else "done"
            self._state.update(status="completed", progress=100.0, current_stage="Complete",
                               elapsed_ms=meta["duration_ms"], files_discovered=files,
                               result={"status": report["status"], "score": report["score"],
                                       "findings": len(report["findings"]), "summary": report.get("summary")})


manager = ScanManager()
