import Constants from "expo-constants";
import { useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";

import { setLoggerErrorSink } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

/**
 * First-party usage analytics — on by default (opt-out in Settings → Privacy),
 * opt-in in the EEA/UK/CH (see AnalyticsConsentHost), allowlisted, batched,
 * never blocking. Gated by analytics_preferences.product_analytics_enabled.
 *
 * Every event carries session context (session_id, app_version, platform,
 * os_version) so the metrics tool can reconstruct sessions, funnels, and
 * per-version behaviour. Properties are whitelisted PER EVENT below — a key
 * not in the list is silently dropped, which is what keeps free text,
 * identifiers, and anything the consent copy doesn't cover out of the table.
 *
 * Stays inside the Privacy Policy disclosure: app opens, session length,
 * screens + dwell, feature actions, app/OS version, platform. Used only by
 * Spotted, never shared with third parties. No device model, no location, no
 * message/caption/search text, no contact data.
 */
export type AnalyticsEventName =
  // lifecycle
  | "app_open"
  | "app_background"
  | "app_foreground"
  | "session_end"
  | "screen_view"
  | "client_error"
  // auth + onboarding
  | "sign_in"
  | "sign_out"
  | "profile_created"
  | "onboarding_stage"
  | "push_permission"
  | "notification_opened"
  | "contacts_synced"
  // feed
  | "feed_refreshed"
  | "feed_tab_changed"
  | "lock_cta_tapped"
  | "post_reacted"
  | "post_shared"
  | "post_deleted"
  | "content_reported"
  // camera + posting
  | "camera_open"
  | "dual_mode_started"
  | "photo_captured"
  | "photo_saved"
  | "music_selected"
  | "draft_saved"
  | "gym_geofence_blocked"
  | "daily_post_published"
  | "daily_post_queued_offline"
  | "story_published"
  | "story_viewed"
  | "story_reposted"
  // workouts
  | "workout_started"
  | "workout_completed"
  | "workout_discarded"
  | "routine_saved"
  | "rest_day_marked"
  // social
  | "people_search"
  | "friend_request_sent"
  | "friend_request_responded"
  | "friend_removed"
  | "suggestion_dismissed"
  | "taunt_sent"
  | "message_sent"
  | "message_reacted"
  | "message_forwarded"
  | "setting_changed"
  // misc
  | "map_open"
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_completed";

const ALLOWED_PROPERTIES: Record<AnalyticsEventName, readonly string[]> = {
  app_open: ["platform", "cold"],
  app_background: ["session_sec"],
  app_foreground: ["away_sec"],
  session_end: ["duration_sec", "screens", "events", "reason"],
  screen_view: ["screen", "previous_screen", "dwell_ms"],
  client_error: ["scope", "code"],

  sign_in: ["method"],
  sign_out: [],
  profile_created: [],
  onboarding_stage: ["stage"],
  push_permission: ["status", "prompted"],
  notification_opened: ["type"],
  contacts_synced: ["matches", "invitable"],

  feed_refreshed: ["tab"],
  feed_tab_changed: ["tab"],
  lock_cta_tapped: ["action"],
  post_reacted: ["selfie"],
  post_shared: ["kind"],
  post_deleted: [],
  content_reported: ["content_type", "reason"],

  camera_open: ["mode"],
  dual_mode_started: ["mode"],
  photo_captured: ["mode", "dual"],
  photo_saved: ["mode", "dual"],
  music_selected: ["mode", "has_preview"],
  draft_saved: ["mode"],
  gym_geofence_blocked: [],
  daily_post_published: ["dual", "photo_count", "has_music", "has_workout", "tagged_count", "location_kind", "is_video"],
  daily_post_queued_offline: ["dual"],
  story_published: ["dual"],
  story_viewed: ["own"],
  story_reposted: [],

  workout_started: ["source"],
  workout_completed: ["duration_bucket", "exercises", "sets", "prs", "source", "edited"],
  workout_discarded: ["sets_logged"],
  routine_saved: ["exercises"],
  rest_day_marked: ["rest"],

  people_search: ["query_length", "results"],
  friend_request_sent: ["source"],
  friend_request_responded: ["accepted"],
  friend_removed: [],
  suggestion_dismissed: [],
  taunt_sent: [],
  message_sent: ["reply", "conversation"],
  message_reacted: ["set"],
  message_forwarded: [],
  setting_changed: ["key", "value"],

  map_open: [],
  paywall_viewed: ["source"],
  purchase_started: ["product"],
  purchase_completed: ["product"]
};

/** Bump whenever the analytics disclosure changes; regulated regions re-prompt. */
export const ANALYTICS_CONSENT_VERSION = "2026-08-25";

/* ------------------------------ session state ----------------------------- */

/** A background gap longer than this starts a new session on return. */
const SESSION_GAP_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 4000;
const FLUSH_BATCH_SIZE = 20;
/** touch_user_activity is cheap but pointless more often than this. */
const ACTIVITY_TOUCH_MIN_GAP_MS = 5 * 60 * 1000;

type EventRow = {
  user_id: string;
  event_name: string;
  properties: Record<string, Json>;
  occurred_at: string;
  session_id: string | null;
  app_version: string | null;
  platform: string;
  os_version: string;
};

let activeUserId: string | null = null;
let collectionEnabled = false;
let launched = false;

let sessionId: string | null = null;
let sessionStartedAt = 0;
let sessionScreens = 0;
let sessionEvents = 0;
let backgroundedAt = 0;
let lastScreen: string | null = null;
let lastScreenAt = 0;

let queue: EventRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivityTouch = 0;

function uuidV4(): string {
  // RFC 4122 v4 from Math.random — session ids only need to be unique per user.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const appVersion = (): string | null => Constants.expoConfig?.version ?? null;
const osVersion = (): string => String(Platform.Version ?? "").slice(0, 32);

function cleanProperties(eventName: AnalyticsEventName, properties: Record<string, unknown>): Record<string, Json> {
  const allowed = new Set(ALLOWED_PROPERTIES[eventName]);
  const clean: Record<string, Json> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key) || value === undefined || value === null) continue;
    if (typeof value === "boolean" || typeof value === "number") {
      clean[key] = value;
    } else if (typeof value === "string") {
      // Prevent accidental identifiers, free text, or oversized values.
      clean[key] = value.slice(0, 64);
    }
  }
  return clean;
}

