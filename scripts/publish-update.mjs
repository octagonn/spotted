#!/usr/bin/env node
/**
 * Publish an EAS Update SAFELY.
 *
 *   npm run ota -- --channel production --message "what changed"
 *
 * Why this exists (incident 2026-09-02): a bare `eas update` exported the
 * bundle with an EMPTY Supabase config — eas-cli resolves an EAS-hosted
 * environment and ignores .env, and that environment had no variables — so
 * every install that took the update ran the offline demo mode and opened
 * "signed in" as the mock Octavio profile. This script:
 *   1. loads .env into the process environment (eas-cli passes it through),
 *   2. runs `eas update` with `--environment <channel>`,
 *   3. fetches the manifest EAS is now serving for that channel/runtime and
 *      REFUSES to exit 0 unless it carries the expected Supabase URL.
 * app.config.ts also throws without the config, so step 3 is belt-and-braces.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- 1. .env → process.env (no dotenv dependency; simple KEY=VALUE lines) ---
try {
  for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // No .env — fine if the variables are already in the environment.
}

const expectedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const expectedKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!expectedUrl || !expectedKey) {
  console.error("✖ EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. Refusing to publish.");
  process.exit(1);
}

const args = process.argv.slice(2);
const channelIdx = args.indexOf("--channel");
const channel = channelIdx >= 0 ? args[channelIdx + 1] : null;
if (!channel) {
  console.error("✖ --channel is required (production | preview).");
  process.exit(1);
}
if (!args.includes("--environment")) args.push("--environment", channel);
if (!args.includes("--non-interactive")) args.push("--non-interactive");

// --- 2. publish ---
// shell:true re-joins args with spaces, so a multi-word --message must be quoted.
const quote = (a) => (/\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const pub = spawnSync("npx", ["eas-cli", "update", ...args.map(quote)], { cwd: root, stdio: "inherit", shell: true });
if (pub.status !== 0) process.exit(pub.status ?? 1);

// --- 3. verify what EAS is serving ---
const appJson = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], { cwd: root, shell: true, encoding: "utf8" });
const cfg = JSON.parse(appJson.stdout);
const runtime = cfg.runtimeVersion?.policy === "appVersion" ? cfg.version : String(cfg.runtimeVersion);
const projectId = cfg.extra?.eas?.projectId;
for (const platform of ["ios", "android"]) {
  const res = await fetch(`https://u.expo.dev/${projectId}`, {
    headers: {
      "expo-runtime-version": runtime,
      "expo-platform": platform,
      "expo-channel-name": channel,
      "expo-protocol-version": "1",
      accept: "multipart/mixed"
    }
  });
  const body = await res.text();
  const served = /"supabaseUrl":"([^"]*)"/.exec(body)?.[1] ?? "";
  const servedKey = /"supabaseAnonKey":"([^"]*)"/.exec(body)?.[1] ?? "";
  const id = /"id":"([0-9a-f-]{36})"/.exec(body)?.[1] ?? "?";
  const keyOk = servedKey === expectedKey;
  if (served !== expectedUrl || !keyOk) {
    console.error(
      `✖ ${platform}: served update ${id} has supabaseUrl="${served}" (expected ${expectedUrl}), anon key ${keyOk ? "ok" : `WRONG (len ${servedKey.length}, expected ${expectedKey.length})`}.`
    );
    console.error("  Devices would run in demo mode. Roll back NOW: npx eas-cli update:roll-back-to-embedded --channel " + channel);
    process.exit(2);
  }
  console.log(`✔ ${platform}: EAS serves update ${id} for runtime ${runtime} with the correct backend URL + anon key.`);
}
