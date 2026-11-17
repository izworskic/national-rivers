# Spring 2027 paddling pilot: source and release contract

Scope: five published Michigan river segments, eight named access records. This is a read-only static inventory. It is not a route geometry service or an access authorization.

## Source inventory

- Au Sable National Scenic River: USDA Forest Service Mio Ranger District published map, mirrored at https://outdoormichigan.org/trails/AuSableScenicRiverMap.pdf . Canoe-access sites in its numbered directory include DNR M-33 River Access (1), Loud's Rest Stop (2), DNR Comins Flats Access (7), Davis Rest Stop (9), McKinley Landing (11), and 4001 Bridge Landing (18). Published segments: 1 to 2 = 2 miles / 1 hour; 7 to 9 = 4 miles / 1.25 hours; 9 to 11 = 3.5 miles / 1 hour; 11 to 18 = 8 miles / 2.5 hours. Values are historical map references, never today's predictions.
- Manistee below Hodenpyl: Michigan Trails documents Hodenpyl Dam river access to Red Bridge as a 3 to 4 hour float with brisk rapids, https://mitrails.org/trail/manistee-river-water-trail/ . It does not publish a route length on that page. The catalog must not synthesize one.
- Manistee access coordinates: Manistee County Convention and Visitors Bureau boating access map, https://www.visitmanisteecounty.com/wp-content/uploads/2017/06/ManisteeCounty-BoatingAccessMap-6-1-17.pdf . Hodenpyl Dam Access: 44.364391, -85.820378. Red Bridge: 44.283926, -85.861507.

Research checkpoint: November 17, 2026. Historical publications do not establish current openings, source availability or permission.

## Implementation rules

- Every access point has a cited source and the fixed current-access-not-verified state.
- Every segment uses source-backed endpoint identities and never crosses between river names.
- Do not infer miles, ETA, route line or navigability from access-point coordinates.
- Au Sable arrival coordinates are omitted pending independent verification; its Google Maps action is explicitly a named-location search.
- Manistee coordinates are used as published by the county, not invented as river centerlines.
- No dam-release readings, obstacle clearance, skill rating, launch hours, fees, parking permission or legal-access assertion is supplied.
- The existing USGS/NWS/NOAA conditions view is adjacent evidence, not route navigation approval.
- Static publication data is checked in CI for source and graph integrity.

## Next release gates

1. Obtain current land-manager confirmation of each legal arrival, hours, fees and parking.
2. Reconcile dam operations and hazards for each reach, including obstacles, portages and temporary closures.
3. Validate section-specific gauge relevance and any lag between readings and downstream conditions.
4. Add river geometry only where a reviewed, licensed water-trail line exists.
5. Browser-test mobile selection, source failure, Google Maps locations and existing River Intelligence flows.
6. Independently verify production before calling this a complete River Float Finder.

The canonical /national-tools/rivers/ URL, advertising, and tool-repository ownership remain unchanged.
