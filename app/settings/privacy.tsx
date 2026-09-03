import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import {
  SettingChoice,
  SettingNavRow as NavRow,
  SettingRow as Row,
  SettingSectionLabel as SectionLabel,
  SettingToggle as Toggle
} from "@/components/ui/SettingRow";
import { SkeletonToggleRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { ANALYTICS_CONSENT_VERSION, setAnalyticsSession } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";
import type { Database } from "@/types/database";

type ScheduleVisibility = Database["public"]["Enums"]["schedule_visibility"];

type AnalyticsSettings = {
  product_analytics_enabled: boolean;
  sale_sharing_opt_out: boolean;
  prompted_at: string | null;
};
// NOTE (2026-08-18 privacy audit): ghost_mode, location_audience,
// quiet_checkin_default, and arrival_notifs_enabled were settings for
// features that don't exist (no gym-map avatars, no check-in surface, no
// arrival detection) — nothing enforced them, so their rows were removed.
// The columns remain in the DB, inert.
type PrivacySettings = {
  is_private: boolean;
  /** Public account, friends-only content (posts, streak, workouts). */
  posts_private: boolean;
  friends_list_hidden: boolean;
  discoverable: boolean;
  schedule_visibility: ScheduleVisibility;
  show_activity: boolean;
  dm_preview_enabled: boolean;
};

const defaultSettings: PrivacySettings = {
  is_private: true,
  posts_private: false,
  friends_list_hidden: false,
  discoverable: true,
  schedule_visibility: "friends",
  show_activity: true,
  dm_preview_enabled: true
};

const VISIBILITY_OPTIONS: { key: ScheduleVisibility; label: string }[] = [
  { key: "public", label: "Public" },
  { key: "friends", label: "Friends" },
  { key: "private", label: "Private" }
];

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();
  const queryKey = ["privacy-settings", userId];
  const analyticsQueryKey = ["analytics-preference", userId];

  const settingsQuery = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<PrivacySettings> => {
      if (!isSupabaseConfigured) {
        return defaultSettings;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "is_private, posts_private, friends_list_hidden, discoverable, schedule_visibility, show_activity, dm_preview_enabled"
        )
        .eq("id", userId as string)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return (data as PrivacySettings | null) ?? defaultSettings;
    }
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<PrivacySettings>) => {
      if (!isSupabaseConfigured || !userId) {
        return;
      }
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) {
        throw error;
      }
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PrivacySettings>(queryKey);
      queryClient.setQueryData<PrivacySettings>(queryKey, (current) => ({
        ...(current ?? defaultSettings),
        ...patch
      }));
      return { previous };
    },
    onSuccess: (_data, patch) => {
      for (const [key, value] of Object.entries(patch)) {
        trackAnalyticsEvent("setting_changed", { key, value: typeof value === "boolean" ? value : String(value) });
      }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      showToast("Couldn't update — try again");
    },
    onSettled: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }
  });

  const analyticsQuery = useQuery({
    queryKey: analyticsQueryKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<AnalyticsSettings> => {
      if (!isSupabaseConfigured) {
        return { product_analytics_enabled: false, sale_sharing_opt_out: true, prompted_at: null };
      }
      const { data, error } = await supabase
        .from("analytics_preferences")
        .select("product_analytics_enabled, sale_sharing_opt_out, prompted_at")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data ?? { product_analytics_enabled: false, sale_sharing_opt_out: true, prompted_at: null };
    }
  });

  const updateAnalytics = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!isSupabaseConfigured || !userId) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from("analytics_preferences").upsert(
        {
          user_id: userId,
          product_analytics_enabled: enabled,
          sale_sharing_opt_out: true,
          consent_version: ANALYTICS_CONSENT_VERSION,
          prompted_at: analyticsQuery.data?.prompted_at ?? now,
          consented_at: enabled ? now : null,
          basis: enabled ? "consent" : "declined"
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: analyticsQueryKey });
      const previous = queryClient.getQueryData<AnalyticsSettings>(analyticsQueryKey);
      queryClient.setQueryData<AnalyticsSettings>(analyticsQueryKey, {
        product_analytics_enabled: enabled,
        sale_sharing_opt_out: true,
        prompted_at: previous?.prompted_at ?? new Date().toISOString()
      });
      if (userId) setAnalyticsSession(userId, enabled);
      return { previous };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(analyticsQueryKey, context.previous);
        if (userId) {
          setAnalyticsSession(userId, context.previous.product_analytics_enabled);
        }
      }
      showToast("Couldn't update analytics preference");
    },
    onSettled: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey: analyticsQueryKey });
      }
    }
  });

  const settings = settingsQuery.data ?? defaultSettings;
  const analyticsEnabled = analyticsQuery.data?.product_analytics_enabled ?? false;

  type BoolKey = "posts_private" | "friends_list_hidden" | "discoverable" | "show_activity" | "dm_preview_enabled";
  const toggle = (key: BoolKey) => updateSettings.mutate({ [key]: !settings[key] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Privacy" />
      {settingsQuery.isLoading ? (
        <SkeletonToggleRows count={8} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4] + 4, paddingBottom: insets.bottom + space[8] }}
        >
          <SectionLabel>Visibility</SectionLabel>
          <Row
            title="Private account"
            sub="People can find you by username, but must be approved to see your posts, gyms, streak, and friends."
            right={
              <Toggle
                value={settings.is_private}
                onToggle={() => updateSettings.mutate({ is_private: !settings.is_private })}
              />
            }
          />
          <Row
            title="Private posts"
            sub={
              settings.is_private
                ? "Already covered by Private account."
                : "Keep your account public and findable, but only friends can see your posts, streak, and workouts."
            }
            right={
              <Toggle
                value={settings.is_private || settings.posts_private}
                disabled={settings.is_private}
                onToggle={() => toggle("posts_private")}
              />
            }
          />
          <Row
            title="Hide friends list"
            sub="Nobody — not even friends — can open your friends list. Your friend count stays visible."
            right={<Toggle value={settings.friends_list_hidden} onToggle={() => toggle("friends_list_hidden")} />}
          />
          {/* Scoped down (24 Aug): this toggle no longer touches search or
              friend suggestions — a third of accounts had switched it off
              under its old copy and silently vanished from Add Friends. It now
              governs exactly one surface: phone-contact matching, where your
              email/number is the lookup key. Title + copy say only that. */}
          <Row
            title="Contact matching"
            sub="Let people who have your phone number or email find you when they sync their contacts."
            right={<Toggle value={settings.discoverable} onToggle={() => toggle("discoverable")} />}
          />
          <Row
            title="Schedule visibility"
            sub="Friends by default. Public if you mean it."
            right={
              <SettingChoice
                options={VISIBILITY_OPTIONS}
                value={settings.schedule_visibility}
                onSelect={(option) => updateSettings.mutate({ schedule_visibility: option })}
              />
            }
          />

          <SectionLabel>Activity & messages</SectionLabel>
          <Row
            title="Show activity status"
            sub="Share when you were last active. Turning this off also hides everyone else's status from you."
            right={<Toggle value={settings.show_activity} onToggle={() => toggle("show_activity")} />}
          />
          <Row
            title="Message previews"
            sub={'Show sender name and a preview in new-message notifications. Off shows only "New message."'}
            right={<Toggle value={settings.dm_preview_enabled} onToggle={() => toggle("dm_preview_enabled")} />}
          />

          <SectionLabel>Safety</SectionLabel>
          <NavRow
            title="Blocked accounts"
            sub="People who can't find or message you."
            onPress={() => router.push("/settings/blocked" as Href)}
          />
          <NavRow
            title="Restricted accounts"
            sub="Quietly muted — they're never told."
            onPress={() => router.push("/settings/restricted" as Href)}
          />

          <SectionLabel>Data</SectionLabel>
          <Row
            title="Usage analytics"
            sub="On by default. We use app opens, screens viewed, feature actions, app version, and device platform to improve Spotted. Used only by Spotted, never shared with or sold to third parties. Never includes photos, messages, contacts, precise location, or advertising IDs. Turning this off stops collection and deletes your raw events."
            right={<Toggle value={analyticsEnabled} onToggle={() => updateAnalytics.mutate(!analyticsEnabled)} />}
          />
          <Row
            title="Sharing with third parties"
            sub="Spotted does not sell or share your analytics data. If that ever changes, we will ask for your explicit permission first."
            right={<Text variant="mono">Off</Text>}
          />
        </ScrollView>
      )}
    </View>
  );
}
