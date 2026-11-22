#!/usr/bin/env python3
"""Optional offline audit of one USGS daily-discharge series, not a river API."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path

DEFAULT_SITE = "04157000"
SOURCE = "https://api.waterdata.usgs.gov/"
PARAMETER = "00060"
UNITS = {"ft^3/s", "ft3/s", "cfs"}


def parse_time(raw):
    if raw is None:
        return None
    if isinstance(raw, datetime):
        value = raw
    else:
        text = str(raw).strip().replace("Z", "+00:00")
        try:
            value = datetime.fromisoformat(text)
        except (ValueError, TypeError):
            return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def summarize(rows, site=DEFAULT_SITE, start=None, end=None, now=None):
    now = now or datetime.now(timezone.utc)
    end = end or now
    start = start or end - timedelta(days=7)
    observations = {}
    rejected = 0
    duplicates = 0
    conflicts = 0
    for row in rows:
        try:
            observed = parse_time(row.get("time", row.get("date")))
            value = float(row.get("value"))
            units = str(row.get("unit_of_measure") or row.get("unit") or "").strip()
            if (observed is None or observed > now or observed < start or observed > end
                    or not math.isfinite(value) or value < 0 or units not in UNITS):
                rejected += 1
                continue
            key = observed.date().isoformat()
            if key in observations:
                duplicates += 1
                if abs(observations[key] - value) > 0.0001:
                    conflicts += 1
            else:
                observations[key] = value
        except (AttributeError, TypeError, ValueError, OverflowError):
            rejected += 1
    ordered = sorted(observations.items())
    latest_day = ordered[-1][0] if ordered else None
    age_days = (now.date() - datetime.fromisoformat(latest_day).date()).days if latest_day else None
    status = ("PARTIAL" if conflicts else
              "UNAVAILABLE" if not ordered else
              "STALE" if age_days is not None and age_days > 3 else
              "AVAILABLE")
    return {
        "schema_version": 1,
        "status": status,
        "site_id": site,
        "parameter_code": PARAMETER,
        "sample_type": "USGS reported daily discharge, not current instantaneous flow",
        "source": "USGS Water Data API via DOI-USGS/dataretrieval-python",
        "source_url": SOURCE,
        "window_start_utc": start.isoformat(),
        "window_end_utc": end.isoformat(),
        "audited_at_utc": now.isoformat(),
        "valid_day_count": len(ordered),
        "duplicate_day_count": duplicates,
        "conflicting_day_count": conflicts,
        "rejected_row_count": rejected,
        "latest_observation_day": latest_day,
        "latest_cfs": ordered[-1][1] if ordered and not conflicts else None,
        "min_cfs": min(observations.values()) if ordered and not conflicts else None,
        "max_cfs": max(observations.values()) if ordered and not conflicts else None,
        "note": "Observational source audit only. Does not establish navigation or paddling safety.",
    }


def fetch_daily(site, start, end):
    try:
        from dataretrieval import waterdata
    except ImportError as exc:
        raise RuntimeError("Optional package missing: install dataretrieval in a developer-only environment") from exc
    frame, _metadata = waterdata.get_daily(
        monitoring_location_id="USGS-" + site,
        parameter_code=PARAMETER,
        time=f"{start.date().isoformat()}/{end.date().isoformat()}",
    )
    return frame.to_dict(orient="records")


def main():
    parser = argparse.ArgumentParser(description="Optional source-backed USGS daily-flow audit")
    parser.add_argument("--live", action="store_true", help="Explicitly query the public USGS API")
    parser.add_argument("--site", default=DEFAULT_SITE, help="Exact USGS numeric gauge ID")
    parser.add_argument("--days", type=int, default=7, help="Lookback 1 to 31 days")
    parser.add_argument("--output", help="Optional local JSON output path; never publish automatically")
    args = parser.parse_args()
    if not args.live:
        parser.error("No live USGS request was made. Pass --live to opt in.")
    if not args.site.isdigit() or not 5 <= len(args.site) <= 15:
        parser.error("site must be a 5 to 15 digit USGS monitoring location")
    if not 1 <= args.days <= 31:
        parser.error("days must be from 1 to 31")
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=args.days)
    try:
        rows = fetch_daily(args.site, start, now)
    except Exception as exc:
        parser.exit(2, f"USGS audit unavailable: {type(exc).__name__}: {exc}\n")
    result = summarize(rows, site=args.site, start=start, end=now, now=now)
    output = json.dumps(result, indent=2) + "\n"
    if args.output:
        dest = Path(args.output)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    if result["status"] in ("UNAVAILABLE", "PARTIAL"):
        raise SystemExit(3)


if __name__ == "__main__":
    main()
