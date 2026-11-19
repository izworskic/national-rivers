const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../public/assets/paddle-window.js");
const now = Date.parse("2027-04-17T13:00:00Z");

function gauge(changes={}) {
  return {
    id:"04142000", measured_at:"2027-04-17T12:30:00Z",
    discharge_cfs:600, gage_height_ft:4.1, trend_percent_6h:2,
    water_temp_f:43,
    historical_daily_flow:{p10:200,p25:400,p50:550,p75:800,p90:1000},
    nwps:{observed_category:"Below Action Stage",forecast_crest_category:"Below Action Stage"},
    ...changes
  };
}
test("below action stage is not mistaken for official flood status",()=>{
  const d=engine.assess(gauge(),null,now);
  assert.equal(d.key,"TYPICAL_FLOW");
  assert.equal(d.verifiedForPaddling,false);
  assert.match(d.title,/typical middle range/i);
  assert.ok(d.mustVerify.some(x=>/put-in and takeout/i.test(x)));
});
test("official action or flood stage overrides ordinary flow",()=>{
  const d=engine.assess(gauge({nwps:{observed_category:"Minor Flood"}}),null,now);
  assert.equal(d.key,"OFFICIAL_HIGH_WATER");
  assert.match(d.title,/do not treat/i);
});
test("future NOAA flood forecast is a high-water checkpoint",()=>{
  const d=engine.assess(gauge({nwps:{observed_category:"Below Action Stage",forecast_crest_category:"Action"}}),null,now);
  assert.equal(d.key,"OFFICIAL_HIGH_WATER");
});
test("stale and missing USGS discharge withhold an activity interpretation",()=>{
  assert.equal(engine.assess(gauge({measured_at:"2027-04-16T00:00:00Z"}),null,now).key,"READING_UNAVAILABLE");
  assert.equal(engine.assess(gauge({discharge_cfs:null}),null,now).key,"READING_UNAVAILABLE");
});
test("unusually high and low flow use actual same-date percentiles",()=>{
  assert.equal(engine.assess(gauge({discharge_cfs:1200}),null,now).key,"HIGH_FLOW");
  assert.equal(engine.assess(gauge({discharge_cfs:100}),null,now).key,"LOW_FLOW");
  assert.equal(engine.assess(gauge({historical_daily_flow:null}),null,now).key,"UNVERIFIED");
});
test("no ranking or safety claim is issued without route evidence",()=>{
  const d=engine.assess(gauge(),{next_24h:{max_precip_probability:75}},now);
  assert.equal(d.verifiedForPaddling,false);
  assert.ok(!/safe to paddle|go float|route is open/i.test(JSON.stringify(d)));
  assert.ok(d.evidence.some(x=>/75%/.test(x)));
});
test("the original river canonical and selected-site flow remain intact",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../public/national-tools/rivers/index.html"),"utf8");
  assert.match(html,/canonical" href="https:\/\/chrisizworski\.com\/national-tools\/rivers\/"/);
  assert.match(html,/assets\/paddle-window\.js/);
  assert.match(html,/renderPaddleCheckpoint\(first,d\.weather\)/);
  assert.match(html,/Choose monitoring point/);
  assert.match(html,/Open in OpenStreetMap/);
});
