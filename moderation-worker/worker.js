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

async function processJob(job) {
  let worst = { nsfw: 0, frame: null, classes: null };
  for (const path of job.paths) {
    // Fresh signed URL per frame (service role can sign any object).
    const { data: signed, error: signErr } = await supabase.storage
      .from(job.bucket || BUCKET)
      .createSignedUrl(path, 120);
    if (signErr || !signed?.signedUrl) continue;
    const res = await fetch(signed.signedUrl);
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    let classes;
    try {
      classes = await classify(buffer);
    } catch (e) {
      console.warn(`classify failed for ${path}: ${e.message}`);
      continue;
    }
    // Hard-explicit categories drive the verdict. "Sexy" (sports bras, gym
    // selfies) is deliberately EXCLUDED so legit fitness content isn't flagged.
    const nsfwScore = (classes.Porn || 0) + (classes.Hentai || 0);
    if (nsfwScore > worst.nsfw) worst = { nsfw: nsfwScore, frame: path, classes };
  }

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
  const target = job.post_id ? `post ${job.post_id}` : job.story_id ? `story ${job.story_id}` : "unknown";
  console.log(`job ${job.job_id} ${target} -> ${action} (nsfw=${scores.nsfw})`);
}

async function tick() {
  const { data: jobs, error } = await supabase.rpc("claim_moderation_jobs", { p_limit: BATCH });
  if (error) {
    console.error(`claim failed: ${error.message}`);
    return;
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
  // Simple sequential loop — one tick can't overlap the next.
  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error(`tick error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
