const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const bridge=require("../public/assets/river-specialist-handoff.js");

const gauge=(name,latitude=44.5,longitude=-84.8)=>({name,latitude,longitude,id:"04136500"});

test("correct Michigan Au Sable monitoring stations open the existing Au Sable Field Map",()=>{
  const x=bridge.match(gauge("AUSABLE RIVER AT MIO MI"));
  assert.equal(x?.url,"https://ausable.chrisizworski.com/");
  assert.equal(bridge.match(gauge("AU SABLE RIVER NEAR GRAYLING, MI"))?.id,"ausable");
});
test("Manistee monitors use the existing USGS river-network field map",()=>{
  const x=bridge.match(gauge("MANISTEE RIVER NEAR SHERMAN, MI",44.6,-85.3));
  assert.equal(x?.url,"https://chrisizworski.com/manistee-river-map/");
  assert.match(x.description,/USGS river-network distance/);
});
test("unverified geography and similarly named out-of-state rivers do not hand off",()=>{
  assert.equal(bridge.match(gauge("AUSABLE RIVER NEAR SOMEWHERE",42,-83)),null);
  assert.equal(bridge.match(gauge("MANISTEE RIVER",44,-90)),null);
  assert.equal(bridge.match({name:"AUSABLE RIVER"}),null);
  assert.equal(bridge.match(gauge("PINE RIVER NEAR MANISTEE MI",44.5,-85.5)),null);
  assert.equal(bridge.match(gauge("SAGINAW RIVER",43.5,-83.9)),null);
});
test("national river conditions hand to specialist tools without copying route arrays",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../public/national-tools/rivers/index.html"),"utf8");
  assert.match(html,/canonical" href="https:\/\/chrisizworski\.com\/national-tools\/rivers\/"/);
  assert.match(html,/river-specialist-handoff\.js/);
  assert.match(html,/RiverSpecialistHandoff\.render\(first/);
  assert.match(html,/https:\/\/ausable\.chrisizworski\.com\//);
  assert.match(html,/https:\/\/chrisizworski\.com\/manistee-river-map\//);
  assert.match(html,/michigan-rivers-field-guide/);
  assert.doesNotMatch(html,/paddle-trip-catalog|paddle-route-pilot|paddle-trip-pilot/);
  assert.match(html,/id="river-expert-handoff"/);
  const source=fs.readFileSync(path.join(__dirname,"../public/assets/river-specialist-handoff.js"),"utf8");
  assert.doesNotMatch(source,/routeGraph\(|distanceMiles:|floatTime:|accessPoints:\s*\[/);
});
