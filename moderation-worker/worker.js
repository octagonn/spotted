/**
 * Spotted — self-hosted NSFW image-moderation worker.
 *
 * Runs on the homelab (server130). It PULLS work from Supabase and reaches OUT
 * to it, so nothing here needs to be exposed to the internet — no inbound
 * firewall/tunnel required.
 *
 * Loop:
 *   1. claim_moderation_jobs  -> up to BATCH pending jobs (atomic, SKIP LOCKED)
 *   2. for each job: sign every frame's storage path, download, classify with
 *      BOTH bundled NSFWJS models, take the WORST frame's (Porn + Hentai) as
 *      the nsfw score
 *   3. resolve_moderation_job(job, { nsfw, breakdown }) -> the DB applies the
 *      policy (>=0.60 or Sexy>=0.80 flag+review, else approve; nothing is
 *      ever auto-deleted — a human can always restore from Settings → Review)
 *   4. claim_media_purges -> R2 keys of admin-rejected posts, deleted here
 *      because only the service key may remove another user's objects
 *
 * Why two models: MobileNetV2 alone produced 100% false positives on this
 * app's real traffic (Sept 2026 audit: 9 flagged + 1 near-deleted, all
 * ordinary gym/room/car photos — a leg-curl machine scored Hentai 0.955, a
 * blurry living room Porn 0.79, a hoodie+shorts Sexy 0.99). InceptionV3 is
 * calmer on those but has its own misses (Porn 0.965 on the same blurry
 * room). Real explicit content lights up BOTH; the false positives are
 * model-specific noise. So every class is scored as the MIN across the two
 * models — a frame has to convince both to be flagged.
 *
 * Env (set in .env or the container environment):
 *   SUPABASE_URL                 https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    service-role key (NEVER ship this to a client)
 *   POLL_INTERVAL_MS             default 5000
 *   BATCH                        default 5
 */
