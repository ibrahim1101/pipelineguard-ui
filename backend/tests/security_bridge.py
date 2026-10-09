"""CI security regression checks for bridge auth and report preview access."""
import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient
from bridge import storage
from server import app

TOKEN = os.environ["PIPELINEGUARD_TOKEN"]
HEADERS = {"X-PipelineGuard-Token": TOKEN}

with tempfile.TemporaryDirectory(prefix="pg-security-") as temp:
    previous = os.environ.get("PIPELINEGUARD_DATA_DIR")
    os.environ["PIPELINEGUARD_DATA_DIR"] = temp
    try:
        with TestClient(app) as client:
            assert client.get("/api/health").status_code == 200
            for path in ("/api/status", "/api/history", "/api/reports", "/api/scans/latest"):
                assert client.get(path).status_code == 401, path
                assert client.get(path, headers={"X-PipelineGuard-Token": "wrong"}).status_code == 401, path
                assert client.get(path, headers=HEADERS).status_code == 200, path

            assert client.delete("/api/history").status_code == 401
            assert client.delete("/api/history", headers={"X-PipelineGuard-Token": "wrong"}).status_code == 401
            assert client.post("/api/scan", json={"project": temp}).status_code == 401

            # A report-like filename is not enough: only recorded exports can be previewed.
            report = Path(temp) / "pipelineguard-unregistered.json"
            report.write_text('{"secret":"must-not-be-exposed"}', encoding="utf-8")
            denied = client.get("/api/reports/content", params={"path": str(report)}, headers=HEADERS)
            assert denied.status_code == 404, denied.text

            scan_id = "security0123456789"
            storage.append_history({"scan_id": scan_id, "reports": [str(report)]})
            allowed = client.get("/api/reports/content", params={"path": str(report)}, headers=HEADERS)
            assert allowed.status_code == 200, allowed.text
            assert allowed.json()["content"] == report.read_text(encoding="utf-8")

            # Symlinks pointing to unregistered files must not bypass the resolved-path allowlist.
            outside = Path(temp) / "pipelineguard-outside.json"
            outside.write_text('{"private":true}', encoding="utf-8")
            link = Path(temp) / "pipelineguard-link.json"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError):
                print("Symlink creation unavailable on this runner; symlink case skipped")
            else:
                denied_link = client.get("/api/reports/content", params={"path": str(link)}, headers=HEADERS)
                assert denied_link.status_code == 404, denied_link.text

            oversized = Path(temp) / "pipelineguard-large.json"
            oversized.write_bytes(b"x" * 5_000_001)
            storage.update_history_entry(scan_id, reports=[str(oversized)])
            large_response = client.get("/api/reports/content", params={"path": str(oversized)}, headers=HEADERS)
            assert large_response.status_code == 400, large_response.text

            traversal = client.get("/api/scans/..%2F..%2Foutside", headers=HEADERS)
            assert traversal.status_code in (400, 404), traversal.text
    finally:
        if previous is None:
            os.environ.pop("PIPELINEGUARD_DATA_DIR", None)
        else:
            os.environ["PIPELINEGUARD_DATA_DIR"] = previous

print("Bridge authentication, report allowlist, symlink and preview limits: PASS")
