"""End-to-end offline scan and report export using an isolated temporary project."""
import os
import tempfile
import time
from pathlib import Path

from fastapi.testclient import TestClient
from server import app

headers = {"X-PipelineGuard-Token": os.environ["PIPELINEGUARD_TOKEN"]}

with tempfile.TemporaryDirectory(prefix="pipelineguard-ci-project-") as root:
    project = Path(root) / "sample"
    project.mkdir()
    (project / "requirements.txt").write_text("requests==2.31.0\n", encoding="utf-8")
    (project / "main.py").write_text("def greeting():\n    return 'hello'\n", encoding="utf-8")
    with TestClient(app) as client:
        start = client.post("/api/scan", headers=headers, json={
            "project": str(project.resolve()), "profile": "standard", "online": False
        })
        assert start.status_code == 200, start.text
        scan_id = start.json()["scan_id"]
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            response = client.get("/api/scan/state", headers=headers)
            assert response.status_code == 200, response.text
            state = response.json()
            if state["status"] in ("completed", "failed"):
                break
            time.sleep(0.25)
        else:
            raise AssertionError("Scan timed out")
        assert state["status"] == "completed", state
        assert state["progress"] == 100.0, state
        history = client.get("/api/history", headers=headers)
        assert history.status_code == 200, history.text
        assert any(entry.get("scan_id") == scan_id for entry in history.json())
        report = client.post("/api/reports/export", headers=headers, json={
            "scan_id": scan_id, "format": "json", "directory": str(Path(root).resolve())
        })
        assert report.status_code == 200, report.text
        report_path = Path(report.json()["path"])
        assert report_path.is_file()
        preview = client.get("/api/reports/content", headers=headers, params={"path": str(report_path)})
        assert preview.status_code == 200, preview.text
        listing = client.get("/api/reports", headers=headers, params={"directory": str(Path(root).resolve())})
        assert listing.status_code == 200, listing.text
        assert any(item["path"] == str(report_path) for item in listing.json()["files"])
        print("Offline scan, history, JSON export, preview and listing: PASS")
