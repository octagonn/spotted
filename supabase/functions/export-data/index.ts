// Data export (Settings → Download my data): gathers EVERY row that belongs to
// the requesting user, zips it as JSON files, and emails the zip via Resend.
//
// Guarantees:
//  - Scope: every query filters on the caller's user id — no other user's
//    content is ever included (messages = only ones THEY sent; friendships/
//    taunts include only the counterparty's uuid, no profile data).
//  - Rate limit (server-side): one export per 30 days per user, enforced
//    against data_export_requests BEFORE any work happens.
//  - Analytics are explicitly EXCLUDED (analytics_events / analytics_
//    preferences), as are internal delivery/moderation tables and push/device
//    tokens.
//  - Media ships as 7-day signed URLs inside the JSON (binaries would blow
//    past Resend's 40MB attachment cap).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Must be an address on the Resend-verified domain — the resend.dev test
// sender can only deliver to the Resend account owner (that was the silent
// export failure: resend_403 on every send).
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Spotted <no-reply@notifications.spottedgymapp.com>";

const SIGN_TTL_SECONDS = 7 * 24 * 60 * 60; // media links live 7 days
const RATE_LIMIT_DAYS = 30;

type Row = Record<string, unknown>;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

/** All rows from `table` matching the PostgREST filter string(s). */
async function grab(
  db: SupabaseClient,
  table: string,
  filter: { column: string; value: string } | { or: string },
  select = "*",
  limit = 5000
): Promise<Row[]> {
  await checkpoint(`gather:${table}`);
  let query = db.from(table).select(select).limit(limit);
  query = "or" in filter ? query.or(filter.or) : query.eq(filter.column, filter.value);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Batch-sign storage paths; unknown/broken paths are skipped silently. */
async function signAll(db: SupabaseClient, bucket: string, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter((p) => p && !/^https?:/i.test(p)))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data } = await db.storage.from(bucket).createSignedUrls(chunk, SIGN_TTL_SECONDS);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

// Progress checkpoints, written into the request row EAGERLY — the runtime is
// killing the isolate mid-run without ever throwing (platform logs are down
// too), so the row's last_stage IS the trace: it shows the last step that
// completed before the kill.
let stage = "start";
let checkpointDb: SupabaseClient | null = null;
let checkpointRowId: string | null = null;
async function checkpoint(name: string): Promise<void> {
  stage = name;
  if (checkpointDb && checkpointRowId) {
    await checkpointDb.from("data_export_requests").update({ last_stage: name }).eq("id", checkpointRowId);
  }
}

