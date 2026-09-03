const {
  finite,
  forecastCrest,
  nwpsCategory,
  sourceMeta,
} = require("@izworskic/national-outdoor-core");

const STAT = "https://api.waterdata.usgs.gov/statistics/v0/observationNormals";
const NWPS = "https://api.water.noaa.gov/nwps/v1";
const NWS = "https://api.weather.gov";
const UA = "ChrisIzworskiNationalRiverContext/3.0 (+https://chrisizworski.com/national-tools/rivers/)";

async function fetchJson(url, timeoutMs = 1800, options = {}) {
  const headers = { accept: "application/json", "user-agent": UA };
  if (process.env.USGS_API_KEY && new URL(url).hostname === "api.waterdata.usgs.gov") {
    headers["X-Api-Key"] = process.env.USGS_API_KEY;
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404 && options.allow404) return null;
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.json();
}
function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return trimmed.replace(/^\[|\]$/g, "").split(",").map((item) => item.trim().replace(/^["']|["']$/g, ""));
}
function statisticsRows(payload, depth = 0) {
  if (depth > 4 || payload == null) return [];
  if (Array.isArray(payload)) return payload.flatMap((item) => statisticsRows(item, depth + 1));
  if (typeof payload !== "object") return [];
  const row = payload.properties && typeof payload.properties === "object" ? payload.properties : payload;
  if (row.monitoring_location_id || row.monitoringLocationId) return [row];
  return Object.values(payload).flatMap((value) => statisticsRows(value, depth + 1));
}
function parseStatistics(payload, now = new Date()) {
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const dayKey = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const out = new Map();
  for (const row of statisticsRows(payload)) {
    const type = String(row.time_of_year_type || row.normal_type || "").toLowerCase();
    if (type && type !== "day_of_year" && type !== "doy") continue;
    if (row.time_of_year && String(row.time_of_year) !== dayKey) continue;
    const id = String(row.monitoring_location_id || row.monitoringLocationId || "").replace(/^USGS-/, "");
    if (!/^\d{5,15}$/.test(id)) continue;
    const percentiles = arrayValue(row.percentiles);
    const values = arrayValue(row.values);
    if (!percentiles.length || percentiles.length !== values.length) continue;
    const byPercentile = new Map(percentiles.map((percentile, index) => [Number(percentile), finite(values[index])]));
    const stats = {
      p10: byPercentile.get(10) ?? null,
      p25: byPercentile.get(25) ?? null,
      p50: byPercentile.get(50) ?? null,
      p75: byPercentile.get(75) ?? null,
      p90: byPercentile.get(90) ?? null,
      begin_year: null,
      end_year: null,
      count: finite(row.sample_count),
      month,
      day,
    };
    if ([stats.p10, stats.p25, stats.p50, stats.p75, stats.p90].every((value) => value != null)) out.set(id, stats);
  }
  return out;
}
async function dailyStatisticsForSite(id, now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const url = new URL(STAT);
  url.searchParams.set("monitoring_location_id", `USGS-${id}`);
  url.searchParams.set("parameter_code", "00060");
  url.searchParams.set("computation_type", "percentile");
  url.searchParams.set("normal_type", "DOY");
  url.searchParams.set("start_date", `${month}-${day}`);
  url.searchParams.set("end_date", `${month}-${day}`);
  url.searchParams.set("page_size", "100");
  return parseStatistics(await fetchJson(url, 2600), now);
}
async function dailyStatistics(ids, now = new Date()) {
  if (!ids.length) return new Map();
  const results = await Promise.allSettled(ids.map((id) => dailyStatisticsForSite(id, now)));
  const out = new Map();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const [id, stats] of result.value) out.set(id, stats);
  }
  if (!out.size && results.some((result) => result.status === "rejected")) {
    throw new Error("USGS statistics API unavailable for requested monitoring locations");
  }
  return out;
}
async function nwpsGaugeIndex(lat, lon) {
  const span = 2.4;
  const params = new URLSearchParams({
    "bbox.xmin": String(Math.max(-180, lon - span)),
    "bbox.ymin": String(Math.max(-90, lat - span)),
    "bbox.xmax": String(Math.min(180, lon + span)),
    "bbox.ymax": String(Math.min(90, lat + span)),
    srid: "EPSG_4326",
  });
  const data = await fetchJson(`${NWPS}/gauges?${params}`, 1800);
  return Array.isArray(data?.gauges) ? data.gauges : [];
}
function normalizeForecastTrend(points = []) {
  const valid = points
    .map((point) => ({
      time: point?.validTime || point?.valid_time || null,
      stage: finite(point?.primary ?? point?.stage),
      flow: finite(point?.secondary ?? point?.flow),
    }))
    .filter((point) => Date.parse(point.time || "") && (point.stage != null || point.flow != null));
  if (valid.length < 2) return { direction: "unknown", stage_change_ft: null, flow_change: null, first: valid[0] || null, last: valid.at(-1) || null };
  const first = valid[0], last = valid.at(-1);
  const stageChange = first.stage != null && last.stage != null ? Math.round((last.stage - first.stage) * 100) / 100 : null;
  const flowChange = first.flow != null && last.flow != null ? Math.round(last.flow - first.flow) : null;
  const basis = stageChange ?? (flowChange == null ? null : flowChange);
  const threshold = stageChange != null ? 0.1 : 1;
  const direction = basis == null ? "unknown" : Math.abs(basis) < threshold ? "roughly steady" : basis > 0 ? "rising" : "falling";
  return { direction, stage_change_ft: stageChange, flow_change: flowChange, first, last };
}
function normalizeNwps(metadata, forecast) {
  const observed = metadata?.status?.observed || {};
  const categories = metadata?.flood?.categories || {};
  const forecastPoints = Array.isArray(forecast?.data) ? forecast.data : [];
  const crest = forecastCrest(forecastPoints);
  return {
    lid: metadata?.lid || null,
    usgs_id: metadata?.usgsId || null,
    name: metadata?.name || null,
    official_url: metadata?.lid ? `https://water.noaa.gov/gauges/${String(metadata.lid).toLowerCase()}` : null,
    observed_stage_ft: finite(observed.primary),
    observed_at: observed.validTime || null,
    observed_category: nwpsCategory(observed.primary, categories),
    categories,
    forecast_available: Boolean(forecastPoints.length),
    forecast_crest: crest,
    forecast_crest_category: crest ? nwpsCategory(crest.stage, categories) : null,
    forecast_trend: normalizeForecastTrend(forecastPoints),
    impacts: Array.isArray(metadata?.flood?.impacts) ? metadata.flood.impacts.slice(0, 12) : [],
  };
}
async function nwpsContext(lat, lon, ids) {
  try {
    const index = await nwpsGaugeIndex(lat, lon);
    const byUsgs = new Map(index.filter((gauge) => gauge?.usgsId && gauge?.lid).map((gauge) => [String(gauge.usgsId), gauge]));
    const targets = ids.map((id) => ({ id, match: byUsgs.get(String(id)) })).filter((entry) => entry.match);
    const pairs = await Promise.all(targets.map(async ({ id, match }) => {
      try {
        const lid = match.lid;
        const [metadata, forecast] = await Promise.all([
          fetchJson(`${NWPS}/gauges/${encodeURIComponent(lid)}`, 1400),
          fetchJson(`${NWPS}/gauges/${encodeURIComponent(lid)}/stageflow/forecast`, 1400, { allow404: true }).catch(() => null),
        ]);
        return [id, normalizeNwps(metadata, forecast)];
      } catch {
        return [id, null];
      }
    }));
    return new Map(pairs);
  } catch {
    return new Map();
  }
}
function parseWindMph(value) {
  const nums = String(value || "").match(/\d+(?:\.\d+)?/g);
  if (!nums?.length) return null;
  return Math.max(...nums.map(Number).filter(Number.isFinite));
}
function weatherWindow(periods, hours) {
  const now = Date.now(), end = now + hours * 3600000;
  const list = (periods || []).filter((period) => {
    const time = Date.parse(period.startTime || "");
    return time >= now - 3600000 && time <= end;
  });
  const pops = list.map((period) => finite(period?.probabilityOfPrecipitation?.value, 0, 100)).filter((value) => value != null);
  const temps = list.map((period) => finite(period.temperature)).filter((value) => value != null);
  const winds = list.map((period) => parseWindMph(period.windSpeed)).filter((value) => value != null);
  const likely = list.find((period) => finite(period?.probabilityOfPrecipitation?.value, 0, 100) >= 50);
  const phrases = [...new Set(list.map((period) => period.shortForecast).filter(Boolean))].slice(0, 4);
  return {
    hours,
    max_precip_probability: pops.length ? Math.max(...pops) : null,
    first_50pct_precip_at: likely?.startTime || null,
    min_air_temp_f: temps.length ? Math.min(...temps) : null,
    max_air_temp_f: temps.length ? Math.max(...temps) : null,
    max_wind_mph: winds.length ? Math.max(...winds) : null,
    forecast_phrases: phrases,
  };
}
async function weatherContext(lat, lon) {
  const point = await fetchJson(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`, 1500);
  const hourlyUrl = point?.properties?.forecastHourly;
  if (!hourlyUrl) return null;
  const hourly = await fetchJson(hourlyUrl, 1800);
  const periods = Array.isArray(hourly?.properties?.periods) ? hourly.properties.periods : [];
  return {
    updated_at: hourly?.properties?.updateTime || null,
    time_zone: point?.properties?.timeZone || null,
    next_24h: weatherWindow(periods, 24),
    next_48h: weatherWindow(periods, 48),
  };
}
function validSiteIds(value) {
  return [...new Set(String(value || "").split(",").map((id) => id.trim()).filter((id) => /^\d{5,15}$/.test(id)))].slice(0, 6);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1200");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lat = finite(req.query?.lat, -90, 90);
  const lon = finite(req.query?.lon, -180, 180);
  const ids = validSiteIds(req.query?.sites);
  if (lat == null || lon == null || !ids.length) {
    return res.status(400).json({ error: "Valid latitude, longitude and USGS site IDs are required" });
  }

  const [statsResult, nwpsResult, weatherResult] = await Promise.allSettled([
    dailyStatistics(ids),
    nwpsContext(lat, lon, ids),
    weatherContext(lat, lon),
  ]);
  const stats = statsResult.status === "fulfilled" ? statsResult.value : new Map();
  const nwps = nwpsResult.status === "fulfilled" ? nwpsResult.value : new Map();
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;

  const context = {};
  for (const id of ids) {
    const historical = stats.get(id) || null;
    context[id] = {
      historical_daily_flow: historical,
      historical_comparison: historical ? null : {
        label: "Historical comparison unavailable",
        code: "unknown",
        confidence: "low",
      },
      nwps: nwps.get(id) || null,
    };
  }

  return res.status(200).json({
    retrieved_at: new Date().toISOString(),
    degraded: statsResult.status !== "fulfilled" || nwpsResult.status !== "fulfilled" || weatherResult.status !== "fulfilled",
    context,
    weather,
    historical: Object.fromEntries([...stats.entries()]),
    sources: [
      sourceMeta({
        name: "USGS approved daily statistics",
        url: "https://api.waterdata.usgs.gov/statistics/v0/docs",
        updatedAt: null,
        available: stats.size > 0,
        status: "historical climatology",
      }),
      sourceMeta({
        name: "NOAA National Water Prediction Service",
        url: "https://water.noaa.gov/",
        updatedAt: null,
        available: [...nwps.values()].some(Boolean),
        status: "official river forecast/flood context where matched",
      }),
      sourceMeta({
        name: "National Weather Service hourly forecast",
        url: "https://www.weather.gov/documentation/services-web-API",
        updatedAt: weather?.updated_at || null,
        available: Boolean(weather),
        status: "weather context near searched location",
      }),
    ],
  });
};

module.exports._test = {
  normalizeForecastTrend,
  normalizeNwps,
  parseStatistics,
  statisticsRows,
  parseWindMph,
  validSiteIds,
  weatherWindow,
};
