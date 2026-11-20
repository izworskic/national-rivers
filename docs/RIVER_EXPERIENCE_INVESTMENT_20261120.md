# Rivers | Experience Investment 2026-11-20

Mode: IMPLEMENT (review, select, build, verify)  
Canonical: https://chrisizworski.com/national-tools/rivers/  
Authoritative source: `izworskic/national-rivers`  
Skill: `experience-investment` from the pending `chrisizworski-com` PR #1780, read without treating it as merged or automatically inherited by this repository.

## Visitor job

A paddler, angler or river watcher needs to find an actual monitored river near a U.S. place, choose the correct USGS station, understand the last reported flow and whether it is changing, and decide which official or local source to check before visiting. This does not require a combined safety or navigability rating.

## Baseline and diagnosis

The public canonical page and owning HTML both have a working place form, river-group discovery, explicit gauge selection, flow/stage/temperature, same-date USGS history where available, NOAA NWPS and NWS weather kept separate, activity lenses, and specialist Au Sable and Manistee handoffs.

The first visitor action was visually downstream from a breadcrumb, full descriptive introduction and unrelated tool navigation. River choice cards repeated the same bordered treatment as the reading cards. The sparkline drew equal horizontal spacing for observations even when time intervals differed, and had no visible time or flow axes. Historical percentiles were only a line of text. Map focus had an OSM link but no clearly identified Google Maps area search.

Visual baseline inspected in live text and authoritative HTML/CSS/JS. Phone and desktop screenshots: **NOT CAPTURED**. This review does not claim visual browser acceptance.

## Two plausible directions

**A. Field station (chosen).** First phone screen keeps the place search primary, with optional one-tap example cities and the location button. Nearby rivers appear as distance-led, station-specific choices, not false live reports. After selecting the exact monitoring point, the page becomes a river-reading station: observed discharge leads; a timestamp-positioned flow trace illustrates the measurements without joining large reporting gaps; the same-date percentile band places the reading against USGS history if available. The optional embedded map retains attribution and separates gauge area from lawful public access. Desktop uses a two-column finder and a wide measured-flow chart. Missing source observations fall back to explicit text. Medium implementation, no new service.

**B. National river atlas (deferred).** First phone screen is a geographic canvas with live river layers and a synchronized gauge dossier; desktop is split map/list. It better supports large-area spatial exploration, but would require reliable nationwide basemap and station marker interaction, robust map-offline and low-bandwidth fallbacks, and extra mobile performance work. More importantly, a USGS monitoring coordinate is not a recreational access point. An apparently authoritative river map risks inviting unsupported route interpretation. Higher cost and risk, with no verified user benefit over the existing river list.

Selection: A. It addresses a demonstrable interpretation problem rather than merely adding decorative cartography.

## Distinctiveness

Compared with Michigan Snow Totals, the first answer is **a selectable monitoring station**, not a statewide magnitude or ranked snow report. The flow graphic is a *time-respecting observation trace*, not a bar comparison of measurements across places.

Compared with Great Lakes Buoys, the hero is **not a map-first station dashboard**. The user needs to disambiguate a river and its gauge from a place search; only then should measurements and a gauge-area map appear. The historical percentile spectrum answers a seasonal hydrology question rather than comparing marine sensor reports. Shared accessibility and source-truth conventions are intentionally retained.

## Implemented scope

- Page-only presentation: compact finder, example place controls, distance-led river choices, clearer observed-flow hierarchy, responsive reading station, selected gauge Google Maps area search, reduced-motion-aware scroll, and accessible activity toggle states.
- Pure `public/assets/river-viz.js`: numeric/observation-time hydrograph with visible axes and reporting-gap breaks; monotonic, valid-percentile horizontal range model. Neither forecasts nor activity scores are derived.
- Scoped `public/assets/river-experience.css`: river-specific layout and accessible legibility rather than Snow Totals tokens.
- `tests/river-viz.test.js`: chronological fidelity, sparse/missing data, gap handling, historical scale and canonical/owner/source-regression checks.

No additional npm dependency, Rust/WASM/Python engine, API, data feed, generated imagery, canonical, indexed child URL, AdSense code or river-route database was introduced. The existing USGS/NWPS/NWS and river-specialist interfaces are still the source of truth. The existing sitemap-generation program is unmodified.

## Proof and release boundaries

Direct in-tool source check on this branch: inline JS and the visualization module parsed in V8; numeric sample and invalid percentile behavior checked; core canonical, Person, discovery, paddle and specialist markers still present. These static checks are **not** browser acceptance.

Complete the owning repository's `npm test` and GitHub workflow. Review at 360, 390, 768, 1280 and 1440 px, including 390/1280 before/after, keyboard, focus, location rejection, no JS, reduced motion, loading, stale/failed USGS, absent NOAA, long station names, long results, source map blocked and A > B > A river choice. Browser screenshots and measured visitor outcomes are **NOT VERIFIED** at PR creation. Do not claim release, SEO lift, CTR changes or live production status before verified deployment.

No merge or production publish is authorized by this implementation request.
