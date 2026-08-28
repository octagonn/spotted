#!/usr/bin/env node
/* eslint-env node */
/**
 * Seeds the `gyms` table with fitness centers across major US metros.
 * Pulls from OpenStreetMap Overpass API per-metro to avoid timeouts.
 *
 * Usage: node scripts/seed-us-gyms.mjs > scripts/seed-us-gyms.sql
 * Then:  npx supabase db query --linked --file scripts/seed-us-gyms.sql
 *
 * Or one-shot: node scripts/seed-us-gyms.mjs | npx supabase db query --linked
 */

import { writeFile } from "node:fs/promises";

// Dense SoCal coverage: ~10km radius probes on a tight grid covering
// LA County + Orange + Ventura + San Bernardino + Riverside + San Diego.
// Smaller radius = fewer missed gyms in dense urban centers.
const SOCAL_GRID = (() => {
  const points = [];
  // Bounding box roughly covering SoCal urban corridor.
  for (let lat = 32.5; lat <= 34.6; lat += 0.18) {
    for (let lng = -119.2; lng <= -116.2; lng += 0.18) {
      // Cull obvious ocean points west of the coast at southern latitudes.
      if (lat < 33.4 && lng < -117.8) continue;
      if (lat < 33.7 && lng < -118.2) continue;
      points.push([`SoCal grid ${lat.toFixed(2)},${lng.toFixed(2)}`, lat, lng, 12000]);
    }
  }
  return points;
})();

