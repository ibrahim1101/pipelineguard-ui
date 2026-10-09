"""Security checks for the optional loopback-only development launcher."""
import os
import unittest
from unittest.mock import patch

from launch_local import configure_local_bridge


class LocalLauncherTests(unittest.TestCase):
    def test_generates_distinct_tokens_and_enables_desktop_auth(self):
        with patch.dict(os.environ, {}, clear=False):
            old_token = os.environ.get("PIPELINEGUARD_TOKEN")
            old_mode = os.environ.get("PIPELINEGUARD_DESKTOP_MODE")
            try:
                first = configure_local_bridge()
                second = configure_local_bridge()
                self.assertNotEqual(first, second)
                self.assertGreaterEqual(len(first), 32)
                self.assertEqual(os.environ["PIPELINEGUARD_TOKEN"], second)
                self.assertEqual(os.environ["PIPELINEGUARD_DESKTOP_MODE"], "1")
            finally:
                if old_token is None:
                    os.environ.pop("PIPELINEGUARD_TOKEN", None)
                else:
                    os.environ["PIPELINEGUARD_TOKEN"] = old_token
                if old_mode is None:
                    os.environ.pop("PIPELINEGUARD_DESKTOP_MODE", None)
                else:
                    os.environ["PIPELINEGUARD_DESKTOP_MODE"] = old_mode

    def test_launcher_does_not_expose_host_argument(self):
        import ast
        from pathlib import Path
        source = ast.parse((Path(__file__).resolve().parents[1] / "launch_local.py").read_text())
        calls = [node for node in ast.walk(source) if isinstance(node, ast.Call)]
        hosts = [kw.value.value for call in calls for kw in call.keywords
                 if kw.arg == "host" and isinstance(kw.value, ast.Constant)]
        self.assertEqual(hosts, ["127.0.0.1"])


if __name__ == "__main__":
    unittest.main()