/* ------------------------------ batching ---------------------------------- */

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, FLUSH_INTERVAL_MS);
}

/** Send everything queued. Safe to call any time; errors are dropped. */
export async function flushAnalytics(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0 || !isSupabaseConfigured) return;
  const batch = queue;
  queue = [];
  const { error } = await supabase.from("analytics_events").insert(batch);
  if (__DEV__ && error) {
    console.warn(`Analytics batch (${batch.length}) was not recorded:`, error.message);
  }
}

function enqueue(row: EventRow) {
  queue.push(row);
  sessionEvents += 1;
  if (queue.length >= FLUSH_BATCH_SIZE) void flushAnalytics();
  else scheduleFlush();
}

/** Best-effort, consent-gated product analytics. Never blocks a user action. */
export function trackAnalyticsEvent(eventName: AnalyticsEventName, properties: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured || !activeUserId || !collectionEnabled) return;
  enqueue({
    user_id: activeUserId,
    event_name: eventName,
    properties: cleanProperties(eventName, properties),
    occurred_at: new Date().toISOString(),
    session_id: sessionId,
    app_version: appVersion(),
    platform: Platform.OS,
    os_version: osVersion()
  });
}

/**
 * Screen views with dwell time: the previous screen's time-on-screen rides on
 * the NEXT screen_view, so the tool can compute where people actually spend
 * time, not just what they tap through.
 */
export function trackScreenView(screen: string) {
  const now = Date.now();
  const props: Record<string, unknown> = { screen };
  if (lastScreen && lastScreenAt) {
    props.previous_screen = lastScreen;
    props.dwell_ms = Math.min(now - lastScreenAt, 60 * 60 * 1000);
  }
  lastScreen = screen;
  lastScreenAt = now;
  sessionScreens += 1;
  trackAnalyticsEvent("screen_view", props);
}

/** Errors as signal: only a short code/scope, never the message text. */
export function trackClientError(scope: string, code?: string | number | null) {
  trackAnalyticsEvent("client_error", { scope, code: code == null ? undefined : String(code) });
}

/* ------------------------------ sessions ---------------------------------- */

function beginSession(cold: boolean) {
  sessionId = uuidV4();
  sessionStartedAt = Date.now();
  sessionScreens = 0;
  sessionEvents = 0;
  lastScreen = null;
  lastScreenAt = 0;
  trackAnalyticsEvent("app_open", { platform: Platform.OS, cold });
}

function endSession(reason: "background_timeout" | "sign_out" | "consent_off") {
  if (!sessionId) return;
  trackAnalyticsEvent("session_end", {
    duration_sec: Math.round((Date.now() - sessionStartedAt) / 1000),
    screens: sessionScreens,
    events: sessionEvents,
    reason
  });
  sessionId = null;
  void flushAnalytics();
}

