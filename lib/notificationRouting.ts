export type NotificationRouteInput = {
  type?: string | null;
  actorId?: string | null;
  actorUsername?: string | null;
  payload?: Record<string, unknown> | null;
  url?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z0-9_]{3,20}$/;

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function uuidValue(value: unknown): string | null {
  const valueString = stringValue(value);
  return valueString && UUID.test(valueString) ? valueString : null;
}

/**
 * Accept only routes the app itself can emit. Push data is remote input, so a
 * raw URL from a notification must never be passed straight to Expo Router.
 */
export function isSafeNotificationRoute(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 240 || value.includes("\\") || value.includes("//")) {
    return false;
  }
  return (
    value === "/(tabs)/feed" ||
    value === "/camera?mode=daily" ||
    value === "/inbox" ||
    value === "/profile-section/trophies" ||
    value === "/settings/privacy" ||
    value === "/settings/legal/privacy" ||
    value === "/settings/legal/terms" ||
    /^\/chat\/[0-9a-f-]{36}(\?group=1)?$/i.test(value) ||
    /^\/post\/[0-9a-f-]{36}$/i.test(value) ||
    /^\/community\/[0-9a-f-]{36}(\?tab=(Chat|Board|Feed|Members))?$/i.test(value) ||
    /^\/user\/[a-z0-9_]{3,20}$/.test(value)
  );
}

/** Resolve every database notification type to the screen it belongs to. */
export function routeForNotification(input: NotificationRouteInput): string {
  if (isSafeNotificationRoute(input.url)) {
    return input.url;
  }

  const payload = input.payload ?? {};
  const postId = uuidValue(payload.post_id) ?? uuidValue(payload.postId);
  const communityId = uuidValue(payload.community_id) ?? uuidValue(payload.communityId);
  const actorId = uuidValue(input.actorId);
  const actorUsername =
    typeof input.actorUsername === "string" && USERNAME.test(input.actorUsername)
      ? input.actorUsername
      : null;

  switch (input.type) {
    case "dm": {
      // Group messages route to the GROUP thread, not a 1:1 with the sender.
      const conversationId = uuidValue(payload.conversation_id);
      if (payload.is_group === true && conversationId) return `/chat/${conversationId}?group=1`;
      return actorId ? `/chat/${actorId}` : "/inbox";
    }
    case "post_view":
    case "post_reaction":
    case "post_comment":
    case "mention":
    case "taunt_answered":
    case "second_workout":
      return postId ? `/post/${postId}` : "/inbox";
    case "tagged":
      if (postId) return `/post/${postId}`;
      return actorUsername ? `/user/${actorUsername}` : "/inbox";
    case "community_invite":
    case "community_nudge":
      return communityId ? `/community/${communityId}` : "/inbox";
    case "community_message":
      return communityId ? `/community/${communityId}?tab=Chat` : "/inbox";
    case "streak_milestone":
    case "trophy_unlocked":
    case "claim_approved":
    case "claim_rejected":
      return "/profile-section/trophies";
    case "daily_nudge":
    case "arrival_buzz":
      return "/(tabs)/feed";
    case "taunt":
      // A taunt has exactly one answer. Land on the daily camera, not the
      // sender's profile — posting is what closes the loop (and credits them).
      return "/camera?mode=daily";
    case "system_notice":
      // Actor-less notices carry their own destination (allowlisted above).
      return isSafeNotificationRoute(payload.route) ? payload.route : "/inbox";
    default:
      return actorUsername ? `/user/${actorUsername}` : "/inbox";
  }
}

