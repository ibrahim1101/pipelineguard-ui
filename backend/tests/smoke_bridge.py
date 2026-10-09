"""CI smoke test for the PipelineGuard bridge on Windows and Linux."""
from fastapi.testclient import TestClient
from server import app

with TestClient(app) as client:
    health = client.get("/api/health")
    assert health.status_code == 200, health.text
    assert health.json().get("ok") is True
    denied = client.get("/api/status")
    assert denied.status_code == 401, denied.text
    allowed = client.get("/api/status", headers={"X-PipelineGuard-Token": "ci-test-token"})
    assert allowed.status_code == 200, allowed.text
    profiles = client.get("/api/profiles", headers={"X-PipelineGuard-Token": "ci-test-token"})
    assert profiles.status_code == 200, profiles.text
    print("Bridge health, token authentication and profiles: PASS")
