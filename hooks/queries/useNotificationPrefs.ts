import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** Device IANA timezone via the built-in Intl API (no extra dependency). */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type FriendCheckinScope = "my_gym" | "all_friends" | "off";
export type PushPermissionStatus = "not_asked" | "granted" | "denied";

export type NotificationPrefs = {
  pushEnabled: boolean;
  gymRemindersEnabled: boolean;
  dailyNudgeTime: string; // "HH:MM"
  tauntsEnabled: boolean;
  friendCheckinsScope: FriendCheckinScope;
  messagesEnabled: boolean;
  friendRequestsEnabled: boolean;
  reactionsEnabled: boolean;
  followsEnabled: boolean;
  tagsEnabled: boolean;
  communitiesEnabled: boolean;
  friendActivityEnabled: boolean;
  achievementsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  pushPermissionStatus: PushPermissionStatus;
  pushPromptShownAt: string | null;
  timezone: string;
};


type Row = {
  push_enabled: boolean;
  gym_reminders_enabled: boolean;
  daily_nudge_time: string;
  taunts_enabled: boolean;
  friend_checkins_scope: FriendCheckinScope;
  messages_enabled: boolean;
  friend_requests_enabled: boolean;
  reactions_enabled: boolean;
  follows_enabled: boolean;
  tags_enabled: boolean;
  communities_enabled: boolean;
  friend_activity_enabled: boolean;
  achievements_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  push_permission_status: PushPermissionStatus;
  push_prompt_shown_at: string | null;
  timezone: string;
};

function rowToPrefs(row: Row): NotificationPrefs {
  return {
    pushEnabled: row.push_enabled ?? true,
    gymRemindersEnabled: row.gym_reminders_enabled,
    dailyNudgeTime: (row.daily_nudge_time ?? "16:30").slice(0, 5),
    tauntsEnabled: row.taunts_enabled,
    friendCheckinsScope: row.friend_checkins_scope,
    messagesEnabled: row.messages_enabled,
    friendRequestsEnabled: row.friend_requests_enabled,
    reactionsEnabled: row.reactions_enabled,
    followsEnabled: row.follows_enabled ?? true,
    tagsEnabled: row.tags_enabled ?? true,
    communitiesEnabled: row.communities_enabled ?? true,
    friendActivityEnabled: row.friend_activity_enabled ?? true,
    achievementsEnabled: row.achievements_enabled ?? true,
    // Opt-in since 2026-08-18: off unless the user turned it on.
    quietHoursEnabled: row.quiet_hours_enabled ?? false,
    quietHoursStart: (row.quiet_hours_start ?? "21:00").slice(0, 5),
    quietHoursEnd: (row.quiet_hours_end ?? "06:00").slice(0, 5),
    pushPermissionStatus: row.push_permission_status,
    pushPromptShownAt: row.push_prompt_shown_at,
    timezone: row.timezone
  };
}

const COLUMN: Record<string, string> = {
  pushEnabled: "push_enabled",
  gymRemindersEnabled: "gym_reminders_enabled",
  dailyNudgeTime: "daily_nudge_time",
  tauntsEnabled: "taunts_enabled",
  friendCheckinsScope: "friend_checkins_scope",
  messagesEnabled: "messages_enabled",
  friendRequestsEnabled: "friend_requests_enabled",
  reactionsEnabled: "reactions_enabled",
  followsEnabled: "follows_enabled",
  tagsEnabled: "tags_enabled",
  communitiesEnabled: "communities_enabled",
  friendActivityEnabled: "friend_activity_enabled",
  achievementsEnabled: "achievements_enabled",
  quietHoursEnabled: "quiet_hours_enabled",
  quietHoursStart: "quiet_hours_start",
  quietHoursEnd: "quiet_hours_end",
  pushPermissionStatus: "push_permission_status",
  pushPromptShownAt: "push_prompt_shown_at",
  timezone: "timezone"
};

// Users whose row this process has already created/timezone-synced. Later
// refetches (focus, invalidation after a toggle) are plain reads — the upsert
// on every fetch was a large share of the runaway writes on 2026-09-01.
const tzSynced = new Set<string>();

/** Notification preferences (creates the row with defaults on first read). */
export function useNotificationPrefs() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["notification-prefs", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<NotificationPrefs> => {
      const uid = userId as string;
      if (!tzSynced.has(uid)) {
        // Ensure the row exists and its timezone is current once per app session.
        const { data, error } = await supabase
          .from("notification_preferences")
          .upsert({ user_id: uid, timezone: deviceTimezone() }, { onConflict: "user_id", ignoreDuplicates: false })
          .select("*")
          .single();
        if (error) throw error;
        tzSynced.add(uid);
        return rowToPrefs(data as Row);
      }
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", uid)
        .single();
      if (error) throw error;
      return rowToPrefs(data as Row);
    }
  });
}

/** Patch one or more preference fields. */
export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      if (!isSupabaseConfigured || !userId) return;
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      // Only these three are postgres `time` columns needing an "HH:MM:00"
      // value. NOTE: must be an exact match — `quietHoursEnabled` is a BOOLEAN,
      // so a `startsWith("quietHours")` check would wrongly send it "true:00"
      // and the write would fail, silently reverting the toggle.
      const TIME_KEYS = new Set(["dailyNudgeTime", "quietHoursStart", "quietHoursEnd"]);
      for (const [key, value] of Object.entries(patch)) {
        const col = COLUMN[key];
        if (!col) continue;
        dbPatch[col] = TIME_KEYS.has(key) ? `${value}:00` : value;
      }
      const { error } = await supabase
        .from("notification_preferences")
        .update(dbPatch as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["notification-prefs", userId] });
      const prev = queryClient.getQueryData<NotificationPrefs>(["notification-prefs", userId]);
      if (prev) queryClient.setQueryData(["notification-prefs", userId], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["notification-prefs", userId], ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["notification-prefs", userId] })
  });
}
