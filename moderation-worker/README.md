# Spotted — NSFW Moderation Worker

Self-hosted NSFWJS worker that moderates uploaded post images. It **pulls** jobs
from Supabase and only makes **outbound** calls, so it needs no inbound ports,
tunnel, or public exposure — run it anywhere with internet access (server130).

## How it fits

1. A user posts an image → `publishDailyPost` uploads it and inserts the post
   row with `moderation_status = 'pending'` (shown optimistically in the feed).
2. A DB trigger enqueues a `moderation_jobs` row (main frame + dual-camera inset).
3. This worker polls `claim_moderation_jobs`, downloads each frame via a short-
   lived signed URL, and classifies it with **both** bundled NSFWJS models
   (MobileNetV2 + InceptionV3). Every class is scored as the **min** across
   the two — a frame has to convince both models to count.
4. It calls `resolve_moderation_job` with `{ nsfw, frame, breakdown, models }`.
   The **database** applies the policy:
   - `nsfw >= 0.60` or `breakdown.Sexy >= 0.80` → **hide from the feed + admin
     review queue** (`flagged`)
   - otherwise → `approved`

   `nsfw = Porn + Hentai`. **Nothing is ever auto-deleted** — the only delete
   is an admin rejecting from the review screen.
5. A user **report** on a post also flags it immediately (`flag_post_from_report`).
6. Flagged posts are hidden from everyone but the owner (they see "Under
   review"). Admins clear the queue in **Settings → Review** (`review_queue` /
   `review_resolve`). A reject deletes the row and queues its R2 keys in
   `media_purge_queue`; this worker drains that queue (`claim_media_purges`)
   because only the service key may delete another user's objects.

### Why two models (Sept 2026)

MobileNetV2 alone flagged 10 posts in a month and **every one was a false
positive**: a leg-curl machine (Hentai 0.955), a blurry living room (Porn
0.79), a car interior (Hentai 0.88), hoodie + shorts (Sexy 0.99), a shaka out
a car window (Sexy 0.98). InceptionV3 is calmer on those but has its own misses
(Porn 0.965 on the same blurry room). Real explicit content lights up both;
the false positives are model-specific noise, so the min clears all ten while
keeping the thresholds. Each job's `result.models` keeps the raw per-model
output for the reported frame so you can see which model fired.

The old `nsfw >= 0.90 → delete` branch was removed for two reasons: it fired
on the leg-curl machine, and it was broken anyway (`delete from
storage.objects` is blocked by Supabase, so the transaction aborted and the
job was re-claimed every poll — 2,628 attempts over 10 days).

## Setup (server130)

```bash
cd moderation-worker
cp .env.example .env
# edit .env — set SUPABASE_URL and the SERVICE ROLE key
docker compose up -d --build
docker compose logs -f      # watch it load the model + process jobs
```

The **service role key** is required (it signs storage URLs and writes verdicts).
It is a secret — it lives only on the server, never in the app bundle.

## Env

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `SUPABASE_URL` | yes | — | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | service role, secret |
| `POLL_INTERVAL_MS` | no | `5000` | how often to poll for jobs |
| `BATCH` | no | `5` | jobs claimed per tick |

## Tuning the thresholds

Thresholds live in the DB (`resolve_moderation_job`), not here, so you can
retune without redeploying the worker. Lower the `0.60` / `0.80` flag bands
for stricter review. Before changing anything, look at what's actually in the
queue — `select id, moderation_score->'models' from posts where
moderation_status = 'flagged'` shows which model tripped and by how much.

**Someone has to work the review queue.** Flagged posts stay hidden until an
admin approves or rejects them; in Aug–Sep 2026 nobody did and users saw
"Under review" for weeks.

## Making yourself an admin (to see the review queue)

```sql
insert into app_admins (user_id) values ('<your-profile-uuid>');
```

## Scaling

Multiple worker instances are safe — `claim_moderation_jobs` uses
`FOR UPDATE SKIP LOCKED`, so no two workers grab the same job. Stalled
`processing` jobs (worker died mid-flight) are automatically reclaimed after
5 minutes.