/**
 * Called by the consent host whenever the signed-in user or their consent
 * changes. Starts a session when collection becomes possible, ends it when it
 * stops. Idempotent for repeated calls with the same state.
 */
export function setAnalyticsSession(userId: string | null, enabled: boolean) {
  const nextEnabled = Boolean(userId && enabled);
  const userChanged = userId !== activeUserId;
  if (sessionId && (!nextEnabled || userChanged)) {
    endSession(userChanged ? "sign_out" : "consent_off");
  }
  activeUserId = userId;
  collectionEnabled = nextEnabled;
  if (nextEnabled && !sessionId) {
    beginSession(!launched);
    launched = true;
  }
}

function handleAppState(state: AppStateStatus) {
  if (state === "background" || state === "inactive") {
    if (!backgroundedAt) {
      backgroundedAt = Date.now();
      if (sessionId) {
        trackAnalyticsEvent("app_background", { session_sec: Math.round((Date.now() - sessionStartedAt) / 1000) });
      }
      // The OS may suspend us any moment — get the queue out now.
      void flushAnalytics();
    }
    return;
  }
  if (state === "active" && backgroundedAt) {
    const away = Date.now() - backgroundedAt;
    backgroundedAt = 0;
    if (!collectionEnabled) return;
    if (sessionId && away > SESSION_GAP_MS) {
      endSession("background_timeout");
      beginSession(false);
    } else if (sessionId) {
      trackAnalyticsEvent("app_foreground", { away_sec: Math.round(away / 1000) });
    } else {
      beginSession(false);
    }
  }
}

AppState.addEventListener("change", handleAppState);
// logger.warn/error become client_error events (code only, no message text).
setLoggerErrorSink(trackClientError);

/* --------------------- consent-independent activity ----------------------- */

/**
 * Bumps the backend-only user_activity ledger (last active, active days,
 * session count, version). NOT product analytics — it's the same class of
 * data as last login — so it runs for every signed-in user regardless of the
 * analytics consent. Feeds DAU/retention for the whole user base.
 */
export function touchUserActivity() {
  if (!isSupabaseConfigured) return;
  const now = Date.now();
  if (now - lastActivityTouch < ACTIVITY_TOUCH_MIN_GAP_MS) return;
  lastActivityTouch = now;
  void supabase
    .rpc("touch_user_activity", { p_app_version: appVersion(), p_platform: Platform.OS })
    .then(({ error }) => {
      if (error) lastActivityTouch = 0;
    });
}

/** Mount once (root services): touch on launch and on every foreground. */
export function useActivityHeartbeat(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    lastActivityTouch = 0;
    touchUserActivity();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") touchUserActivity();
    });
    return () => subscription.remove();
  }, [userId]);
}

/* ------------------------------ helpers ----------------------------------- */

/** Converts dynamic router paths to a small, non-identifying screen label. */
export function analyticsScreenName(pathname: string): string {
  if (pathname.startsWith("/user/")) return "user_profile";
  if (pathname.startsWith("/chat-details/")) return "chat_details";
  if (pathname.startsWith("/chat/")) return "chat";
  if (pathname.startsWith("/post/")) return "post";
  if (pathname.startsWith("/gym/")) return "gym";
  if (pathname.startsWith("/workout/")) return "workout_detail";
  if (pathname.startsWith("/community/")) return "community";
  if (pathname.startsWith("/profile-posts/")) return "profile_posts";
  if (pathname.startsWith("/tagged-posts/")) return "tagged_posts";
  if (pathname.startsWith("/daily/")) return "day_viewer";
  if (pathname.startsWith("/people/")) return "people";
  if (pathname.startsWith("/trophy/") || pathname.startsWith("/achievement/")) return "trophy";
  if (pathname.startsWith("/profile-section/")) return "profile_section";

  const staticName = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2)
    .join("_")
    .replace(/[^a-z0-9_()-]/gi, "");
  return staticName.slice(0, 64) || "home";
}

/** Seconds → coarse bucket so durations stay non-identifying. */
export function durationBucket(seconds: number): string {
  if (seconds < 60 * 15) return "<15m";
  if (seconds < 60 * 30) return "15-30m";
  if (seconds < 60 * 45) return "30-45m";
  if (seconds < 60 * 60) return "45-60m";
  if (seconds < 60 * 90) return "60-90m";
  return ">90m";
}