const { createClient } = require("@supabase/supabase-js");
const tf = require("@tensorflow/tfjs-node");
const nsfw = require("nsfwjs");
const jpeg = require("jpeg-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
// When the queue is empty we ramp the poll delay up to this ceiling instead of
// hammering claim_moderation_jobs every POLL_INTERVAL_MS forever. On an idle
// app that fixed 5s poll was ~500k requests/month of pure egress for nothing;
// backing off to 30s cuts idle polling ~6x while keeping worst-case moderation
// latency for a freshly uploaded post at IDLE_POLL_INTERVAL_MS.
const IDLE_POLL_INTERVAL_MS = Number(process.env.IDLE_POLL_INTERVAL_MS || 30000);
const BATCH = Number(process.env.BATCH || 5);
const BUCKET = "posts";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

// Both bundled NSFWJS graphs. Order matters only for the log/report shape.
const MODEL_NAMES = ["MobileNetV2", "InceptionV3"];
const CLASSES = ["Porn", "Hentai", "Sexy", "Drawing", "Neutral"];
const models = {}; // name -> loaded NSFWJS model
let totalProcessed = 0;

/** Decode any image buffer to a tensor NSFWJS can classify. */
function toTensor(buffer, contentType) {
  // tfjs-node decodes JPEG/PNG natively; jpeg-js is a fallback for odd JPEGs.
  try {
    return tf.node.decodeImage(buffer, 3);
  } catch {
    const raw = jpeg.decode(buffer, { useTArray: true });
    return tf.tensor3d(raw.data, [raw.height, raw.width, 4]).slice([0, 0, 0], [-1, -1, 3]);
  }
}

/**
 * Classify one image buffer with every loaded model.
 * Returns { classes, perModel } where `classes` is the per-class MIN across
 * models (the number the policy runs on) and `perModel` keeps each model's
 * raw output so a reviewer can see which one fired.
 */
async function classify(buffer) {
  const image = toTensor(buffer);
  try {
    const perModel = {};
    for (const name of MODEL_NAMES) {
      const predictions = await models[name].classify(image);
      const out = {};
      for (const p of predictions) out[p.className] = Number(p.probability.toFixed(4));
      perModel[name] = out;
    }
    const classes = {};
    for (const cls of CLASSES) {
      classes[cls] = Math.min(...MODEL_NAMES.map((name) => perModel[name][cls] ?? 0));
    }
    return { classes, perModel };
  } finally {
    image.dispose();
  }
}

/**
 * Signed download URL for a frame on either storage path:
 *   "r2:<key>"  -> presigned R2 GET via the r2-media edge function
 *   "<path>"    -> legacy Supabase Storage signed URL
 */
async function signMediaUrl(path, bucket) {
  if (path.startsWith("r2:")) {
    const key = path.slice(3);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download", keys: [key] })
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.urls?.[key] ?? null;
  }
  const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
  if (signErr || !signed?.signedUrl) return null;
  return signed.signedUrl;
}

// FAIL CLOSED: if every frame of a job fails to sign/download/classify (e.g. an
// R2 or edge-function outage), we must NOT report nsfw=0 — that path approves
// the post, letting UNSCANNED media go live. Instead, leave the job unresolved
// so claim_moderation_jobs re-claims it after its 5-min lease; after a few dead
// attempts, resolve it into review (>=0.60) rather than ever auto-approving.
const scanFailCounts = new Map(); // job_id -> consecutive zero-scan attempts
const MAX_SCAN_RETRIES = 3;

async function processJob(job) {
  // Per-class worst across frames (each value already the cross-model min),
  // plus the single most concerning frame so a reviewer knows where to look.
  const breakdown = {};
  for (const cls of CLASSES) breakdown[cls] = 0;
  let nsfwMax = 0;
  let worst = { concern: -1, frame: null, perModel: null };
  let scanned = 0;
  for (const path of job.paths) {
    const url = await signMediaUrl(path, job.bucket || BUCKET);
    if (!url) continue;
    const res = await fetch(url);
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    let result;
    try {
      result = await classify(buffer);
    } catch (e) {
      console.warn(`classify failed for ${path}: ${e.message}`);
      continue;
    }
    scanned += 1;
    const { classes, perModel } = result;
    for (const cls of CLASSES) breakdown[cls] = Math.max(breakdown[cls], classes[cls] || 0);
    // Hard-explicit categories drive the verdict; the DB policy separately
    // reads breakdown.Sexy (>=0.80).
    const nsfwScore = (classes.Porn || 0) + (classes.Hentai || 0);
    nsfwMax = Math.max(nsfwMax, nsfwScore);
    const concern = Math.max(nsfwScore, classes.Sexy || 0);
    if (concern > worst.concern) worst = { concern, frame: path, perModel };
  }

  // Job had media but nothing could be scanned → do NOT approve.
  const hadFrames = Array.isArray(job.paths) && job.paths.length > 0;
  if (hadFrames && scanned === 0) {
    const attempts = (scanFailCounts.get(job.job_id) ?? 0) + 1;
    if (attempts < MAX_SCAN_RETRIES) {
      scanFailCounts.set(job.job_id, attempts);
      console.warn(
        `job ${job.job_id}: 0/${job.paths.length} frames scanned (attempt ${attempts}) — leaving for lease retry`
      );
      return; // unresolved → re-claimed after the 5-min lease
    }
    scanFailCounts.delete(job.job_id);
    console.error(`job ${job.job_id}: unscannable after ${attempts} attempts — flagging for review`);
    await supabase.rpc("resolve_moderation_job", {
      p_job: job.job_id,
      p_scores: { nsfw: 0.6, frame: null, breakdown: { scan_failed: true } }
    });
    return;
  }
  scanFailCounts.delete(job.job_id);

  const scores = {
    nsfw: Number(nsfwMax.toFixed(4)),
    frame: worst.frame,
    breakdown,
    // Raw per-model output for the reported frame — which model fired.
    models: worst.perModel || {}
  };
  const { data: action, error } = await supabase.rpc("resolve_moderation_job", {
    p_job: job.job_id,
    p_scores: scores
  });
  if (error) {
    console.error(`resolve failed for job ${job.job_id}: ${error.message}`);
    return;
  }
  totalProcessed += 1;
  const target = job.post_id ? `post ${job.post_id}` : job.story_id ? `story ${job.story_id}` : "unknown";
  console.log(`job ${job.job_id} ${target} -> ${action} (nsfw=${scores.nsfw} sexy=${breakdown.Sexy.toFixed(4)})`);
}

/**
 * Drain media_purge_queue: R2 keys of posts an admin rejected in the review
 * screen. Only the service key may delete another user's R2 objects, so the
 * DB just queues them and this loop does the actual delete. Keys are popped
 * before the delete call; a failed delete is logged and left orphaned rather
 * than retried forever (the post row is already gone, so nothing serves it).
 */
async function drainPurges() {
  const { data: rows, error } = await supabase.rpc("claim_media_purges", { p_limit: 50 });
  if (error || !rows || rows.length === 0) return;
  const keys = rows.map((r) => r.key);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", keys })
  });
  const json = res.ok ? await res.json().catch(() => null) : null;
  if (!json) {
    console.error(`purge: r2-media delete failed (${res.status}) for ${keys.length} keys: ${keys.join(", ")}`);
    return;
  }
  console.log(`purge: deleted ${json.deleted}/${keys.length} R2 objects`);
}

