#!/usr/bin/env node
/* eslint-env node */
/**
 * Seeds the `gyms` table with EVERY named fitness centre in the United States
 * from OpenStreetMap, one Overpass area query per state (fast + complete —
 * replaces the old per-metro radius probes in seed-us-gyms.mjs).
 *
 * Output: chunked SQL files scripts/out/us-gyms-<n>.sql (multi-row inserts,
 * `on conflict do nothing` so any dedupe index can fire safely).
 *
 * Usage:
 *   node scripts/seed-us-gyms-all.mjs
 *   for f in scripts/out/us-gyms-*.sql; do npx supabase db query --linked --file "$f"; done
 */

import { mkdir, writeFile } from "node:fs/promises";

const STATES = [
  "US-AL","US-AK","US-AZ","US-AR","US-CA","US-CO","US-CT","US-DE","US-DC","US-FL",
  "US-GA","US-HI","US-ID","US-IL","US-IN","US-IA","US-KS","US-KY","US-LA","US-ME",
  "US-MD","US-MA","US-MI","US-MN","US-MS","US-MO","US-MT","US-NE","US-NV","US-NH",
  "US-NJ","US-NM","US-NY","US-NC","US-ND","US-OH","US-OK","US-OR","US-PA","US-RI",
  "US-SC","US-SD","US-TN","US-TX","US-UT","US-VT","US-VA","US-WA","US-WV","US-WI","US-WY"
];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const SLEEP_MS = 2000; // be polite to overpass
const ROWS_PER_INSERT = 250;
const INSERTS_PER_FILE = 8; // ~2000 rows per file

function stateQuery(iso) {
  return `[out:json][timeout:300];area["ISO3166-2"="${iso}"][admin_level=4]->.a;nwr["leisure"="fitness_centre"](area.a);out center tags;`;
}

async function fetchOverpass(query, label) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "spotted-seed/2.0" }
      });
      if (res.status === 429 || res.status === 504 || res.status === 502) {
        process.stderr.write(`-- ${label}: ${res.status}, retry ${attempt + 1}\n`);
        await new Promise((r) => setTimeout(r, 15000 + attempt * 15000));
        continue;
      }
      if (!res.ok) {
        process.stderr.write(`-- ${label}: HTTP ${res.status}\n`);
        return null;
      }
      const data = await res.json();
      return data.elements ?? [];
    } catch (err) {
      process.stderr.write(`-- ${label}: ${err.message}, retry ${attempt + 1}\n`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  return null;
}

function clean(text) {
  if (!text) return null;
  const out = text.replace(/\s+/g, " ").trim();
  return out.length ? out : null;
}

function escapeSql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** yoga/pilates studios get their own map category; everything else is a gym. */
function categorize(tags) {
  const sport = (tags?.sport ?? "").toLowerCase();
  const name = (tags?.name ?? "").toLowerCase();
  if (sport.includes("yoga") || name.includes("yoga")) return "yoga";
  if (sport.includes("pilates") || name.includes("pilates")) return "pilates";
  return "gym";
}

const collected = new Map();
const failedStates = [];

for (let i = 0; i < STATES.length; i++) {
  const iso = STATES[i];
  process.stderr.write(`-- [${i + 1}/${STATES.length}] ${iso}\n`);
  const elements = await fetchOverpass(stateQuery(iso), iso);
  if (elements === null) {
    failedStates.push(iso);
    process.stderr.write(`-- ${iso}: FAILED after retries\n`);
    continue;
  }
  let added = 0;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = clean(el.tags?.name);
    if (!lat || !lng || !name) continue;
    const street = clean(el.tags?.["addr:street"]);
    const num = clean(el.tags?.["addr:housenumber"]);
    const city = clean(el.tags?.["addr:city"]);
    const state = clean(el.tags?.["addr:state"]);
    const addressParts = [num && street ? `${num} ${street}` : street, city, state].filter(Boolean);
    const address = addressParts.length ? addressParts.join(", ") : null;
    const externalId = `${el.type}/${el.id}`;
    if (!collected.has(externalId)) {
      collected.set(externalId, {
        name: name.slice(0, 120),
        address,
        latitude: lat,
        longitude: lng,
        category: categorize(el.tags),
        externalId
      });
      added++;
    }
  }
  process.stderr.write(`--   +${added} (total ${collected.size})\n`);
  if (i < STATES.length - 1) await new Promise((r) => setTimeout(r, SLEEP_MS));
}

process.stderr.write(`-- final: ${collected.size} gyms; failed states: ${failedStates.join(",") || "none"}\n`);

const rows = Array.from(collected.values());
await mkdir("scripts/out", { recursive: true });

const files = [];
for (let f = 0; f * ROWS_PER_INSERT * INSERTS_PER_FILE < rows.length; f++) {
  const start = f * ROWS_PER_INSERT * INSERTS_PER_FILE;
  const slice = rows.slice(start, start + ROWS_PER_INSERT * INSERTS_PER_FILE);
  const statements = [];
  for (let b = 0; b < slice.length; b += ROWS_PER_INSERT) {
    const batch = slice.slice(b, b + ROWS_PER_INSERT);
    const values = batch
      .map(
        (g) =>
          `(${escapeSql(g.name)}, ${escapeSql(g.address)}, ${g.latitude}, ${g.longitude}, ${escapeSql(g.category)}, 'osm', ${escapeSql(g.externalId)})`
      )
      .join(",\n");
    // gym_dupe_exists: accent/prefix-normalized name match within ~165m —
    // prevents "EōS Fitness" vs "EOS Fitness" style double-pins.
    statements.push(
      `insert into gyms (name, address, latitude, longitude, category, source, external_id)
select v.name, v.address, v.latitude, v.longitude, v.category, v.source, v.external_id
from (values\n${values}\n) as v(name, address, latitude, longitude, category, source, external_id)
where not gym_dupe_exists(v.name, v.latitude, v.longitude)
on conflict do nothing;`
    );
  }
  const file = `scripts/out/us-gyms-${String(f).padStart(3, "0")}.sql`;
  await writeFile(file, statements.join("\n\n") + "\n");
  files.push(file);
}

process.stderr.write(`-- wrote ${files.length} SQL files to scripts/out/\n`);
