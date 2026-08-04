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
 *      NSFWJS, take the WORST frame's (Porn + Hentai) as the nsfw score
 *   3. resolve_moderation_job(job, { nsfw, breakdown }) -> the DB applies the
 *      policy (>=0.90 delete, >=0.60 flag+review, else approve)
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
const BATCH = Number(process.env.BATCH || 5);
const BUCKET = "posts";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

let model = null;
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

/** Classify one image buffer → { Porn, Hentai, Sexy, Neutral, Drawing }. */
async function classify(buffer) {
  const image = toTensor(buffer);
  try {
    const predictions = await model.classify(image);
    const out = {};
    for (const p of predictions) out[p.className] = p.probability;
    return out;
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
  let worst = { nsfw: 0, frame: null, classes: null };
  let scanned = 0;
  for (const path of job.paths) {
    const url = await signMediaUrl(path, job.bucket || BUCKET);
    if (!url) continue;
    const res = await fetch(url);
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    let classes;
    try {
      classes = await classify(buffer);
    } catch (e) {
      console.warn(`classify failed for ${path}: ${e.message}`);
      continue;
    }
    scanned += 1;
    // Hard-explicit categories drive the verdict. "Sexy" (sports bras, gym
    // selfies) is deliberately EXCLUDED so legit fitness content isn't flagged.
    const nsfwScore = (classes.Porn || 0) + (classes.Hentai || 0);
    if (nsfwScore > worst.nsfw) worst = { nsfw: nsfwScore, frame: path, classes };
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
    nsfw: Number(worst.nsfw.toFixed(4)),
    frame: worst.frame,
    breakdown: worst.classes || {}
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
  console.log(`job ${job.job_id} ${target} -> ${action} (nsfw=${scores.nsfw})`);
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
    return;
  }
  if (consecutiveClaimErrors > 0) {
    if (consecutiveClaimErrors >= 3) console.log("claim recovered");
    consecutiveClaimErrors = 0;
  }
  if (!jobs || jobs.length === 0) return;
  for (const job of jobs) {
    try {
      await processJob(job);
    } catch (e) {
      console.error(`job ${job.job_id} crashed: ${e.message}`);
    }
  }
}

async function main() {
  console.log("Loading NSFWJS model…");
  model = await nsfw.load(); // MobileNetV2, bundled
  console.log(`Model ready. Polling every ${POLL_INTERVAL_MS}ms, batch ${BATCH}.`);
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
  for (;;) {
    try {
      const before = totalProcessed;
      await tick();
      processedSinceBeat += totalProcessed - before;
    } catch (e) {
      console.error(`tick error: ${e.message}`);
    }
    if (Date.now() - lastBeat >= HEARTBEAT_MS) beat();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
