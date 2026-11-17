(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.PaddleWindow = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  function numeric(value, min, max) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  }
  function currentObservation(gauge, now) {
    const t = Date.parse(gauge?.measured_at || "");
    return Number.isFinite(t) && t <= now + 600000 && now - t <= 3 * 3600000;
  }
  function compareFlow(flow, stats) {
    if (flow === null || !stats) return "unknown";
    const p10 = numeric(stats.p10, 0, 10000000);
    const p25 = numeric(stats.p25, 0, 10000000);
    const p75 = numeric(stats.p75, 0, 10000000);
    const p90 = numeric(stats.p90, 0, 10000000);
    if ([p10,p25,p75,p90].some(n => n === null) || !(p10 <= p25 && p25 <= p75 && p75 <= p90)) return "unknown";
    if (flow > p90) return "very-high";
    if (flow > p75) return "high";
    if (flow < p10) return "very-low";
    if (flow < p25) return "low";
    return "typical";
  }
  function assess(gauge, weather = null, now = Date.now()) {
    const timestamp = typeof now === "number" ? now : Date.parse(now);
    const flow = numeric(gauge?.discharge_cfs, 0, 10000000);
    const fresh = currentObservation(gauge, timestamp);
    const stage = numeric(gauge?.gage_height_ft, -200, 1000);
    const comparison = fresh ? compareFlow(flow, gauge?.historical_daily_flow) : "unknown";
    const flood = String(gauge?.nwps?.observed_category || "");
    const crestFlood = String(gauge?.nwps?.forecast_crest_category || "");
    const elevated = category => /^(?:Action|Minor Flood|Moderate Flood|Major Flood)$/i.test(category.trim());
    const officialHigh = elevated(flood) || elevated(crestFlood);
    const next24 = weather?.next_24h || null;
    const rain = numeric(next24?.max_precip_probability, 0, 100);
    const temp = numeric(gauge?.water_temp_f ?? gauge?.sensors?.water_temperature?.value, -5, 110);
    const rise = numeric(gauge?.trend_percent_6h, -100, 10000);
    let key = "UNVERIFIED", title = "River conditions need a closer look";
    let explanation = "A monitoring point cannot establish whether this reach is navigable or safe to paddle.";
    if (officialHigh) {
      key = "OFFICIAL_HIGH_WATER";
      title = "Official high-water status: do not treat this as a float recommendation";
      explanation = "NOAA reports an action or flood category at a matched gauge now or in the available crest forecast. Review official warnings and local closures.";
    } else if (!fresh || flow === null) {
      key = "READING_UNAVAILABLE";
      title = "Current river flow is unverified";
      explanation = "Recent USGS streamflow is unavailable. Do not substitute an old reading or a nearby station as a float verdict.";
    } else if (comparison === "very-high" || comparison === "high") {
      key = "HIGH_FLOW";
      title = "Higher-than-usual flow for this date";
      explanation = "The selected gauge exceeds its historical middle range for this date. Faster current and changing hazards require local verification.";
    } else if (comparison === "very-low" || comparison === "low") {
      key = "LOW_FLOW";
      title = "Lower-than-usual flow for this date";
      explanation = "Shallow sections and dragging may be concerns. Depth at a gauge does not establish passability along a route.";
    } else if (comparison === "typical") {
      key = "TYPICAL_FLOW";
      title = "Flow is within its typical middle range";
      explanation = "Typical flow is not an approval to launch. Confirm the actual reach, obstacles, water temperature, and legal accesses.";
    }
    const evidence = [
      fresh && flow !== null ? "Measured discharge: " + Math.round(flow).toLocaleString() + " cubic feet per second" : "Fresh discharge: unavailable",
      fresh && stage !== null ? "Gauge stage: " + stage.toFixed(2) + " feet" : "Gauge stage: not verified here",
      "Same-date flow comparison: " + comparison.replaceAll("-", " "),
      flood ? "NOAA observed category: " + flood : "NOAA flood category: not matched",
      rain === null ? "Next 24 hours: rainfall chance unavailable" : "Next 24 hours: precipitation chance up to " + Math.round(rain) + "%",
      temp === null ? "Water temperature: not reported" : "Water temperature: " + temp.toFixed(1) + " °F",
      rise === null ? "Six-hour flow trend: unavailable" : "Six-hour flow change: " + rise.toFixed(0) + "%",
    ];
    return {
      key, title, explanation, evidence, verifiedForPaddling: false,
      mustVerify: [
        "Public put-in and takeout, with posted hours and parking rules",
        "Current closures, upstream dam releases, portages, strainers and obstructions",
        "Cold-water immersion protection and the group's ability",
        "Weather and official flood alerts for the whole route",
      ],
      officialNoaaUrl: /^https:\/\/water\.noaa\.gov\/gauges\/[a-z0-9-]+$/i.test(gauge?.nwps?.official_url || "") ? gauge.nwps.official_url : null,
      sourceUsgsUrl: /^[0-9]{5,15}$/.test(String(gauge?.id || "")) ?
        "https://waterdata.usgs.gov/monitoring-location/" + gauge.id + "/" : null,
    };
  }
  return {assess, compareFlow, currentObservation};
});
