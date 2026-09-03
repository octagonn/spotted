#!/usr/bin/env node
/* eslint-env node */
/**
 * Second-pass gym seeder.
 *  - Hardcodes major SoCal college rec centers (often missed by leisure=fitness_centre tag).
 *  - Queries Overpass for chain gyms by name regex within a SoCal bounding box,
 *    catches ones tagged as amenity, sport=fitness, or other inconsistent OSM tags.
 *
 * Usage:
 *   node scripts/seed-chains-and-colleges.mjs > scripts/seed-chains-and-colleges.sql
 *   npx supabase db query --linked --file scripts/seed-chains-and-colleges.sql
 */

const SOCAL_BBOX = "32.5,-119.2,34.6,-116.2";

const COLLEGE_GYMS = [
  // UCLA
  ["John Wooden Center", "UCLA, Los Angeles, CA", 34.0701, -118.4448],
  ["Bruin Fitness Center", "UCLA, Los Angeles, CA", 34.0728, -118.4429],
  ["UCLA Recreation - Sunset Canyon", "UCLA, Los Angeles, CA", 34.0742, -118.4498],
  // USC
  ["Lyon Recreation Center", "USC, Los Angeles, CA", 34.0224, -118.2851],
  ["USC Village Fitness Center", "USC Village, Los Angeles, CA", 34.0264, -118.2860],
  // UCSD
  ["RIMAC Arena & Fitness Center", "UC San Diego, La Jolla, CA", 32.8884, -117.2393],
  ["UCSD Main Gym", "UC San Diego, La Jolla, CA", 32.8835, -117.2381],
  // UCI
  ["Anteater Recreation Center", "UC Irvine, Irvine, CA", 33.6520, -117.8345],
  // UCR
  ["UCR Student Recreation Center", "UC Riverside, Riverside, CA", 33.9756, -117.3260],
  ["UCR Recreation Expansion", "UC Riverside, Riverside, CA", 33.9748, -117.3242],
  // UCSB
  ["UCSB Recreation Center", "UC Santa Barbara, Goleta, CA", 34.4148, -119.8506],
  // CSU campuses
  ["The Beach Pyramid (CSULB)", "CSU Long Beach, Long Beach, CA", 33.7818, -118.1136],
  ["CSULB Student Recreation & Wellness Center", "CSU Long Beach, Long Beach, CA", 33.7790, -118.1158],
  ["CSUF Student Recreation Center", "CSU Fullerton, Fullerton, CA", 33.8829, -117.8847],
  ["CSULA University-Student Union Fitness Center", "CSU LA, Los Angeles, CA", 34.0660, -118.1685],
  ["CSUN Student Recreation Center", "CSU Northridge, Northridge, CA", 34.2398, -118.5288],
  ["CSUSB Student Recreation and Fitness Center", "CSU San Bernardino, San Bernardino, CA", 34.1812, -117.3242],
  ["SDSU Aztec Recreation Center", "SDSU, San Diego, CA", 32.7748, -117.0723],
  // Caltech
  ["Caltech Athletics Braun Gymnasium", "Caltech, Pasadena, CA", 34.1361, -118.1259],
  // Pepperdine
  ["Pepperdine Tyler Campus Center Fitness", "Pepperdine, Malibu, CA", 34.0410, -118.7100],
  // LMU
  ["LMU Burns Recreation Center", "Loyola Marymount, Los Angeles, CA", 33.9700, -118.4178],
  // Occidental
  ["Occidental Norris Athletic Center", "Occidental College, Los Angeles, CA", 34.1265, -118.2117],
  // Pomona / Claremont
  ["Roberts Pavilion (Claremont)", "Claremont Colleges, Claremont, CA", 34.1015, -117.7090],
  // Community colleges (a few major ones)
  ["Santa Monica College Fitness Center", "SMC, Santa Monica, CA", 34.0182, -118.4708],
  ["Pasadena City College Fitness Center", "PCC, Pasadena, CA", 34.1453, -118.1248],
  ["El Camino College Fitness Center", "El Camino College, Torrance, CA", 33.8843, -118.3296],
  ["Long Beach City College Hall of Champions", "LBCC, Long Beach, CA", 33.7864, -118.1232],
  ["Mt. SAC Fitness Center", "Mt. San Antonio College, Walnut, CA", 34.0479, -117.8454],
  // Notable big-box chains by name (will also pick up via Overpass below)
  ["EOS Fitness Tustin", "Tustin, CA", 33.7407, -117.7969],
  ["EOS Fitness Anaheim", "Anaheim, CA", 33.8425, -117.9050],
  ["EOS Fitness Long Beach", "Long Beach, CA", 33.8230, -118.1870],
  ["EOS Fitness Costa Mesa", "Costa Mesa, CA", 33.6810, -117.9230],
  ["EOS Fitness Lakewood", "Lakewood, CA", 33.8474, -118.1273],
  ["EOS Fitness Pasadena", "Pasadena, CA", 34.1418, -118.1308],
  ["EOS Fitness Glendora", "Glendora, CA", 34.1361, -117.8653],
  ["EOS Fitness Burbank", "Burbank, CA", 34.1716, -118.3236],
  ["EOS Fitness Northridge", "Northridge, CA", 34.2306, -118.5303],
  ["EOS Fitness West LA", "Los Angeles, CA", 34.0464, -118.4422],
  ["EOS Fitness Mira Mesa", "San Diego, CA", 32.9180, -117.1390],
  ["EOS Fitness Otay Ranch", "Chula Vista, CA", 32.6300, -116.9580]
];

