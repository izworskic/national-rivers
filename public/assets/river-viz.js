(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RiverFlowViz = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const MAX_FLOW = 10000000;
  const numeric = value => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= MAX_FLOW ? n : null;
  };
  function flowModel(series) {
    if (!Array.isArray(series)) return null;
    const byTime = new Map();
    for (const item of series) {
      const value = numeric(item && item.value);
      const time = Date.parse(item && item.time || "");
      if (value !== null && Number.isFinite(time)) byTime.set(time, value);
    }
    const observations = [...byTime].sort((a, b) => a[0] - b[0]).slice(-288);
    if (observations.length < 2) return null;
    const start = observations[0][0], end = observations[observations.length - 1][0];
    if (end <= start) return null;
    const values = observations.map(p => p[1]);
    const observedLow = Math.min(...values), observedHigh = Math.max(...values);
    const spread = Math.max(observedHigh - observedLow, observedHigh * 0.025, 1);
    const min = Math.max(0, observedLow - spread * 0.18);
    const max = observedHigh + spread * 0.18;
    const W = 720, H = 210, left = 58, right = 18, top = 18, bottom = 34;
    const x = t => left + (t - start) / (end - start) * (W - left - right);
    const y = value => top + (max - value) / (max - min) * (H - top - bottom);
    const intervals = observations.slice(1).map((p, i) => p[0] - observations[i][0]);
    const medianInterval = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
    const breakAfter = Math.min(6 * 3600000, Math.max(3 * 3600000, medianInterval * 3));
    let gaps = 0;
    const path = observations.map((p, i) => {
      const broken = i > 0 && p[0] - observations[i - 1][0] > breakAfter;
      if (broken) gaps++;
      return (i === 0 || broken ? "M" : "L") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1);
    }).join(" ");
    const first = observations[0], last = observations[observations.length - 1];
    return {
      path, first: { time: first[0], value: first[1] },
      last: { time: last[0], value: last[1], x: x(last[0]), y: y(last[1]) },
      start, end, low: observedLow, high: observedHigh,
      axisLow: min, axisHigh: max, gaps, count: observations.length,
      width: W, height: H, left, right, top, bottom
    };
  }
  function historicalModel(stats, observed) {
    const value = numeric(observed);
    if (!stats || value === null) return null;
    const keys = ["p10", "p25", "p50", "p75", "p90"];
    const values = keys.map(key => numeric(stats[key]));
    if (values.some(v => v === null) || values.some((v, i) => i > 0 && v < values[i - 1])) return null;
    const bottom = Math.min(value, values[0]), upper = Math.max(value, values[4]);
    const padding = Math.max(1, (upper - bottom) * 0.08);
    const min = Math.max(0, bottom - padding), max = upper + padding;
    if (max <= min) return null;
    const pct = v => Number(((v - min) / (max - min) * 100).toFixed(3));
    return {
      observed: value, min, max, p10: values[0], p25: values[1],
      p50: values[2], p75: values[3], p90: values[4],
      positions: {
        observed: pct(value), p10: pct(values[0]), p25: pct(values[1]),
        p50: pct(values[2]), p75: pct(values[3]), p90: pct(values[4])
      }
    };
  }
  return { flowModel, historicalModel };
});
