const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const logic=require("../public/assets/paddle-trip-catalog.js");
const inventory=require("../public/data/paddle-route-pilot.json");

test("access records and river segment connections are reviewable",()=>{
  assert.equal(logic.verify(inventory),true);
  assert.equal(inventory.access.length,8);
  assert.equal(inventory.segments.length,5);
  assert.equal(new Set(inventory.segments.map(x=>x.id)).size,5);
  assert.ok(inventory.access.every(x=>x.status==="current-access-not-verified"));
  assert.ok(inventory.segments.every(x=>x.verifiedNavigation===false));
});
test("published Au Sable USFS segments retain actual map mileages",()=>{
  const rows=inventory.segments.filter(x=>x.river==="au-sable");
  assert.deepEqual(rows.map(x=>x.distanceMiles),[2,4,3.5,8]);
  for(const route of rows){
    const d=logic.details(inventory,route.id);
    assert.match(d.source.title,/Forest Service/);
    assert.ok(d.startMap.includes("google.com/maps/search"));
    assert.ok(d.endMap.includes("google.com/maps/search"));
    assert.equal(d.checkedOpen,false);
    assert.equal(d.routeReady,false);
  }
});
test("Manistee pair retains county-verified arrival coordinates and historical float time",()=>{
  const d=logic.details(inventory,"manistee-hodenpyl-redbridge");
  assert.equal(d.distanceMiles,null);
  assert.equal(d.duration,"3 to 4 hours");
  assert.equal(d.start.lat,44.364391);
  assert.equal(d.end.lon,-85.861507);
  assert.ok(d.startMap.includes("44.364391"));
  assert.ok(d.endMap.includes("44.283926"));
  assert.equal(d.routeReady,false);
});
test("invalid river crossing and invented distances cannot pass",()=>{
  const bad=structuredClone(inventory);
  bad.segments[0].to="mn-redbridge";
  assert.throws(()=>logic.verify(bad),/connection/);
  const fake=structuredClone(inventory);
  fake.segments[0].distanceMiles=0;
  assert.throws(()=>logic.verify(fake),/published river distance/);
  const open=structuredClone(inventory);
  open.access[0].status="verified-open-now";
  assert.throws(()=>logic.verify(open),/Access approval/);
});
test("catalog cannot give fake mileage or Google road ETA",()=>{
  const d=logic.details(inventory,"manistee-hodenpyl-redbridge");
  assert.match(d.distance,/not established/i);
  assert.ok(inventory.segments.every(x=>x.timeHoursMin>0 && x.timeHoursMax>0));
  assert.ok(inventory.segments.every(x=>!x.eta && !x.estimatedRoadMiles));
});
test("River Intelligence preserves original canonical, river chooser and fallback route sources",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../public/national-tools/rivers/index.html"),"utf8");
  assert.match(html,/canonical" href="https:\/\/chrisizworski\.com\/national-tools\/rivers\/"/);
  assert.match(html,/assets\/paddle-trip-catalog\.js/);
  assert.match(html,/id="paddle-route-select"/);
  assert.match(html,/id="back-to-rivers"/);
  assert.match(html,/View the Forest Service river-access map/);
});
