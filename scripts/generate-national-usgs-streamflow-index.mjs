#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LATEST = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items";
const UA = "ChrisIzworskiNationalRiverIndex/2.0 (+https://chrisizworski.com/national-tools/rivers/)";
const STATE_FIPS = [
  "01","02","04","05","06","08","09","10","11","12","13","15","16","17","18","19",
  "20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35",
  "36","37","38","39","40","41","42","44","45","46","47","48","49","50","51","53",
  "54","55","56","60","66","69","72","78"
];
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 30000;
const RECENT_DAYS = 14;
const OUTPUT = path.resolve("public/data/national-usgs-streamflow-sites.json");

function finite(value, min = -Infinity, max = Infinity) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function normalizeSite(feature, stateFips, now = Date.now()) {
  const row = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const id = String(row.monitoring_location_number || row.monitoring_location_id || "")
    .replace(/^USGS-/, "");
  const observedAt = Date.parse(row.time || "");
  const cutoff = now - RECENT_DAYS * 86400000;
  const site = {
    id,
    name: String(row.monitoring_location_name || "").trim(),
    latitude: finite(coordinates[1], -90, 90),
    longitude: finite(coordinates[0], -180, 180),
    state_fips: stateFips,
  };
  if (!/^\d{5,15}$/.test(site.id) || !site.name || site.latitude == null || site.longitude == null) return null;
  if (!Number.isFinite(observedAt) || observedAt < cutoff) return null;
  return site;
}
function nextHref(payload) {
  return (payload?.links || []).find((link) => link?.rel === "next" && /^https:\/\/api\.waterdata\.usgs\.gov\//.test(link?.href || ""))?.href || null;
}
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchJson(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const headers = { accept: "application/json", "user-agent": UA };
      if (process.env.USGS_API_KEY) headers["X-Api-Key"] = process.env.USGS_API_KEY;
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`USGS Water Data API returned ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(750 * attempt);
    }
  }
  throw lastError;
}
async function fetchState(stateFips) {
  const first = new URL(LATEST);
  first.searchParams.set("f", "json");
  first.searchParams.set("state_code", stateFips);
  first.searchParams.set("site_type_code", "ST");
  first.searchParams.set("parameter_code", "00060");
  first.searchParams.set("limit", "10000");
  first.searchParams.set("properties", "monitoring_location_id,monitoring_location_number,monitoring_location_name,time,state_code,site_type_code,parameter_code");

  const features = [];
  let url = first.toString();
  for (let page = 0; url && page < 20; page++) {
    const payload = await fetchJson(url);
    if (!payload) return [];
    features.push(...(payload.features || []));
    url = nextHref(payload);
  }
  if (url) throw new Error(`${stateFips}: latest-continuous pagination exceeded safety cap`);
  return features.map((feature) => normalizeSite(feature, stateFips)).filter(Boolean);
}

const results = new Array(STATE_FIPS.length);
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= STATE_FIPS.length) return;
    const state = STATE_FIPS[index];
    const sites = await fetchState(state);
    results[index] = { state, sites };
    process.stdout.write(`${state}: ${sites.length} recently reporting streamflow sites\n`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const byId = new Map();
for (const result of results) {
  for (const site of result.sites) {
    if (!byId.has(site.id)) byId.set(site.id, site);
  }
}
const sites = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
if (sites.length < 5000) {
  throw new Error(`Generated only ${sites.length} recently reporting streamflow sites; refusing to publish an incomplete national index.`);
}

const payload = {
  version: 2,
  generated_at: new Date().toISOString(),
  source_name: "USGS Water Data APIs — latest continuous",
  source_url: LATEST,
  criteria: {
    site_type_code: "ST",
    parameter_code: "00060",
    latest_observation_within_days: RECENT_DAYS,
  },
  states_requested: STATE_FIPS,
  site_count: sites.length,
  sites,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(payload));
process.stdout.write(`Wrote ${sites.length} sites to ${OUTPUT}\n`);
