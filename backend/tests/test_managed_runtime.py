"""Windows-compatible subprocess smoke test for managed bridge lifecycle."""
import os
import socket
import subprocess
import sys
import time
import unittest
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
ENGINE = BACKEND.parent / "engine"


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class ManagedRuntimeTests(unittest.TestCase):
    def test_authenticated_startup_rejection_and_shutdown(self):
        port = free_port()
        token = "ci-managed-runtime-token"
        env = dict(os.environ, PIPELINEGUARD_ENGINE_PATH=str(ENGINE),
                   PIPELINEGUARD_DESKTOP_MODE="1", PIPELINEGUARD_TOKEN=token,
                   CERBERUS_MANAGED_CHILD="1")
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "server:app",
             "--host", "127.0.0.1", "--port", str(port)],
            cwd=BACKEND, env=env, stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
        try:
            base = f"http://127.0.0.1:{port}"
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    self.fail("Managed bridge exited before readiness: " + proc.stderr.read().decode(errors="replace")[-1500:])
                try:
                    response = httpx.get(base + "/api/status",
                                         headers={"X-PipelineGuard-Token": token}, timeout=1)
                    if response.status_code == 200:
                        break
                except httpx.RequestError:
                    pass
                time.sleep(0.2)
            else:
                self.fail("Managed bridge did not become authenticated-ready")
            self.assertEqual(httpx.get(base + "/api/status", timeout=3).status_code, 401)
            self.assertEqual(httpx.get(base + "/api/status", headers={"X-PipelineGuard-Token": "incorrect"}, timeout=3).status_code, 401)
            self.assertEqual(httpx.get(base + "/api/status", headers={"X-PipelineGuard-Token": token}, timeout=3).status_code, 200)
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
            if proc.stderr:
                proc.stderr.close()
        self.assertIsNotNone(proc.returncode)


if __name__ == "__main__":
    unittest.main()
