# Specialist River Float Ownership and Reuse

Updated November 17, 2026. Preserve existing field tools. Do not duplicate their routes or access registries in National Rivers.

## Au Sable River

- Canonical specialist: https://ausable.chrisizworski.com/
- Current source recovery: https://github.com/izworskic/chrisizworski-com/tree/main/tool-sources/ausable-river-map
- Capabilities: approximately 70 access points, branch-aware put-in and takeout planner, published float timing, live hydrological context, camping and livery information, and shareable trip links.
- The current HTML supports shared-trip parameters b, from and to and opens the selected trip where slug identities match.
- The source recovery README says auxiliary API source has not all been recovered. Never copy its page data into this repo or claim a stable supported cross-origin route API until a separately versioned, documented contract exists.
- Do not synthesize slug values from a USGS gauge name; link to the canonical planner unless a selected landing record is supported by the owner's canonical source.

## Manistee River

- Canonical specialist: https://chrisizworski.com/manistee-river-map/
- Owning source: https://github.com/izworskic/chrisizworski-com/blob/main/public/assets/manistee-river-map.js
- River access registry: https://github.com/izworskic/chrisizworski-com/blob/main/public/assets/manistee-river-data.js
- Hydrography provider: https://github.com/izworskic/chrisizworski-com/blob/main/api/manistee-river-hydrography.js
- The map already has 15 identified places, including two Pine River stretches, with provenance and exact names. Its river-network planner builds from USGS NHD lines, rejects cross-waterway pairs, and withholds mileage if graph continuity or snap conditions fail.
- The map already exposes exact-place selection through location hash for place IDs. Do not assume a USGS gauge is a public put-in or convert it into a landing ID.
- River-network distance is a modeled path along the available NHD geometry, not a certification of navigability, legal landing, downstream direction, or safety.
- The code is owned by the main chrisizworski-com repository, not by National Rivers.

## Portfolio-wide river discovery

- https://chrisizworski.com/michigan-rivers-field-guide/ already curates 14 Michigan river floats with site-specific references.
- National Rivers owns selected USGS gauge discovery, river condition interpretation, and source freshness. It does not own specialist float routes.
- The River Specialist Handoff is a link-only registry, not a read-through API, cache, route database, SEO clone or cross-repository source import.
- Each specialist's verified access, route, share state, mapping and public URL stay in its original owner.
- Only a future reviewed HTTP or versioned package contract could expose those expert outputs to a spring desk. That contract must include stable access IDs, official provenance, dataset version, freshness, missing-data states and a real route geometry/limitations policy.
- Require both source owners' tests and a cross-repo consumer contract test before implementing that extraction.
- Preserve the existing National Rivers canonical and all ad settings.
