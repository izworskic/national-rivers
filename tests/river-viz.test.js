const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const viz = require("../public/assets/river-viz.js");

test("flow chart places measurements by observation time, not array index", () => {
  const model = viz.flowModel([
    { time: "2026-11-20T00:00:00Z", value: 100 },
    { time: "2026-11-20T01:00:00Z", value: 125 },
    { time: "2026-11-20T04:00:00Z", value: 175 },
    { time: "2026-11-20T06:00:00Z", value: 160 }
  ]);
  assert.ok(model);
  assert.equal(model.count, 4);
  assert.equal(model.last.value, 160);
  assert.equal(model.low, 100);
  assert.equal(model.high, 175);
  assert.equal(model.gaps, 0);
  assert.ok(model.path.includes("L"));
  assert.ok(model.last.x > model.left);
});

test("chart refuses absent observations, invalid values and fabricated continuation", () => {
  assert.equal(viz.flowModel([]), null);
  assert.equal(viz.flowModel([{ time: "2026-11-20T00:00:00Z", value: 7 }]), null);
  assert.equal(viz.flowModel([{ time: "2026-11-20T00:00:00Z", value: -10 }, { time: "2026-11-20T01:00:00Z", value: 8 }]), null);
  const model = viz.flowModel([
    { time: "2026-11-19T00:00:00Z", value: 200 },
    { time: "2026-11-19T01:00:00Z", value: 230 },
    { time: "2026-11-19T20:00:00Z", value: 270 },
    { time: "2026-11-19T21:00:00Z", value: 280 }
  ]);
  assert.equal(model.gaps, 1);
  assert.equal((model.path.match(/M/g) || []).length, 2);
});

test("historical scale uses only ordered USGS same-date percentile observations", () => {
  const stats = { p10: 100, p25: 150, p50: 200, p75: 300, p90: 400 };
  const model = viz.historicalModel(stats, 650);
  assert.ok(model);
  assert.ok(model.positions.observed > model.positions.p90);
  assert.ok(model.positions.p10 < model.positions.p25);
  assert.ok(model.positions.p25 < model.positions.p50);
  assert.ok(model.positions.p50 < model.positions.p75);
  assert.ok(model.positions.p75 < model.positions.p90);
  assert.equal(viz.historicalModel({ ...stats, p50: 500 }, 250), null);
  assert.equal(viz.historicalModel(stats, null), null);
  assert.equal(viz.historicalModel(null, 250), null);
});

test("river experience keeps canonical, source selection, status and useful fallback", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/national-tools/rivers/index.html"), "utf8");
  assert.match(html, /id="river-field-station-experience"/);
  assert.match(html, /\/assets\/river-viz\.js/);
  assert.match(html, /river-flow-history/);
  assert.match(html, /river-historical-band/);
  assert.match(html, /data-river-example/);
  assert.match(html, /No substitute river value was generated/);
  assert.match(html, /data-site-id/);
  assert.match(html, /Live readings do not load until you make that choice/);
  assert.match(html, /canonical" href="https:\/\/chrisizworski\.com\/national-tools\/rivers\/"/);
  assert.match(html, /#person/);
  assert.match(html, /waterdata\.usgs\.gov/);
  assert.match(html, /Google Maps \(gauge area, not an access point\)/);
});
