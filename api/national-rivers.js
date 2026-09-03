const {
  finite,
  freshness,
  sourceMeta,
} = require("@izworskic/national-outdoor-core");
const siteIndex = require("../public/data/national-usgs-streamflow-sites.json");

const CONTINUOUS = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items";
const UA = "ChrisIzworskiNationalRiverConditions/6.0 (+https://chrisizworski.com/national-tools/rivers/)";
const PARAMETERS = Object.freeze({
  discharge: "00060",
  gageHeight: "00065",
  waterTemperature: "00010",
  turbidity: "63680",
  dissolvedOxygen: "00300",
  specificConductance: "00095",
  ph: "00400",
});

function haversine(a, b, c, d) {
  const r = 3958.7613;
  const toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(c - a);
  const dLon = toRad(d - b);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(q));
}
function indexedSitesByDistance(lat, lon) {
  const sites = Array.isArray(siteIndex?.sites) ? siteIndex.sites : [];
  return sites
    .map((site) => ({
      id: site.id,
      name: site.name,
      latitude: finite(site.latitude, -90, 90),
      longitude: finite(site.longitude, -180, 180),
      distance_miles: haversine(lat, lon, Number(site.latitude), Number(site.longitude)),
    }))
    .filter((site) => site.id && site.latitude != null && site.longitude != null && Number.isFinite(site.distance_miles))
    .sort((a, b) => a.distance_miles - b.distance_miles);
}
function nearestSites(lat, lon, limit = 10) {
  return indexedSitesByDistance(lat, lon)
    .slice(0, Math.max(1, Math.min(300, Number(limit) || 10)));
}
function riverName(siteName) {
  const clean = String(siteName || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Unnamed monitored waterway";
  const base = clean.split(/\s+(?:AT|NEAR|NR|BELOW|ABOVE|BLW|ABV|UPSTREAM|DOWNSTREAM)\s+/i)[0] || clean;
  return base.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}
function discoveryRivers(lat, lon, radiusMiles = 50, limit = 200) {
  const radius = finite(radiusMiles, 10, 100) ?? 50;
  const all = indexedSitesByDistance(lat, lon).filter((site) => site.distance_miles <= radius);
  const sites = all.slice(0, Math.max(1, Math.min(300, Number(limit) || 200)));
  const groups = new Map();
  for (const site of sites) {
    const label = riverName(site.name);
    const key = label.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, name: label, gauges: [], closest_distance_miles: site.distance_miles });
    const group = groups.get(key);
    group.gauges.push(site);
    group.closest_distance_miles = Math.min(group.closest_distance_miles, site.distance_miles);
  }
  return {
    radius_miles: radius,
    total_sites_in_radius: all.length,
    returned_sites: sites.length,
    truncated: all.length > sites.length,
    rivers: [...groups.values()]
      .map((group) => ({
        ...group,
        gauge_count: group.gauges.length,
        gauges: group.gauges.sort((a, b) => a.distance_miles - b.distance_miles),
      }))
      .sort((a, b) => a.closest_distance_miles - b.closest_distance_miles),
  };
}
function indexedSite(siteId, lat, lon) {
  const id = String(siteId || "").trim();
  if (!/^\d{5,15}$/.test(id)) return null;
  const raw = (Array.isArray(siteIndex?.sites) ? siteIndex.sites : []).find((site) => String(site.id) === id);
  if (!raw) return null;
  const latitude = finite(raw.latitude, -90, 90), longitude = finite(raw.longitude, -180, 180);
  if (latitude == null || longitude == null) return null;
  return {
    id: raw.id,
    name: raw.name,
    latitude,
    longitude,
    distance_miles: haversine(lat, lon, latitude, longitude),
  };
}
async function fetchJson(url, timeoutMs = 2500, options = {}) {
  const headers = { accept: "application/json", "user-agent": UA, ...(options.headers || {}) };
  if (process.env.USGS_API_KEY && new URL(url).hostname === "api.waterdata.usgs.gov") {
    headers["X-Api-Key"] = process.env.USGS_API_KEY;
  }
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  const type = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  if (!type.includes("json")) throw new Error(`${new URL(url).hostname} returned non-JSON content`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${new URL(url).hostname} returned invalid JSON`);
  }
}
const PARAMETER_DESCRIPTIONS = Object.freeze({
  "00060": "Discharge",
  "00065": "Gage height",
  "00010": "Temperature, water",
  "63680": "Turbidity",
  "00300": "Dissolved oxygen",
  "00095": "Specific conductance",
  "00400": "pH",
});
function normalizeQualifiers(value, approvalStatus = null) {
  const qualifiers = Array.isArray(value) ? value : value ? [value] : [];
  if (approvalStatus === "Provisional") qualifiers.push("P");
  if (approvalStatus === "Approved") qualifiers.push("A");
  return [...new Set(qualifiers.map(String).filter(Boolean))];
}
function modernTimeSeries(payload) {
  if (Array.isArray(payload?.value?.timeSeries)) return payload.value.timeSeries;
  const grouped = new Map();
  for (const feature of payload?.features || []) {
    const row = feature?.properties || {};
    const id = String(row.monitoring_location_id || "").replace(/^USGS-/, "");
    const parameter = String(row.parameter_code || "");
    const time = row.time;
    const value = finite(row.value);
    if (!/^\d{5,15}$/.test(id) || !/^\d{5}$/.test(parameter) || value == null || !Date.parse(time || "")) continue;
    const seriesId = row.time_series_id || row.timeseries_id || "";
    const key = `${id}|${parameter}|${seriesId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        sourceInfo: { siteCode: [{ value: id }] },
        variable: {
          variableCode: [{ value: parameter }],
          variableDescription: PARAMETER_DESCRIPTIONS[parameter] || null,
          unit: { unitCode: row.unit_of_measure || null },
        },
        values: [{ value: [] }],
      });
    }
    grouped.get(key).values[0].value.push({
      value: String(row.value),
      dateTime: time,
      qualifiers: normalizeQualifiers(row.qualifier, row.approval_status),
    });
  }
  return [...grouped.values()].map((series) => {
    series.values[0].value.sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
    return series;
  });
}
function code(series) {
  return series.variable?.variableCode?.[0]?.value || null;
}
function unit(series) {
  return series.variable?.unit?.unitCode || series.variable?.unit?.unitAbbreviation || null;
}
function description(series) {
  return series.variable?.variableDescription || null;
}
function siteId(series) {
  return series.sourceInfo?.siteCode?.[0]?.value || null;
}
function validPoints(series) {
  return (series.values?.[0]?.value || [])
    .map((point) => ({ value: finite(point.value), time: point.dateTime, qualifiers: point.qualifiers || [] }))
    .filter((point) => point.value != null && point.value !== -999999 && Date.parse(point.time));
}
function atAgo(points, hours, referenceTime = null) {
  if (!points.length) return null;
  const reference = Date.parse(referenceTime || points.at(-1)?.time || "");
  if (!Number.isFinite(reference)) return null;
  const target = reference - hours * 3600000;
  return points.reduce((best, point) =>
    !best || Math.abs(Date.parse(point.time) - target) < Math.abs(Date.parse(best.time) - target) ? point : best, null);
}
function sampleSeries(points, maxPoints = 32, transform = (value) => value) {
  const normalized = points.map((point) => ({ time: point.time, value: transform(point.value) }))
    .filter((point) => Number.isFinite(point.value));
  if (normalized.length <= maxPoints) return normalized;
  const step = Math.ceil(normalized.length / maxPoints);
  return normalized.filter((_, index) => index % step === 0 || index === normalized.length - 1);
}
function changePercent(current, prior) {
  const a = finite(current), b = finite(prior);
  if (a == null || b == null || b === 0) return null;
  return Math.round(((a - b) / Math.abs(b)) * 100);
}
function changeAbsolute(current, prior, decimals = 2) {
  const a = finite(current), b = finite(prior);
  if (a == null || b == null) return null;
  const factor = 10 ** decimals;
  return Math.round((a - b) * factor) / factor;
}
function toFahrenheit(value, unitCode) {
  const n = finite(value);
  if (n == null) return null;
  const u = String(unitCode || "").toLowerCase();
  if (u.includes("deg f") || u === "f" || u.includes("fahrenheit")) return Math.round(n * 10) / 10;
  return Math.round((n * 9 / 5 + 32) * 10) / 10;
}
function sensorSummary(series, options = {}) {
  const points = validPoints(series);
  if (!points.length) return null;
  const transform = options.transform || ((value) => value);
  const converted = points.map((point) => ({ ...point, converted: transform(point.value) }))
    .filter((point) => Number.isFinite(point.converted));
  if (!converted.length) return null;
  const last = converted.at(-1);
  const prior = atAgo(converted.map((point) => ({ value: point.converted, time: point.time })), 24, last.time);
  const values = converted.map((point) => point.converted);
  const summary = {
    value: last.converted,
    unit: options.unit || unit(series),
    measured_at: last.time,
    description: description(series),
    min_24h: Math.min(...values),
    max_24h: Math.max(...values),
    change_24h: changeAbsolute(last.converted, prior?.value, options.decimals ?? 2),
    series_24h: sampleSeries(points, 32, transform),
  };
  if (options.percentChange) summary.change_percent_24h = changePercent(last.converted, prior?.value);
  return summary;
}
function trendLabel(percent) {
  const value = finite(percent);
  if (value == null) return "Trend unavailable";
  if (Math.abs(value) < 3) return "Roughly steady";
  return value > 0 ? "Rising" : "Falling";
}
function normalize(payload, sites) {
  const by = new Map(sites.map((site) => [site.id, {
    ...site,
    discharge_cfs: null,
    gage_height_ft: null,
    water_temp_f: null,
    measured_at: null,
    flow_6h_ago: null,
    flow_24h_ago: null,
    trend_percent_6h: null,
    trend_percent_24h: null,
    gage_height_change_24h_ft: null,
    flow_series_24h: [],
    stage_series_24h: [],
    sensors: {
      water_temperature: null,
      turbidity: null,
      dissolved_oxygen: null,
      specific_conductance: null,
      ph: null,
    },
    qualifiers: [],
  }]));

  for (const series of modernTimeSeries(payload)) {
    const id = siteId(series);
    if (!by.has(id)) continue;
    const points = validPoints(series);
    if (!points.length) continue;
    const last = points.at(-1);
    const gauge = by.get(id);
    if (!gauge.measured_at || Date.parse(last.time) > Date.parse(gauge.measured_at)) gauge.measured_at = last.time;
    const parameter = code(series);

    if (parameter === PARAMETERS.discharge) {
      gauge.discharge_cfs = last.value;
      const old6 = atAgo(points, 6, last.time);
      const old24 = atAgo(points, 24, last.time);
      gauge.flow_6h_ago = old6?.value ?? null;
      gauge.flow_24h_ago = old24?.value ?? null;
      gauge.trend_percent_6h = changePercent(last.value, old6?.value);
      gauge.trend_percent_24h = changePercent(last.value, old24?.value);
      gauge.flow_series_24h = sampleSeries(points);
    }
    if (parameter === PARAMETERS.gageHeight) {
      gauge.gage_height_ft = last.value;
      const old24 = atAgo(points, 24, last.time);
      gauge.gage_height_change_24h_ft = changeAbsolute(last.value, old24?.value, 2);
      gauge.stage_series_24h = sampleSeries(points);
    }
    if (parameter === PARAMETERS.waterTemperature) {
      const summary = sensorSummary(series, { transform: (value) => toFahrenheit(value, unit(series)), unit: "°F", decimals: 1 });
      gauge.sensors.water_temperature = summary;
      gauge.water_temp_f = summary?.value ?? null;
    }
    if (parameter === PARAMETERS.turbidity) {
      gauge.sensors.turbidity = sensorSummary(series, { percentChange: true, decimals: 2 });
    }
    if (parameter === PARAMETERS.dissolvedOxygen) {
      gauge.sensors.dissolved_oxygen = sensorSummary(series, { decimals: 2 });
    }
    if (parameter === PARAMETERS.specificConductance) {
      gauge.sensors.specific_conductance = sensorSummary(series, { decimals: 1 });
    }
    if (parameter === PARAMETERS.ph) {
      gauge.sensors.ph = sensorSummary(series, { decimals: 2 });
    }
    gauge.qualifiers = [...new Set([...gauge.qualifiers, ...last.qualifiers])];
  }

  return [...by.values()]
    .filter((gauge) => gauge.discharge_cfs != null)
    .map((gauge) => {
      const age = freshness(gauge.measured_at, 180);
      const availableSensors = Object.entries(gauge.sensors)
        .filter(([, value]) => value)
        .map(([key]) => key);
      return {
        ...gauge,
        ...age,
        fresh: age.status === "current",
        provisional: true,
        trend_label: trendLabel(gauge.trend_percent_6h),
        sensor_availability: availableSensors,
        historical_daily_flow: null,
        historical_comparison: {
          label: "Historical comparison loading",
          code: "unknown",
          confidence: "low",
        },
        nwps: null,
      };
    });
}
async function observations(sites, parameterCodes = Object.values(PARAMETERS), timeoutMs = 2600) {
  if (!sites.length) return [];
  const end = new Date();
  const start = new Date(end.getTime() - 25 * 3600000);
  const url = new URL(CONTINUOUS);
  url.searchParams.set("f", "json");
  url.searchParams.set("limit", "10000");
  url.searchParams.set("properties", "time_series_id,monitoring_location_id,parameter_code,time,value,unit_of_measure,approval_status,qualifier");
  const query = {
    op: "and",
    args: [
      { op: "in", args: [{ property: "monitoring_location_id" }, sites.map((site) => `USGS-${site.id}`)] },
      { op: "in", args: [{ property: "parameter_code" }, parameterCodes] },
      { op: "between", args: [{ property: "time" }, [start.toISOString(), end.toISOString()]] },
    ],
  };
  const payload = await fetchJson(url, timeoutMs, {
    method: "POST",
    headers: { "content-type": "application/query-cql-json" },
    body: JSON.stringify(query),
  });
  return normalize(payload, sites);
}
function mergeEnrichment(core, enrichment) {
  const byId = new Map((enrichment || []).map((gauge) => [gauge.id, gauge]));
  return (core || []).map((gauge) => {
    const extra = byId.get(gauge.id);
    if (!extra) return gauge;
    return {
      ...gauge,
      water_temp_f: extra.water_temp_f,
      sensors: extra.sensors,
      sensor_availability: extra.sensor_availability,
    };
  });
}
async function loadObservations(sites) {
  const coreSites = sites.slice(0, 6);
  const sensorSites = sites.slice(0, 3);
  const coreParameters = [PARAMETERS.discharge, PARAMETERS.gageHeight];
  const [core, enrichment] = await Promise.allSettled([
    observations(coreSites, coreParameters, 2600),
    observations(sensorSites, Object.values(PARAMETERS), 2200),
  ]);

  if (core.status === "fulfilled") {
    const gauges = enrichment.status === "fulfilled"
      ? mergeEnrichment(core.value, enrichment.value)
      : core.value;
    return {
      gauges,
      degraded: enrichment.status !== "fulfilled",
      detail: enrichment.status === "rejected"
        ? "Core USGS flow/stage observations loaded; optional sensor enrichment is temporarily unavailable."
        : null,
    };
  }
  if (enrichment.status === "fulfilled") {
    return {
      gauges: enrichment.value,
      degraded: true,
      detail: "The broader USGS core request failed; a reduced nearest-gauge response is being shown.",
    };
  }
  return {
    gauges: [],
    degraded: true,
    detail: "Live USGS observations are temporarily unavailable. No substitute flow or stage values were generated.",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const lat = finite(req.query?.lat, -90, 90);
  const lon = finite(req.query?.lon, -180, 180);
  if (lat == null || lon == null) return res.status(400).json({ error: "Valid latitude and longitude are required" });

  const mode = String(req.query?.mode || "").toLowerCase();
  if (mode === "discovery") {
    const discovery = discoveryRivers(lat, lon, req.query?.radius, req.query?.limit);
    return res.status(200).json({
      retrieved_at: new Date().toISOString(),
      mode: "river-discovery",
      location: { latitude: lat, longitude: lon },
      ...discovery,
      discovery_index: {
        generated_at: siteIndex.generated_at || null,
        site_count: finite(siteIndex.site_count),
        source_name: siteIndex.source_name || "USGS monitoring-location inventory",
        source_url: siteIndex.source_url || "https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations",
      },
      sources: [
        sourceMeta({
          name: "USGS monitoring-location inventory — active instantaneous streamflow stations",
          url: siteIndex.source_url || "https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations",
          updatedAt: siteIndex.generated_at || null,
          available: discovery.returned_sites > 0,
          status: "nearby monitored-river discovery",
        }),
      ],
      disclaimer: "This is a discovery list of nearby rivers and streams with active USGS instantaneous streamflow monitoring, not a list of every mapped waterway. Choose a river and monitoring point before live readings are requested.",
    });
  }

  try {
    const requestedSite = indexedSite(req.query?.site, lat, lon);
    if (req.query?.site && !requestedSite) return res.status(404).json({ error: "Requested USGS monitoring site was not found in the active streamflow index" });
    const sites = requestedSite ? [requestedSite] : nearestSites(lat, lon, 6);
    const live = await loadObservations(sites);
    const gauges = live.gauges;
    if (live.degraded) res.setHeader("Cache-Control", gauges.length ? "public, s-maxage=60, stale-while-revalidate=180" : "no-store");
    const now = new Date().toISOString();
    const newestObserved = gauges.map((gauge) => gauge.measured_at).filter(Boolean).sort().at(-1) || null;
    return res.status(200).json({
      retrieved_at: now,
      degraded: live.degraded,
      degraded_reason: live.detail,
      context_pending: Boolean(gauges.length),
      mode: requestedSite ? "selected-river-detail" : "nearest-live-summary",
      selected_site: requestedSite ? { id: requestedSite.id, river_name: riverName(requestedSite.name) } : null,
      discovery: "Local USGS active-streamflow site index + exact-site instantaneous values",
      discovery_index: {
        generated_at: siteIndex.generated_at || null,
        site_count: finite(siteIndex.site_count),
        source_name: siteIndex.source_name || "USGS Site Service",
        source_url: siteIndex.source_url || "https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations",
      },
      location: { latitude: lat, longitude: lon },
      gauges,
      sources: [
        sourceMeta({
          name: "USGS Water Data for the Nation — instantaneous values",
          url: "https://waterdata.usgs.gov/",
          updatedAt: newestObserved,
          staleAfterMinutes: 180,
          available: Boolean(gauges.length),
          status: live.degraded
            ? (gauges.length ? "core observations available; optional USGS enrichment degraded" : "USGS live observations unavailable")
            : "provisional flow, stage and available water-quality observations",
        }),
      ],
      disclaimer: "Nearest-gauge discovery uses a periodically refreshed index of active USGS streamflow sites; displayed readings are fetched live from USGS by exact site ID and remain provisional. Water temperature, turbidity, dissolved oxygen, conductivity and pH appear only where the selected gauge actually reports those parameters. Historical percentiles, weather and NOAA river forecast context load separately. No gauge reading or derived lens can determine whether paddling, swimming, wading, fishing, or boating is safe.",
    });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    const detail = String(error?.message || error).slice(0, 240);
    return res.status(502).json({
      error: "River observations unavailable from USGS · " + detail,
      detail,
    });
  }
};

module.exports._test = {
  PARAMETERS,
  atAgo,
  changeAbsolute,
  changePercent,
  discoveryRivers,
  haversine,
  indexedSite,
  indexedSitesByDistance,
  loadObservations,
  mergeEnrichment,
  modernTimeSeries,
  nearestSites,
  normalize,
  riverName,
  sampleSeries,
  sensorSummary,
  toFahrenheit,
  trendLabel,
};
