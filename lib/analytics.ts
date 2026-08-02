import type { Json } from "@/types/database";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AnalyticsEventName =
  | "app_open"
  | "screen_view"
  | "camera_open"
  | "dual_mode_started"
  | "photo_captured"
  | "photo_saved"
  | "daily_post_published"
  | "story_published"
  | "map_open"
  | "workout_started"
  | "workout_completed"
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_completed";

const ALLOWED_PROPERTIES: Record<AnalyticsEventName, readonly string[]> = {
  app_open: ["platform"],
  screen_view: ["screen"],
  camera_open: ["mode"],
  dual_mode_started: ["mode"],
  photo_captured: ["mode", "dual"],
  photo_saved: ["mode", "dual"],
  daily_post_published: ["dual"],
  story_published: ["dual"],
  map_open: [],
  workout_started: [],
  workout_completed: ["duration_bucket"],
  paywall_viewed: ["source"],
  purchase_started: ["product"],
  purchase_completed: ["product"]
};

let activeUserId: string | null = null;
let collectionEnabled = false;

export function setAnalyticsSession(userId: string | null, enabled: boolean) {
  activeUserId = userId;
  collectionEnabled = Boolean(userId && enabled);
}

function cleanProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown>
): Record<string, Json> {
  const allowed = new Set(ALLOWED_PROPERTIES[eventName]);
  const clean: Record<string, Json> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "boolean" || typeof value === "number") {
      clean[key] = value;
    } else if (typeof value === "string") {
      // Prevent accidental identifiers, free text, or oversized values.
      clean[key] = value.slice(0, 64);
    }
  }
  return clean;
}

/** Best-effort, consent-gated product analytics. Never blocks a user action. */
export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> = {}
) {
  if (!isSupabaseConfigured || !activeUserId || !collectionEnabled) return;

  const userId = activeUserId;
  void supabase
    .from("analytics_events")
    .insert({
      user_id: userId,
      event_name: eventName,
      properties: cleanProperties(eventName, properties)
    })
    .then(({ error }) => {
      if (__DEV__ && error) {
        console.warn("Analytics event was not recorded:", error.message);
      }
    });
}

/** Converts dynamic router paths to a small, non-identifying screen label. */
export function analyticsScreenName(pathname: string): string {
  if (pathname.startsWith("/user/")) return "user_profile";
  if (pathname.startsWith("/chat/")) return "chat";
  if (pathname.startsWith("/post/")) return "post";
  if (pathname.startsWith("/gym/")) return "gym";
  if (pathname.startsWith("/workout/")) return "workout_detail";
  if (pathname.startsWith("/community/")) return "community";
  if (pathname.startsWith("/profile-posts/")) return "profile_posts";
  if (pathname.startsWith("/people/")) return "people";

  const staticName = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2)
    .join("_")
    .replace(/[^a-z0-9_()-]/gi, "");
  return staticName.slice(0, 64) || "home";
}
