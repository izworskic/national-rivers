"""Deterministic audit tests. No package installation or outbound network."""
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from usgs_dataretrieval_audit import summarize, parse_time

NOW = datetime(2026, 11, 22, 12, tzinfo=timezone.utc)
START = NOW - timedelta(days=7)


class UsgaDailyAuditTests(unittest.TestCase):
    def report(self, rows):
        return summarize(rows, now=NOW, start=START, end=NOW)

    def test_valid_daily_observations_preserve_real_units_and_time(self):
        result = self.report([
            {"time": "2026-11-20T00:00:00Z", "value": 450, "unit_of_measure": "ft^3/s"},
            {"time": "2026-11-21T00:00:00Z", "value": 530, "unit_of_measure": "ft^3/s"},
        ])
        self.assertEqual(result["status"], "AVAILABLE")
        self.assertEqual(result["valid_day_count"], 2)
        self.assertEqual(result["latest_observation_day"], "2026-11-21")
        self.assertEqual(result["latest_cfs"], 530)
        self.assertEqual(result["min_cfs"], 450)
        self.assertEqual(result["site_id"], "04157000")

    def test_empty_and_stale_do_not_invent_current_reading(self):
        self.assertEqual(self.report([])["status"], "UNAVAILABLE")
        stale = self.report([{"time": "2026-11-16", "value": 30, "unit_of_measure": "ft3/s"}])
        self.assertEqual(stale["status"], "STALE")
        self.assertEqual(stale["latest_observation_day"], "2026-11-16")

    def test_future_negative_nan_and_wrong_units_are_rejected(self):
        result = self.report([
            {"time": "2026-11-23T00:00:00Z", "value": 400, "unit": "ft3/s"},
            {"time": "2026-11-21", "value": -1, "unit": "ft3/s"},
            {"time": "2026-11-21", "value": float("nan"), "unit": "ft3/s"},
            {"time": "2026-11-21", "value": 500, "unit": "meters"},
        ])
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertEqual(result["rejected_row_count"], 4)

    def test_conflicting_duplicate_day_refuses_value(self):
        result = self.report([
            {"time": "2026-11-21T00:00:00Z", "value": 500, "unit": "cfs"},
            {"time": "2026-11-21T12:00:00Z", "value": 900, "unit": "cfs"},
        ])
        self.assertEqual(result["status"], "PARTIAL")
        self.assertEqual(result["conflicting_day_count"], 1)
        self.assertIsNone(result["latest_cfs"])

    def test_identical_duplicate_day_is_counted_once(self):
        result = self.report([
            {"time": "2026-11-21", "value": 500, "unit": "cfs"},
            {"time": "2026-11-21", "value": 500, "unit": "cfs"},
        ])
        self.assertEqual(result["status"], "AVAILABLE")
        self.assertEqual(result["valid_day_count"], 1)
        self.assertEqual(result["duplicate_day_count"], 1)

    def test_malformed_time_returns_unavailable(self):
        self.assertIsNone(parse_time("garbage"))
        self.assertEqual(self.report([{"time": "not a date", "value": 500, "unit": "cfs"}])["status"], "UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
