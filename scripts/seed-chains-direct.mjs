#!/usr/bin/env node
/* eslint-env node */
/**
 * Scrapes EOS Fitness + 24 Hour Fitness public location pages directly.
 * Both expose schema.org JSON-LD with latitude/longitude.
 *
 * Usage:
 *   node scripts/seed-chains-direct.mjs > /tmp/chains-direct.sql 2> /tmp/chains-direct.err
 *   npx supabase db query --linked --file /tmp/chains-direct.sql
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fetchText(url, timeoutMs = 30_000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ac.signal });
    if (!res.ok) {
      process.stderr.write(`-- ${url} -> ${res.status}\n`);
      return null;
    }
    return await res.text();
  } catch (e) {
    process.stderr.write(`-- ${url} -> err ${e.message}\n`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getEosUrls() {
  const xml = await fetchText("https://www.eosfitness.com/sitemap.xml");
  if (!xml) return [];
  const matches = xml.match(/https:\/\/www\.eosfitness\.com\/gym\/[a-z0-9-]+/g) ?? [];
  return Array.from(new Set(matches));
}

async function get24hfUrls() {
  const xml = await fetchText("https://www.24hourfitness.com/sitemap.xml");
  if (!xml) return [];
  const matches = xml.match(/https:\/\/www\.24hourfitness\.com\/gyms\/[a-z0-9-]+\/[a-z0-9-]+/g) ?? [];
  return Array.from(new Set(matches));
}

function escapeSql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function clean(text) {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

function parseEos(html) {
  const lat = html.match(/\\"latitude\\":(-?[0-9.]+)/);
  const lng = html.match(/\\"longitude\\":(-?[0-9.]+)/);
  const city = html.match(/\\"city\\":\\"([^\\"]+)/);
  const addr = html.match(/\\"address1\\":\\"([^\\"]+)/);
  const state = html.match(/\\"state\\":\\"([A-Z]{2})/);
  const zip = html.match(/\\"zip\\":\\"([0-9]+)/);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (!lat || !lng) return null;
  const cityClean = city ? clean(city[1]) : null;
  const stateClean = state ? state[1] : "";
  const addrClean = addr ? clean(addr[1]) : null;
  const zipClean = zip ? zip[1] : "";
  const addressParts = [addrClean, cityClean, [stateClean, zipClean].filter(Boolean).join(" ")].filter(Boolean);
  let name = "EOS Fitness";
  if (titleMatch) {
    const t = clean(titleMatch[1]);
    if (t && t.toLowerCase().includes("eos")) {
      name = t.split("|")[0].trim();
    }
  }
  if (cityClean && !name.toLowerCase().includes(cityClean.toLowerCase())) {
    name = `EOS Fitness — ${cityClean}`;
  }
  return {
    name,
    address: addressParts.length ? addressParts.join(", ") : null,
    latitude: parseFloat(lat[1]),
    longitude: parseFloat(lng[1])
  };
}

function parse24hf(html) {
  const lat = html.match(/"latitude":\s*(-?[0-9.]+)/);
  const lng = html.match(/"longitude":\s*(-?[0-9.]+)/);
  const street = html.match(/"streetAddress":\s*"([^"]+)"/);
  const city = html.match(/"addressLocality":\s*"([^"]+)"/);
  const region = html.match(/"addressRegion":\s*"([^"]+)"/);
  const postal = html.match(/"postalCode":\s*"([^"]+)"/);
  const name = html.match(/"name":\s*"(24 Hour Fitness[^"]+)"/);
  if (!lat || !lng) return null;
  const addressParts = [street && clean(street[1]), city && clean(city[1]), [region?.[1], postal?.[1]].filter(Boolean).join(" ")].filter(Boolean);
  return {
    name: name ? clean(name[1]) : "24 Hour Fitness",
    address: addressParts.length ? addressParts.join(", ") : null,
    latitude: parseFloat(lat[1]),
    longitude: parseFloat(lng[1])
  };
}

async function fetchAll(urls, parser, label) {
  const out = [];
  let i = 0;
  for (const url of urls) {
    i++;
    if (i % 25 === 0) process.stderr.write(`-- ${label} ${i}/${urls.length} (${out.length} found)\n`);
    const html = await fetchText(url);
    if (!html) continue;
    const row = parser(html);
    if (row) out.push(row);
    await new Promise((r) => setTimeout(r, 80));
  }
  process.stderr.write(`-- ${label} done: ${out.length}/${urls.length}\n`);
  return out;
}

(async () => {
  process.stderr.write("-- fetching EOS sitemap\n");
  const eosUrls = await getEosUrls();
  process.stderr.write(`-- EOS urls: ${eosUrls.length}\n`);

  process.stderr.write("-- fetching 24HF sitemap\n");
  const ttUrls = await get24hfUrls();
  process.stderr.write(`-- 24HF urls: ${ttUrls.length}\n`);

  const eos = await fetchAll(eosUrls, parseEos, "EOS");
  const tt = await fetchAll(ttUrls, parse24hf, "24HF");

  const all = [...eos, ...tt];
  process.stderr.write(`-- final: ${all.length}\n`);

  const lines = [
    "begin;",
    "create temp table _seed_direct (name text, address text, latitude double precision, longitude double precision);",
    ...all.map(
      (g) =>
        `insert into _seed_direct (name, address, latitude, longitude) values (${escapeSql(g.name)}, ${escapeSql(
          g.address
        )}, ${g.latitude}, ${g.longitude});`
    ),
    // category is REQUIRED for the map (gyms_in_bounds filters on it).
    // Dedupe: gym_dupe_exists (accent/prefix-normalized name within ~165m)
    // plus a wider brand-proximity net for these two chains specifically.
    `insert into gyms (name, address, latitude, longitude, category, source)
select distinct on (lower(s.name), round(s.latitude::numeric, 4), round(s.longitude::numeric, 4))
  s.name, s.address, s.latitude, s.longitude, 'gym', 'chain'
from _seed_direct s
where not gym_dupe_exists(s.name, s.latitude, s.longitude)
  and not exists (
    select 1 from gyms g
    where (
        (gym_name_key(s.name) like 'eos%' and gym_name_key(g.name) like 'eos%')
        or (gym_name_key(s.name) like '24hour%' and gym_name_key(g.name) like '24hour%')
      )
      and abs(g.latitude - s.latitude) < 0.0025
      and abs(g.longitude - s.longitude) < 0.003
  );`,
    "drop table _seed_direct;",
    "commit;"
  ];

  process.stdout.write(lines.join("\n") + "\n");
})();
