#!/usr/bin/env node
/* eslint-env node */
/**
 * College/community rec-center sweep. Campus gyms (Ohio State RPAC, ARC at
 * UC Irvine, …) are tagged `leisure=sports_centre` in OSM — the main import
 * only pulled `leisure=fitness_centre`, so they were all missed. This queries
 * sports_centre per state and keeps facilities whose names read like gyms /
 * rec centers, excluding single-sport venues (pools, rinks, courts).
 *
 * Output: chunked SQL in scripts/out/rec-centers-<n>.sql, every insert gated
 * by gym_dupe_exists() so re-runs and overlaps with prior imports are safe.
 *
 * Usage:
 *   node scripts/seed-college-rec-centers.mjs
 *   for f in scripts/out/rec-centers-*.sql; do npx supabase db query --linked --file "$f"; done
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
const SLEEP_MS = 2000;
const ROWS_PER_INSERT = 250;
const INSERTS_PER_FILE = 8;

/** Reads like a gym / rec center… */
const INCLUDE = /\b(rec(reation)?|recplex|rec center|wellness|fitness|athletic|intramural|field ?house|gym|gymnasium|rpac|student (life|activity|activities|union))\b/i;
/** …but not a single-sport venue that happens to be a sports_centre. */
const EXCLUDE = /\b(gymnastic|aquatic|swim|pool|natatorium|tennis|racquet|pickleball|soccer|football|baseball|softball|basketball arena|hockey|ice|skat|curling|golf|bowl|climbing|boulder|equestrian|shooting|archery|martial|karate|judo|taekwondo|boxing club|dance|cheer|trampoline)\b/i;

function stateQuery(iso) {
  return `[out:json][timeout:300];area["ISO3166-2"="${iso}"][admin_level=4]->.a;nwr["leisure"="sports_centre"](area.a);out center tags;`;
}

async function fetchOverpass(query, label) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "spotted-seed/2.1" }
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

/** Coordinates come from third-party JSON/HTML; only a finite number may be spliced into SQL unquoted. */
function sqlNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`sqlNumber: not a finite number: ${String(value)}`);
  return String(n);
}

/** Campus/fitness rec facility? Sport tags can vouch for ambiguous names. */
function isRecFacility(name, tags) {
  if (EXCLUDE.test(name)) return false;
  if (INCLUDE.test(name)) return true;
  const sport = (tags?.sport ?? "").toLowerCase();
  return sport.includes("fitness") || sport.includes("multi");
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
    if (!isRecFacility(name, el.tags)) continue;
    const street = clean(el.tags?.["addr:street"]);
    const num = clean(el.tags?.["addr:housenumber"]);
    const city = clean(el.tags?.["addr:city"]);
    const state = clean(el.tags?.["addr:state"]);
    const operator = clean(el.tags?.operator);
    const addressParts = [num && street ? `${num} ${street}` : street, city, state].filter(Boolean);
    const address = addressParts.length ? addressParts.join(", ") : operator;
    const externalId = `${el.type}/${el.id}`;
    if (!collected.has(externalId)) {
      collected.set(externalId, { name: name.slice(0, 120), address, latitude: lat, longitude: lng, externalId });
      added++;
    }
  }
  process.stderr.write(`--   +${added} (total ${collected.size})\n`);
  if (i < STATES.length - 1) await new Promise((r) => setTimeout(r, SLEEP_MS));
}

process.stderr.write(`-- final: ${collected.size} rec centers; failed states: ${failedStates.join(",") || "none"}\n`);

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
      .map((g) => `(${escapeSql(g.name)}, ${escapeSql(g.address)}, ${sqlNumber(g.latitude)}, ${sqlNumber(g.longitude)}, 'gym', 'osm', ${escapeSql(g.externalId)})`)
      .join(",\n");
    statements.push(
      `insert into gyms (name, address, latitude, longitude, category, source, external_id)
select v.name, v.address, v.latitude, v.longitude, v.category, v.source, v.external_id
from (values\n${values}\n) as v(name, address, latitude, longitude, category, source, external_id)
where not gym_dupe_exists(v.name, v.latitude, v.longitude)
on conflict do nothing;`
    );
  }
  const file = `scripts/out/rec-centers-${String(f).padStart(3, "0")}.sql`;
  await writeFile(file, statements.join("\n\n") + "\n");
  files.push(file);
}

process.stderr.write(`-- wrote ${files.length} SQL files to scripts/out/\n`);
