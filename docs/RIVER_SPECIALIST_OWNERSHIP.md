# River Specialist Ownership and Reuse

Updated November 17, 2026. Keep the field maps authoritative. National Rivers owns USGS condition discovery and interpretation, not a new float planner.

## Au Sable River

- Canonical: https://ausable.chrisizworski.com/
- Source recovery: https://github.com/izworskic/chrisizworski-com/tree/main/tool-sources/ausable-river-map
- The existing field map contains approximately 70 access records, branch-aware put-in/takeout selection, float timing, conditions, camping/liveries and shared trip links with b/from/to state.
- The recovered index.html is complete but the original deployment's api/share.js and api/snapshot.js source has not been fully recovered. The recorded Vercel project and deployment IDs were unavailable in the connected account scope on November 17, 2026.
- Preserve the existing expert planner as an ordinary canonical destination. No mirrored route database, fictional API or generated access slugs. A source-owned versioned API requires complete source and tests first.

## Manistee River

- Canonical: https://chrisizworski.com/manistee-river-map/
- Owning repository: izworskic/chrisizworski-com
- Existing browser source: public/assets/manistee-river-map.js, manistee-river-data.js and manistee-river-coverage.js
- The expanded field-map inventory contains 53 mapped places and 37 access-capable records as of its 2026-08-20 source audit. It includes Pine River, river gauges, exact original IDs and provenance. The High Bridge record carries an explicit 2026 route caution.
- Manistee already computes NHD network distance, rejects cross-waterway trips and withholds mileage when the route graph cannot connect the points.
- Source-owner PR #1758 proposes GET https://chrisizworski.com/api/manistee-float-v1?mode=access and ?mode=route&from=<id>&to=<id> . Do not claim the API is live until that PR is merged and production is verified.
- The API uses the same graph and the complete field-map access registry. It explicitly refuses to certify access, downstream direction or navigability.
- National Rivers reads the versioned access catalog only when the visitor selects a Michigan Manistee gauge. Its optional catalog count is an evidence detail, not a new local inventory. Failure leaves the original specialist link usable.
- A shared readManisteeRoute adapter is available for a future Spring Field Desk, with strict version, owner, data-integrity and non-safety-approval gates. The National Rivers page deliberately does not duplicate put-in/takeout selection.
- Integration tests are fully stubbed; no CI or preview build needs access to production data.

## Portfolio river field guide

https://chrisizworski.com/michigan-rivers-field-guide/ remains the primary statewide narrative entry covering 14 curated floats.

## Release gates

1. Main source-owner PR #1758 must pass its full repo verification and field-map regression checks.
2. After merge, smoke-test source API successful route responses, outage behavior and source-qualified arrival links.
3. Only then deploy the National Rivers consumer PR. It must continue working if the new API is not available.
4. Recover the remaining Au Sable auxiliary sources and establish its own independently tested contract before adding any Au Sable API adapter.

No national duplicate routes, new canonical pages, unsafe water recommendations or ad changes.
