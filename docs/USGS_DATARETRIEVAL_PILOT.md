# USGS dataretrieval Python audit pilot

Owner: izworskic/national-rivers. Status: developer-only and offline by default. No production API, map, canonical, visitor behavior, dependency graph or Vercel change.

## Decision and competing architectures

The existing JavaScript National Rivers API already obtains current observations from the official USGS modern Water Data API. Keep that live path. A request-time Python replacement would add runtime cost and duplicate proven logic, so it is rejected. An offline Python evidence audit is useful for checking a single station's independent daily aggregate series without modifying visitor conditions.

Source: [DOI-USGS/dataretrieval-python](https://github.com/DOI-USGS/dataretrieval-python), maintained by the USGS. Public domain USGS code where applicable. Upstream \`dataretrieval.waterdata.get_daily\` returns a pandas DataFrame and metadata from USGS Water Data. Parameter 00060 means discharge; daily values are not the same as instantaneous flow shown by the live browser. Source URL: https://api.waterdata.usgs.gov/.

## Pilot contract

Site \`04157000\`, Saginaw River at Saginaw, Michigan, is already used in owning-repo river tests. No safety rating, historical percentile inference, actual data value, or new forecast is generated from a fixture. The live script only queries this exact station unless explicitly given another numeric ID.

\`scripts/usgs_dataretrieval_audit.py\` emits version 1 JSON with \`status\` (AVAILABLE, STALE, PARTIAL, UNAVAILABLE), site ID, parameter, sample type, date window, audit timestamp, valid day count, duplicate/conflict/rejection counts and latest daily value where supported. Missing rows are not zeros. Conflicting duplicate dates withhold the value. Future, invalid, negative, out-of-window or unit-mismatched rows are rejected. Values older than three days are marked STALE. The script refuses to fetch without \`--live\`. Live access is never part of CI.

## How to run

Dependency-free tests:
\`\`\`bash
python3 -m unittest discover -s tests -p 'test_*.py'
npm test
\`\`\`

An operator can separately create a developer virtual environment and install the optional package from the official project:
\`\`\`bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install dataretrieval
python scripts/usgs_dataretrieval_audit.py --live --site 04157000 --days 7
\`\`\`

USGS may require an API key for higher rate limits. Do not commit, echo or embed keys in user-facing pages. No request is made automatically on build or deploy. The output describes official daily source observations; it is not a comparison claiming exact agreement with the existing instantaneous API.

## Validation and rollback

Python unittest runs offline as part of this repository's existing verify workflow, before npm test. Check live station response and output schema manually only when authorized. Remove this isolated script, test and workflow step to roll back. Never publish a generated observation report without explicit review. No new services, paid APIs, storage, Redis or marketing measurement claims.