// Named SoCal hot spots — extra precision over the grid.
const SOCAL_HOTSPOTS = [
  ["Downtown LA", 34.0522, -118.2437, 8000],
  ["Hollywood", 34.0928, -118.3287, 8000],
  ["Beverly Hills", 34.0736, -118.4004, 8000],
  ["Santa Monica", 34.0195, -118.4912, 8000],
  ["Venice", 33.9850, -118.4695, 8000],
  ["Culver City", 34.0211, -118.3965, 8000],
  ["West Hollywood", 34.0900, -118.3617, 8000],
  ["Studio City", 34.1395, -118.3870, 8000],
  ["Burbank", 34.1808, -118.3090, 8000],
  ["Glendale, CA", 34.1425, -118.2551, 8000],
  ["Pasadena", 34.1478, -118.1445, 8000],
  ["Long Beach, CA central", 33.7701, -118.1937, 9000],
  ["Torrance", 33.8358, -118.3406, 8000],
  ["El Segundo", 33.9192, -118.4165, 7000],
  ["Manhattan Beach", 33.8847, -118.4109, 7000],
  ["Redondo Beach", 33.8492, -118.3884, 7000],
  ["Hermosa Beach", 33.8622, -118.3995, 7000],
  ["Marina del Rey", 33.9802, -118.4517, 7000],
  ["Brentwood", 34.0526, -118.4716, 7000],
  ["Westwood", 34.0635, -118.4455, 7000],
  ["Encino", 34.1592, -118.5012, 8000],
  ["Sherman Oaks", 34.1511, -118.4490, 8000],
  ["Van Nuys", 34.1866, -118.4487, 8000],
  ["North Hollywood", 34.1722, -118.3789, 8000],
  ["Mid-City LA", 34.0494, -118.3319, 8000],
  ["Koreatown", 34.0577, -118.3009, 7000],
  ["Silver Lake", 34.0869, -118.2702, 7000],
  ["Los Feliz", 34.1100, -118.2880, 7000],
  ["Echo Park", 34.0782, -118.2606, 7000],
  ["Highland Park", 34.1115, -118.1869, 7000],
  ["South LA", 33.9881, -118.2882, 9000],
  ["Compton", 33.8958, -118.2201, 8000],
  ["Inglewood", 33.9617, -118.3531, 8000],
  ["Hawthorne", 33.9164, -118.3526, 7000],
  ["Carson", 33.8317, -118.2820, 8000],
  ["Lakewood", 33.8536, -118.1339, 8000],
  ["Whittier", 33.9792, -118.0327, 8000],
  ["Norwalk", 33.9022, -118.0817, 7000],
  ["Downey", 33.9401, -118.1332, 8000],
  ["Bellflower", 33.8817, -118.1170, 7000],
  ["Cerritos", 33.8583, -118.0648, 8000],
  ["Anaheim, CA central", 33.8366, -117.9143, 9000],
  ["Santa Ana, CA central", 33.7455, -117.8677, 9000],
  ["Costa Mesa", 33.6411, -117.9187, 8000],
  ["Newport Beach", 33.6189, -117.9298, 9000],
  ["Huntington Beach", 33.6603, -117.9992, 9000],
  ["Irvine, CA central", 33.6846, -117.8265, 9000],
  ["Mission Viejo", 33.6000, -117.6720, 9000],
  ["Laguna Beach", 33.5427, -117.7854, 8000],
  ["Laguna Niguel", 33.5225, -117.7075, 8000],
  ["San Clemente", 33.4270, -117.6120, 9000],
  ["Dana Point", 33.4669, -117.6981, 7000],
  ["Lake Forest", 33.6469, -117.6891, 8000],
  ["Aliso Viejo", 33.5677, -117.7256, 7000],
  ["Tustin", 33.7458, -117.8262, 7000],
  ["Garden Grove", 33.7743, -117.9381, 8000],
  ["Westminster", 33.7587, -117.9904, 7000],
  ["Fountain Valley", 33.7092, -117.9536, 7000],
  ["Yorba Linda", 33.8886, -117.8131, 8000],
  ["Brea", 33.9166, -117.9000, 7000],
  ["Fullerton", 33.8703, -117.9242, 8000],
  ["Orange, CA", 33.7879, -117.8531, 8000],
  ["San Diego central", 32.7157, -117.1611, 9000],
  ["La Jolla", 32.8328, -117.2713, 8000],
  ["Pacific Beach", 32.7997, -117.2552, 7000],
  ["Mission Beach", 32.7714, -117.2542, 7000],
  ["Hillcrest SD", 32.7486, -117.1614, 7000],
  ["North Park SD", 32.7398, -117.1294, 7000],
  ["Mission Valley", 32.7705, -117.1536, 8000],
  ["Kearny Mesa", 32.8207, -117.1450, 8000],
  ["Clairemont", 32.8208, -117.1850, 7000],
  ["Carmel Valley SD", 32.9692, -117.2497, 8000],
  ["Del Mar", 32.9595, -117.2653, 7000],
  ["Encinitas", 33.0370, -117.2920, 8000],
  ["Carlsbad", 33.1581, -117.3506, 9000],
  ["Oceanside", 33.1959, -117.3795, 9000],
  ["Vista", 33.2000, -117.2425, 8000],
  ["Escondido", 33.1192, -117.0864, 9000],
  ["Poway", 32.9628, -117.0359, 8000],
  ["Rancho Bernardo", 33.0214, -117.0731, 7000],
  ["Chula Vista central", 32.6401, -117.0842, 9000],
  ["National City", 32.6781, -117.0992, 7000],
  ["El Cajon", 32.7948, -116.9625, 9000],
  ["La Mesa", 32.7678, -117.0231, 7000],
  ["Santee", 32.8384, -116.9739, 7000],
  ["San Marcos, CA", 33.1434, -117.1661, 8000],
  ["Imperial Beach", 32.5839, -117.1131, 7000],
  ["Coronado", 32.6859, -117.1831, 7000],
  ["Riverside, CA central", 33.9806, -117.3755, 9000],
  ["San Bernardino central", 34.1083, -117.2898, 9000],
  ["Ontario", 34.0633, -117.6509, 9000],
  ["Rancho Cucamonga", 34.1064, -117.5931, 9000],
  ["Fontana central", 34.0922, -117.435, 9000],
  ["Corona", 33.8753, -117.5664, 9000],
  ["Murrieta", 33.5539, -117.2139, 9000],
  ["Temecula", 33.4936, -117.1484, 9000],
  ["Moreno Valley central", 33.9425, -117.2297, 9000],
  ["Redlands", 34.0556, -117.1825, 8000],
  ["Highland CA", 34.1283, -117.2086, 7000],
  ["Yucaipa", 34.0336, -117.0431, 7000],
  ["Hemet", 33.7475, -116.9719, 9000],
  ["Palm Springs", 33.8303, -116.5453, 9000],
  ["Palm Desert", 33.7222, -116.3744, 9000],
  ["Indio", 33.7206, -116.2156, 9000],
  ["Cathedral City", 33.7794, -116.4658, 7000],
  ["La Quinta", 33.6634, -116.3100, 7000],
  ["Rancho Mirage", 33.7398, -116.4128, 7000],
  ["Ventura, CA", 34.2746, -119.2290, 9000],
  ["Oxnard central", 34.1975, -119.1771, 9000],
  ["Camarillo", 34.2164, -119.0376, 8000],
  ["Thousand Oaks", 34.1706, -118.8376, 9000],
  ["Simi Valley", 34.2694, -118.7815, 9000],
  ["Moorpark", 34.2856, -118.8820, 7000],
  ["Santa Clarita central", 34.3917, -118.5426, 9000],
  ["Valencia, CA", 34.4439, -118.6098, 8000],
  ["Lancaster", 34.6868, -118.1542, 9000],
  ["Palmdale", 34.5794, -118.1165, 9000]
];