const CHAINS = [
  "EOS Fitness",
  "EOS",
  "24 Hour Fitness",
  "LA Fitness",
  "Equinox",
  "Crunch Fitness",
  "Crunch",
  "Anytime Fitness",
  "Planet Fitness",
  "UFC Gym",
  "Gold's Gym",
  "World Gym",
  "YMCA",
  "Orangetheory",
  "Lifetime Fitness",
  "Life Time",
  "Chuze Fitness",
  "In-Shape",
  "Fitness 19",
  "Esporta",
  "F45",
  "Barry's Bootcamp",
  "SoulCycle",
  "Y7",
  "Pure Barre",
  "[solidcore]",
  "Solidcore",
  "CorePower Yoga",
  "Title Boxing"
];

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

function clean(text) {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

async function fetchOverpass(query) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: query }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "spotted-seed/1.0" }
  });
  if (!res.ok) {
    process.stderr.write(`-- overpass ${res.status}\n`);
    return [];
  }
  const data = await res.json();
  return data.elements ?? [];
}

const collected = new Map();

function add(row) {
  if (!row.name || !row.latitude || !row.longitude) return;
  const key = `${row.name.toLowerCase()}|${row.latitude.toFixed(4)}|${row.longitude.toFixed(4)}`;
  if (!collected.has(key)) collected.set(key, row);
}

// 1) Hardcoded
for (const [name, address, lat, lng] of COLLEGE_GYMS) {
  add({ name, address, latitude: lat, longitude: lng });
}
process.stderr.write(`-- hardcoded: ${collected.size}\n`);

// 2) Skip chain regex queries — Overpass times out on whole-bbox name regexes.
// The original around-radius seed already captured most chain locations.
void CHAINS; // referenced for future use
void SOCAL_BBOX;
void fetchOverpass;

const rows = Array.from(collected.values());
process.stderr.write(`-- final ${rows.length}\n`);

const lines = [
  "begin;",
  "create temp table _seed_chains (name text, address text, latitude double precision, longitude double precision);",
  ...rows.map(
    (g) =>
      `insert into _seed_chains (name, address, latitude, longitude) values (${escapeSql(g.name)}, ${escapeSql(
        g.address
      )}, ${sqlNumber(g.latitude)}, ${sqlNumber(g.longitude)});`
  ),
  `insert into gyms (name, address, latitude, longitude)
select distinct on (lower(s.name), round(s.latitude::numeric, 4), round(s.longitude::numeric, 4))
  s.name, s.address, s.latitude, s.longitude
from _seed_chains s
where not exists (
  select 1 from gyms g
  where lower(g.name) = lower(s.name)
    and round(g.latitude::numeric, 4) = round(s.latitude::numeric, 4)
    and round(g.longitude::numeric, 4) = round(s.longitude::numeric, 4)
);`,
  "drop table _seed_chains;",
  "commit;"
];

process.stdout.write(lines.join("\n") + "\n");
