# Spotted — NSFW Moderation Worker

Self-hosted NSFWJS worker that moderates uploaded post images. It **pulls** jobs
from Supabase and only makes **outbound** calls, so it needs no inbound ports,
tunnel, or public exposure — run it anywhere with internet access (server130).

## How it fits

1. A user posts an image → `publishDailyPost` uploads it and inserts the post
   row with `moderation_status = 'pending'` (shown optimistically in the feed).
2. A DB trigger enqueues a `moderation_jobs` row (main frame + dual-camera inset).
3. This worker polls `claim_moderation_jobs`, downloads each frame via a short-
   lived signed URL, and classifies it with NSFWJS (MobileNetV2).
4. It calls `resolve_moderation_job` with `{ nsfw, breakdown }`. The **database**
   applies the policy:
   - `nsfw >= 0.90` → **auto-delete** the post + its storage objects (`rejected`)
   - `nsfw >= 0.60` → **hide from the feed + admin review queue** (`flagged`)
   - otherwise → `approved`

   `nsfw = Porn + Hentai`. NSFWJS's **"Sexy"** class (sports bras, gym selfies)
   is deliberately excluded so legitimate fitness content is never flagged.
5. A user **report** on a post also flags it immediately (`flag_post_from_report`).
6. Flagged posts are hidden from everyone but the owner (they see "Under review");
   rejected posts are gone. Admins clear the queue via `review_queue` /
   `review_resolve`.

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
retune without redeploying the worker. Lower the `0.60` flag band for stricter
review; raise the `0.90` auto-delete band to be more conservative about
destroying posts.

## Making yourself an admin (to see the review queue)

```sql
insert into app_admins (user_id) values ('<your-profile-uuid>');
```

## Scaling

Multiple worker instances are safe — `claim_moderation_jobs` uses
`FOR UPDATE SKIP LOCKED`, so no two workers grab the same job. Stalled
`processing` jobs (worker died mid-flight) are automatically reclaimed after
5 minutes.
