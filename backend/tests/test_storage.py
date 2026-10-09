"""Regression tests for local report tracking and persistence."""
import os
import tempfile
import unittest
from pathlib import Path

from bridge import storage


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="pipelineguard-storage-test-")
        self.previous = os.environ.get("PIPELINEGUARD_DATA_DIR")
        os.environ["PIPELINEGUARD_DATA_DIR"] = self.tmp.name

    def tearDown(self):
        if self.previous is None:
            os.environ.pop("PIPELINEGUARD_DATA_DIR", None)
        else:
            os.environ["PIPELINEGUARD_DATA_DIR"] = self.previous
        self.tmp.cleanup()

    def test_history_roundtrip_and_report_tracking(self):
        scan_id = "0123456789abcdef"
        storage.save_snapshot(scan_id, {"findings": [], "status": "PASS", "score": 100}, {"scan_id": scan_id})
        storage.append_history({"scan_id": scan_id, "reports": []})
        self.assertIsNotNone(storage.load_snapshot(scan_id))
        report = str(Path(self.tmp.name) / "pipelineguard-test.json")
        storage.update_history_entry(scan_id, reports=[report])
        storage.update_history_entry(scan_id, reports=[report])
        self.assertEqual(storage.read_history()[0]["reports"], [report])

    def test_clear_history_removes_snapshots(self):
        scan_id = "fedcba9876543210"
        storage.save_snapshot(scan_id, {"findings": []}, {"scan_id": scan_id})
        storage.append_history({"scan_id": scan_id, "reports": []})
        storage.clear_history()
        self.assertEqual(storage.read_history(), [])
        self.assertIsNone(storage.load_snapshot(scan_id))


if __name__ == "__main__":
    unittest.main()