const METROS = [
  ...SOCAL_GRID.map((p) => [p[0], p[1], p[2], p[3]]),
  ...SOCAL_HOTSPOTS.map((p) => [p[0], p[1], p[2], p[3]]),
  ["New York, NY", 40.7128, -74.006],
  ["Los Angeles, CA", 34.0522, -118.2437],
  ["Chicago, IL", 41.8781, -87.6298],
  ["Houston, TX", 29.7604, -95.3698],
  ["Phoenix, AZ", 33.4484, -112.074],
  ["Philadelphia, PA", 39.9526, -75.1652],
  ["San Antonio, TX", 29.4241, -98.4936],
  ["San Diego, CA", 32.7157, -117.1611],
  ["Dallas, TX", 32.7767, -96.797],
  ["Austin, TX", 30.2672, -97.7431],
  ["Jacksonville, FL", 30.3322, -81.6557],
  ["Fort Worth, TX", 32.7555, -97.3308],
  ["Columbus, OH", 39.9612, -82.9988],
  ["Charlotte, NC", 35.2271, -80.8431],
  ["Indianapolis, IN", 39.7684, -86.1581],
  ["San Francisco, CA", 37.7749, -122.4194],
  ["Seattle, WA", 47.6062, -122.3321],
  ["Denver, CO", 39.7392, -104.9903],
  ["Washington, DC", 38.9072, -77.0369],
  ["Nashville, TN", 36.1627, -86.7816],
  ["Oklahoma City, OK", 35.4676, -97.5164],
  ["El Paso, TX", 31.7619, -106.485],
  ["Boston, MA", 42.3601, -71.0589],
  ["Portland, OR", 45.5152, -122.6784],
  ["Las Vegas, NV", 36.1699, -115.1398],
  ["Detroit, MI", 42.3314, -83.0458],
  ["Memphis, TN", 35.1495, -90.049],
  ["Louisville, KY", 38.2527, -85.7585],
  ["Baltimore, MD", 39.2904, -76.6122],
  ["Milwaukee, WI", 43.0389, -87.9065],
  ["Albuquerque, NM", 35.0844, -106.6504],
  ["Tucson, AZ", 32.2226, -110.9747],
  ["Fresno, CA", 36.7378, -119.7871],
  ["Sacramento, CA", 38.5816, -121.4944],
  ["Mesa, AZ", 33.4152, -111.8315],
  ["Kansas City, MO", 39.0997, -94.5786],
  ["Atlanta, GA", 33.749, -84.388],
  ["Long Beach, CA", 33.7701, -118.1937],
  ["Colorado Springs, CO", 38.8339, -104.8214],
  ["Raleigh, NC", 35.7796, -78.6382],
  ["Miami, FL", 25.7617, -80.1918],
  ["Virginia Beach, VA", 36.8529, -75.978],
  ["Omaha, NE", 41.2565, -95.9345],
  ["Oakland, CA", 37.8044, -122.2712],
  ["Minneapolis, MN", 44.9778, -93.265],
  ["Tulsa, OK", 36.154, -95.9928],
  ["Arlington, TX", 32.7357, -97.1081],
  ["Tampa, FL", 27.9506, -82.4572],
  ["New Orleans, LA", 29.9511, -90.0715],
  ["Cleveland, OH", 41.4993, -81.6944],
  ["Honolulu, HI", 21.3099, -157.8581],
  ["Anaheim, CA", 33.8366, -117.9143],
  ["Lexington, KY", 38.0406, -84.5037],
  ["Stockton, CA", 37.9577, -121.2908],
  ["Corpus Christi, TX", 27.8006, -97.3964],
  ["Henderson, NV", 36.0395, -114.9817],
  ["Riverside, CA", 33.9806, -117.3755],
  ["Newark, NJ", 40.7357, -74.1724],
  ["Saint Paul, MN", 44.9537, -93.09],
  ["Santa Ana, CA", 33.7455, -117.8677],
  ["Cincinnati, OH", 39.1031, -84.512],
  ["Irvine, CA", 33.6846, -117.8265],
  ["Orlando, FL", 28.5383, -81.3792],
  ["Pittsburgh, PA", 40.4406, -79.9959],
  ["St. Louis, MO", 38.627, -90.1994],
  ["Greensboro, NC", 36.0726, -79.792],
  ["Lincoln, NE", 40.8136, -96.7026],
  ["Anchorage, AK", 61.2181, -149.9003],
  ["Plano, TX", 33.0198, -96.6989],
  ["Durham, NC", 35.994, -78.8986],
  ["Jersey City, NJ", 40.7178, -74.0431],
  ["Chandler, AZ", 33.3062, -111.8413],
  ["Chula Vista, CA", 32.6401, -117.0842],
  ["Buffalo, NY", 42.8864, -78.8784],
  ["North Las Vegas, NV", 36.1989, -115.1175],
  ["Gilbert, AZ", 33.3528, -111.789],
  ["Madison, WI", 43.0731, -89.4012],
  ["Reno, NV", 39.5296, -119.8138],
  ["Toledo, OH", 41.6528, -83.5379],
  ["Fort Wayne, IN", 41.0793, -85.1394],
  ["Lubbock, TX", 33.5779, -101.8552],
  ["St. Petersburg, FL", 27.7676, -82.6403],
  ["Laredo, TX", 27.5036, -99.5076],
  ["Irving, TX", 32.814, -96.9489],
  ["Chesapeake, VA", 36.7682, -76.2875],
  ["Glendale, AZ", 33.5387, -112.186],
  ["Garland, TX", 32.9126, -96.6389],
  ["Scottsdale, AZ", 33.4942, -111.9261],
  ["Boise, ID", 43.615, -116.2023],
  ["Norfolk, VA", 36.8508, -76.2859],
  ["Spokane, WA", 47.6588, -117.426],
  ["Fremont, CA", 37.5485, -121.9886],
  ["Richmond, VA", 37.5407, -77.436],
  ["Santa Clarita, CA", 34.3917, -118.5426],
  ["San Bernardino, CA", 34.1083, -117.2898],
  ["Baton Rouge, LA", 30.4515, -91.1871],
  ["Hialeah, FL", 25.8576, -80.2781],
  ["Tacoma, WA", 47.2529, -122.4443],
  ["Modesto, CA", 37.6391, -120.997],
  ["Port St. Lucie, FL", 27.2939, -80.3503],
  ["Huntsville, AL", 34.7304, -86.5861],
  ["Des Moines, IA", 41.5868, -93.625],
  ["Moreno Valley, CA", 33.9425, -117.2297],
  ["Fontana, CA", 34.0922, -117.435],
  ["Frisco, TX", 33.1507, -96.8237],
  ["Rochester, NY", 43.1566, -77.6088],
  ["Yonkers, NY", 40.9312, -73.8987],
  ["Fayetteville, NC", 35.0527, -78.8784],
  ["Worcester, MA", 42.2626, -71.8023],
  ["Columbus, GA", 32.4609, -84.9877],
  ["Cape Coral, FL", 26.5629, -81.9495],
  ["McAllen, TX", 26.2034, -98.2300],
  ["Little Rock, AR", 34.7465, -92.2896],
  ["Oxnard, CA", 34.1975, -119.1771],
  ["Amarillo, TX", 35.222, -101.8313],
  ["Augusta, GA", 33.4735, -82.0105],
  ["Salt Lake City, UT", 40.7608, -111.891],
  ["Montgomery, AL", 32.3668, -86.3]
];