// Transient errors (cold-start DNS, a stale PostgREST schema cache after a
// migration) resolve themselves within a few polls. Don't spam the log with
// them — only surface a claim error once it has persisted for several ticks.
let consecutiveClaimErrors = 0;

async function tick() {
  const { data: jobs, error } = await supabase.rpc("claim_moderation_jobs", { p_limit: BATCH });
  if (error) {
    consecutiveClaimErrors += 1;
    // 3 misses ≈ 15s of real trouble before we log — blips stay silent.
    if (consecutiveClaimErrors >= 3) {
      console.error(`claim failing (${consecutiveClaimErrors}x): ${error.message}`);
    }
    return 0;
  }
  if (consecutiveClaimErrors > 0) {
    if (consecutiveClaimErrors >= 3) console.log("claim recovered");
    consecutiveClaimErrors = 0;
  }
  await drainPurges().catch((e) => console.error(`purge error: ${e.message}`));
  if (!jobs || jobs.length === 0) return 0;
  for (const job of jobs) {
    try {
      await processJob(job);
    } catch (e) {
      console.error(`job ${job.job_id} crashed: ${e.message}`);
    }
  }
  return jobs.length;
}

async function main() {
  console.log(`Loading NSFWJS models (${MODEL_NAMES.join(" + ")})…`);
  for (const name of MODEL_NAMES) models[name] = await nsfw.load(name); // both bundled
  console.log(`Models ready. Polling ${POLL_INTERVAL_MS}ms when busy, backing off to ${IDLE_POLL_INTERVAL_MS}ms when idle, batch ${BATCH}.`);
  // Heartbeat every 10 min so the log never goes ambiguously silent — you can
  // always confirm the loop is alive even when there's no work + no errors.
  const HEARTBEAT_MS = 10 * 60_000;
  let lastBeat = Date.now();
  let processedSinceBeat = 0;
  const beat = () => {
    console.log(`alive — polling, ${processedSinceBeat} processed in the last ${Math.round(HEARTBEAT_MS / 60000)}m`);
    processedSinceBeat = 0;
    lastBeat = Date.now();
  };
  // Simple sequential loop — one tick can't overlap the next.
  let delay = POLL_INTERVAL_MS;
  for (;;) {
    let found = 0;
    try {
      const before = totalProcessed;
      found = await tick();
      processedSinceBeat += totalProcessed - before;
    } catch (e) {
      console.error(`tick error: ${e.message}`);
    }
    if (Date.now() - lastBeat >= HEARTBEAT_MS) beat();
    // Adaptive backoff: snap back to the fast interval whenever there's work to
    // clear (so a backlog drains quickly), otherwise double the delay up to the
    // idle ceiling. Idle is the common case on a low-traffic app, and it's what
    // was quietly burning the Supabase egress budget at a fixed 5s cadence.
    delay = found > 0 ? POLL_INTERVAL_MS : Math.min(delay * 2, IDLE_POLL_INTERVAL_MS);
    await new Promise((r) => setTimeout(r, delay));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