/** Simple branded HTML email — black canvas, Spotted wordmark, one info box. */
function emailHtml(): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#000000;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding-bottom:32px;">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:6px;color:#FFFFFF;">SPOTTED</span>
        </td></tr>
        <tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:#8A8A8E;padding-bottom:14px;">
          DATA EXPORT
        </td></tr>
        <tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#FFFFFF;padding-bottom:18px;">
          YOUR DATA.
        </td></tr>
        <tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#B4B4B8;padding-bottom:26px;">
          Everything on your account is attached as a zip file: your profile, posts, workouts and lifts, streak and gym days, messages you sent, friends, and settings.
        </td></tr>
        <tr><td style="border:1px solid #2A2A2E;border-radius:14px;padding:20px 22px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:21px;color:#8A8A8E;">
            <strong style="color:#FFFFFF;">spotted-data-export.zip</strong><br>
            Photo and video links inside the files expire in <strong style="color:#FFFFFF;">7 days</strong> — save anything you want to keep.
          </div>
        </td></tr>
        <tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:#6A6A6E;padding-top:26px;">
          Product analytics and other people's content are never included. If you didn't request this export, change your password in Settings right away.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  stage = "auth";

  // Identify the caller from their JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthorized" });
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json(401, { error: "unauthorized" });
  const uid = user.id;
  const email = user.email;
  if (!email) return json(400, { error: "no_email_on_account" });
  if (!RESEND_API_KEY) return json(500, { error: "resend_not_configured" });

  // ---- Rate limit FIRST (1 per 30 days, server-enforced) ----
  const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("data_export_requests")
    .select("id")
    .eq("user_id", uid)
    .gte("requested_at", cutoff)
    .limit(1);
  if (recent && recent.length > 0) return json(429, { error: "rate_limited" });
  const { data: requestRow, error: requestError } = await db
    .from("data_export_requests")
    .insert({ user_id: uid })
    .select("id")
    .single();
  if (requestError) return json(500, { error: "request_log_failed" });
  checkpointDb = db;
  checkpointRowId = requestRow.id as string;

  try {
    // ---- Gather (every filter is the caller's uid) ----
    const me = { column: "user_id", value: uid };
    const files: Record<string, Row[]> = {
      "profile.json": await grab(db, "profiles", { column: "id", value: uid }),
      "posts.json": await grab(db, "posts", me),
      "stories.json": await grab(db, "stories", me),
      "private_stories.json": await grab(db, "private_stories", { column: "owner_id", value: uid }),
      "messages_sent.json": await grab(db, "messages", { column: "sender_id", value: uid }),
      "message_reactions.json": await grab(db, "message_reactions", me),
      "message_folders.json": await grab(db, "message_folders", me),
      "conversation_memberships.json": await grab(db, "conversation_participants", me),
      "comments.json": await grab(db, "post_comments", me),
      "post_reactions.json": await grab(db, "post_reactions", me),
      "story_likes.json": await grab(db, "story_likes", me),
      "friendships.json": await grab(db, "friendships", { or: `user_id.eq.${uid},friend_id.eq.${uid}` }),
      "close_friends.json": await grab(db, "close_friends", me),
      "blocks.json": await grab(db, "user_blocks", { column: "blocker_id", value: uid }),
      "restrictions.json": await grab(db, "restrictions", { column: "restrictor_id", value: uid }),
      "taunts.json": await grab(db, "taunts", { or: `sender_id.eq.${uid},target_id.eq.${uid}` }),
      "taunt_mutes.json": await grab(db, "taunt_mutes", me),
      "checkins.json": await grab(db, "checkins", me),
      "workouts.json": await grab(db, "workouts", me),
      "lifts.json": await grab(db, "user_lifts", me),
      "custom_exercises.json": await grab(db, "custom_exercises", me),
      "exercise_favorites.json": await grab(db, "exercise_favorites", me),
      "workout_schedule.json": await grab(db, "workout_schedule", me),
      "gym_days.json": await grab(db, "gym_days", me),
      "streak.json": await grab(db, "streaks", me),
      "trophies.json": await grab(db, "user_trophies", me),
      "trophy_events.json": await grab(db, "trophy_events", me),
      "skip_events.json": await grab(db, "skip_events", me),
      "notifications_received.json": await grab(db, "notifications", { column: "recipient_id", value: uid }, "*", 2000),
      "notification_settings.json": await grab(db, "notification_preferences", me),
      "community_memberships.json": await grab(db, "community_members", me),
      "community_messages_sent.json": await grab(db, "community_messages", { column: "sender_id", value: uid }),
      "posts_viewed.json": await grab(db, "post_views", { column: "viewer_id", value: uid }, "*", 2000),
      "stories_viewed.json": await grab(db, "story_views", { column: "viewer_id", value: uid }, "*", 2000),
      "analytics_preference.json": await grab(db, "analytics_preferences", me),
      "analytics_events.json": await grab(db, "analytics_events", me, "*", 5000),
      "activity.json": await grab(db, "user_activity", me),
      "activity_days.json": await grab(db, "user_activity_days", me, "*", 2000),
      "reports_filed.json": await grab(db, "reports", { column: "reporter_id", value: uid }),
      "legal_acceptances.json": await grab(db, "legal_acceptances", me),
      "purchases.json": await grab(
        db,
        "iap_receipts",
        me,
        "id,product_id,transaction_id,purchased_at,expires_at,is_subscription,created_at"
      ),
      "photos_tagged_in.json": await grab(db, "photo_tags", me),
      "posts_tagged_in.json": await grab(db, "post_tags", me),
      "stories_tagged_in.json": await grab(db, "story_tags", me),
      "private_story_memberships.json": await grab(db, "private_story_members", me),
      "communities_created.json": await grab(db, "communities", { column: "created_by", value: uid }),
      "community_join_requests.json": await grab(db, "community_join_requests", me),
      "community_invites.json": await grab(db, "community_invites", { or: `inviter_id.eq.${uid},invitee_id.eq.${uid}` }),
      "community_nudges.json": await grab(db, "community_nudges", me),
      "community_notification_settings.json": await grab(db, "community_notification_prefs", me),
      "messages_hidden.json": await grab(db, "message_hides", me),
      "suggestions_dismissed.json": await grab(db, "suggestion_dismissals", me),
      "post_replays.json": await grab(db, "post_replays", { column: "viewer_id", value: uid }, "*", 2000),
      "profiles_viewed.json": await grab(db, "profile_views", { column: "viewer_id", value: uid }, "*", 2000),
      "gym_arrivals.json": await grab(db, "geofence_events", me, "*", 2000),
      "consumable_grants.json": await grab(db, "consumable_grants", me),
      "export_requests.json": await grab(db, "data_export_requests", me)
    };

    // Push/device tokens are credentials, not "your data" — strip them.
    for (const row of files["notification_settings.json"]) delete (row as Row).push_token;

    // Notifications you RECEIVED are your data, but their payloads can embed
    // text ANOTHER person wrote (a DM preview, a taunt line). Strip that, and
    // the internal push-delivery telemetry, so no one else's words ship.
    for (const row of files["notifications_received.json"]) {
      for (const k of ["push_status", "push_attempts", "push_last_error", "push_next_attempt_at", "push_processed_at"]) {
        delete (row as Row)[k];
      }
      const payload = (row as Row).payload as Record<string, unknown> | null;
      if (payload && (row as Row).actor_id) {
        delete payload.messagePreview;
        delete payload.text;
      }
    }

    // ---- Media: replace storage paths with 7-day signed URLs ----
    await checkpoint("sign_media");
    const postPaths: string[] = [];
    for (const post of files["posts.json"]) {
      for (const key of ["media_url", "inset_url", "thumbnail_url"]) {
        if (typeof post[key] === "string") postPaths.push(post[key] as string);
      }
      if (Array.isArray(post.media_urls)) postPaths.push(...(post.media_urls as string[]));
    }
    for (const story of files["stories.json"]) {
      if (typeof story.media_url === "string") postPaths.push(story.media_url as string);
    }
    const signedPosts = await signAll(db, "posts", postPaths);
    const resolve = (value: unknown) =>
      typeof value === "string" ? (signedPosts.get(value) ?? value) : value;
    for (const post of files["posts.json"]) {
      post.media_url = resolve(post.media_url);
      post.inset_url = resolve(post.inset_url);
      post.thumbnail_url = resolve(post.thumbnail_url);
      if (Array.isArray(post.media_urls)) post.media_urls = (post.media_urls as string[]).map((u) => resolve(u));
    }
    for (const story of files["stories.json"]) story.media_url = resolve(story.media_url);

    const messagePaths = files["messages_sent.json"]
      .map((m) => m.media_url)
      .filter((u): u is string => typeof u === "string");
    const signedMessages = await signAll(db, "messages", messagePaths);
    for (const m of files["messages_sent.json"]) {
      if (typeof m.media_url === "string") m.media_url = signedMessages.get(m.media_url) ?? m.media_url;
    }

    // ---- Zip ----
    const zip = new JSZip();
    zip.file(
      "README.txt",
      [
        "Your Spotted data export",
        `Generated: ${new Date().toISOString()}`,
        `Account: ${email}`,
        "",
        "Each JSON file contains rows that belong to your account only.",
        "Media links inside posts/stories/messages are signed URLs that expire",
        "7 days after this export was generated — download anything you want",
        "to keep.",
        "",
        "Not included: product analytics (excluded by design), other users'",
        "messages or content, and internal delivery/security logs."
      ].join("\n")
    );
    // Compact JSON + STORE (no deflate): edge functions get ~2s of CPU per
    // request, and compressing megabytes of pretty-printed JSON blew past it —
    // the isolate was killed mid-zip with no error surfaced.
    for (const [name, rows] of Object.entries(files)) {
      zip.file(name, JSON.stringify(rows));
    }
    await checkpoint("zip");
    const zipBase64: string = await zip.generateAsync({ type: "base64", compression: "STORE" });
    await checkpoint("email");

    // ---- Email via Resend ----
    const sendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject: "Your Spotted data export",
        text:
          "Your Spotted data export is attached as a zip. It contains your profile, posts, workouts, streak, messages you sent, friends, and settings. Photo and video links inside expire in 7 days. If you did not request this, change your password in Settings.",
        html: emailHtml(),
        attachments: [{ filename: "spotted-data-export.zip", content: zipBase64 }]
      })
    });
    if (!sendResponse.ok) {
      const detail = await sendResponse.text();
      throw new Error(`resend_${sendResponse.status}: ${detail.slice(0, 300)}`);
    }

    await db
      .from("data_export_requests")
      .update({ fulfilled_at: new Date().toISOString(), last_stage: "done" })
      .eq("id", requestRow.id);
    return json(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("export-data failed", stage, message);
    // Record where it died (diagnosable without platform logs), then free the
    // rate-limit slot so a transient failure doesn't lock the user out.
    try {
      await db
        .from("data_export_requests")
        .update({ last_stage: `failed at ${stage}: ${message}`.slice(0, 500) })
        .eq("id", requestRow.id);
    } catch {
      // best effort
    }
    return json(500, { error: "export_failed", stage });
  }
});