const DEFAULT_RADIUS_M = 30000;
const SLEEP_MS = 800; // be polite to overpass

async function fetchOverpass(lat, lng, radius) {
  const query = `[out:json][timeout:60];(node["leisure"="fitness_centre"](around:${radius},${lat},${lng});way["leisure"="fitness_centre"](around:${radius},${lat},${lng});node["leisure"="sports_centre"](around:${radius},${lat},${lng});way["leisure"="sports_centre"](around:${radius},${lat},${lng}););out center tags;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: new URLSearchParams({ data: query }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "spotted-seed/1.0" }
      });
      if (res.status === 429 || res.status === 504) {
        process.stderr.write(`-- overpass ${res.status} retrying for ${lat},${lng}\n`);
        await new Promise((r) => setTimeout(r, 5000 + attempt * 5000));
        continue;
      }
      if (!res.ok) {
        process.stderr.write(`-- overpass ${res.status} for ${lat},${lng}\n`);
        return [];
      }
      const data = await res.json();
      return data.elements ?? [];
    } catch (err) {
      process.stderr.write(`-- overpass network ${err.message} for ${lat},${lng}\n`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  return [];
}

function escapeSql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function clean(text) {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

const collected = new Map();

for (let i = 0; i < METROS.length; i++) {
  const entry = METROS[i];
  const name = entry[0];
  const lat = entry[1];
  const lng = entry[2];
  const radius = entry[3] ?? DEFAULT_RADIUS_M;
  process.stderr.write(`-- [${i + 1}/${METROS.length}] ${name} (r=${radius})\n`);
  try {
    const elements = await fetchOverpass(lat, lng, radius);
    let added = 0;
    for (const el of elements) {
      const lat2 = el.lat ?? el.center?.lat;
      const lng2 = el.lon ?? el.center?.lon;
      const gymName = clean(el.tags?.name);
      if (!lat2 || !lng2 || !gymName) continue;
      const street = clean(el.tags?.["addr:street"]);
      const num = clean(el.tags?.["addr:housenumber"]);
      const city = clean(el.tags?.["addr:city"]);
      const state = clean(el.tags?.["addr:state"]);
      const addressParts = [num && street ? `${num} ${street}` : street, city, state].filter(Boolean);
      const address = addressParts.length ? addressParts.join(", ") : null;
      const key = `${gymName}|${lat2.toFixed(6)}|${lng2.toFixed(6)}`;
      if (!collected.has(key)) {
        collected.set(key, { name: gymName, address, latitude: lat2, longitude: lng2 });
        added++;
      }
    }
    process.stderr.write(`--   +${added} (total ${collected.size})\n`);
  } catch (err) {
    process.stderr.write(`-- fetch error ${name}: ${err.message}\n`);
  }
  if (i < METROS.length - 1) {
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
}

process.stderr.write(`-- final: ${collected.size} gyms\n`);

const rows = Array.from(collected.values());
const lines = [
  "begin;",
  "create temp table _seed_gyms (name text, address text, latitude double precision, longitude double precision);",
  ...rows.map(
    (g) =>
      `insert into _seed_gyms (name, address, latitude, longitude) values (${escapeSql(g.name)}, ${escapeSql(
        g.address
      )}, ${g.latitude}, ${g.longitude});`
  ),
  `insert into gyms (name, address, latitude, longitude) select name, address, latitude, longitude from _seed_gyms on conflict (name, latitude, longitude) do nothing;`,
  "drop table _seed_gyms;",
  "commit;"
];

process.stdout.write(lines.join("\n") + "\n");
