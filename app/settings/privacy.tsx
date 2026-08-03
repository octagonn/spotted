import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { router, type Href } from "expo-router";

import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Chip } from "@/components/ui/Chip";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { setAnalyticsSession } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import type { Database } from "@/types/database";

type ScheduleVisibility = Database["public"]["Enums"]["schedule_visibility"];

type LocationAudience = "friends" | "close_friends" | "nobody";
type AnalyticsSettings = {
  product_analytics_enabled: boolean;
  sale_sharing_opt_out: boolean;
  prompted_at: string | null;
};
type PrivacySettings = {
  is_private: boolean;
  location_audience: LocationAudience;
  quiet_checkin_default: boolean;
  ghost_mode: boolean;
  discoverable: boolean;
  schedule_visibility: ScheduleVisibility;
  arrival_notifs_enabled: boolean;
  show_activity: boolean;
  dm_preview_enabled: boolean;
};

const defaultSettings: PrivacySettings = {
  is_private: true,
  location_audience: "friends",
  quiet_checkin_default: false,
  ghost_mode: false,
  discoverable: true,
  schedule_visibility: "friends",
  arrival_notifs_enabled: true,
  show_activity: true,
  dm_preview_enabled: true
};

const visibilityOptions: ScheduleVisibility[] = ["public", "friends", "private"];

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      className={`h-7 w-12 justify-center rounded-pill border px-1 ${
        value ? "border-white bg-white" : "border-hairline-strong bg-glass"
      }`}
      onPress={onToggle}
    >
      <View
        className={`h-5 w-5 rounded-full ${value ? "self-end bg-black" : "self-start bg-mist"}`}
      />
    </Pressable>
  );
}

export default function PrivacySettingsScreen() {
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
        .select("is_private, location_audience, quiet_checkin_default, ghost_mode, discoverable, schedule_visibility, arrival_notifs_enabled, show_activity, dm_preview_enabled")
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
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
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
        return {
          product_analytics_enabled: false,
          sale_sharing_opt_out: true,
          prompted_at: null
        };
      }
      const { data, error } = await supabase
        .from("analytics_preferences")
        .select("product_analytics_enabled, sale_sharing_opt_out, prompted_at")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return (
        data ?? {
          product_analytics_enabled: false,
          sale_sharing_opt_out: true,
          prompted_at: null
        }
      );
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
          consent_version: "2026-07-25",
          prompted_at: analyticsQuery.data?.prompted_at ?? now,
          consented_at: enabled ? now : null
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

  function toggle(key: "is_private" | "quiet_checkin_default" | "ghost_mode" | "discoverable" | "arrival_notifs_enabled" | "show_activity" | "dm_preview_enabled") {
    updateSettings.mutate({ [key]: !settings[key] });
  }

  return (
    <Screen>
      <BackButton fallback="/settings" style={{ marginBottom: 18 }} />
      <Text variant="display-sm">PRIVACY</Text>
      <View className="mt-8 gap-3">
        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Private account</Text>
            <Text variant="caption" className="mt-2">
              People can find you by username, but must be approved to see your posts, gyms, streak, and friends.
            </Text>
          </View>
          <Toggle value={settings.is_private} onToggle={() => updateSettings.mutate({ is_private: !settings.is_private, discoverable: settings.is_private })} />
        </View>

        <View className="border border-hairline-strong bg-ink p-4">
          <Text variant="body-strong">Who can see my check-ins</Text>
          <Text variant="caption" className="mt-2">
            Your gym location is never public — only these people see it.
          </Text>
          <View className="mt-4 flex-row gap-2">
            {(["friends","close_friends","nobody"] as const).map((option) => (
              <Chip
                key={option}
                selected={settings.location_audience === option}
                onPress={() => updateSettings.mutate({ location_audience: option })}
              >
                {option === "close_friends" ? "CLOSE FRIENDS" : option.toUpperCase()}
              </Chip>
            ))}
          </View>
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Quiet check-in by default</Text>
            <Text variant="caption" className="mt-2">
              Log your streak and unlock the feed without posting or notifying anyone.
            </Text>
          </View>
          <Toggle value={settings.quiet_checkin_default} onToggle={() => toggle("quiet_checkin_default")} />
        </View>

        <Pressable accessibilityLabel="Blocked accounts" onPress={() => router.push("/settings/blocked" as Href)} className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <Text variant="body-strong" className="flex-1">Blocked accounts</Text>
          <Text variant="caption">Manage</Text>
        </Pressable>
        <Pressable accessibilityLabel="Restricted accounts" onPress={() => router.push("/settings/restricted" as Href)} className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <Text variant="body-strong" className="flex-1">Restricted accounts</Text>
          <Text variant="caption">Manage</Text>
        </Pressable>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Ghost mode</Text>
            <Text variant="caption" className="mt-2">
              Hide your avatar from the gym map.
            </Text>
          </View>
          <Toggle value={settings.ghost_mode} onToggle={() => toggle("ghost_mode")} />
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Discoverable</Text>
            <Text variant="caption" className="mt-2">
              Let people at your gym find you.
            </Text>
          </View>
          <Toggle value={settings.discoverable} onToggle={() => toggle("discoverable")} />
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Show activity status</Text>
            <Text variant="caption" className="mt-2">
              Share when you were last active. Turning this off also hides
              everyone else&apos;s status from you.
            </Text>
          </View>
          <Toggle value={settings.show_activity} onToggle={() => toggle("show_activity")} />
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Message previews</Text>
            <Text variant="caption" className="mt-2">
              Show sender name and a preview in new-message notifications. Off
              shows only &ldquo;New message.&rdquo;
            </Text>
          </View>
          <Toggle value={settings.dm_preview_enabled} onToggle={() => toggle("dm_preview_enabled")} />
        </View>

        <View className="border border-hairline-strong bg-ink p-4">
          <Text variant="body-strong">Schedule visibility</Text>
          <Text variant="caption" className="mt-2">
            Friends by default. Public if you mean it.
          </Text>
          <View className="mt-4 flex-row gap-2">
            {visibilityOptions.map((option) => (
              <Chip
                key={option}
                selected={settings.schedule_visibility === option}
                onPress={() => updateSettings.mutate({ schedule_visibility: option })}
              >
                {option.toUpperCase()}
              </Chip>
            ))}
          </View>
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Arrival notifications</Text>
            <Text variant="caption" className="mt-2">
              Tell friends when you get to the gym.
            </Text>
          </View>
          <Toggle
            value={settings.arrival_notifs_enabled}
            onToggle={() => toggle("arrival_notifs_enabled")}
          />
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Product analytics</Text>
            <Text variant="caption" className="mt-2">
              Share app opens, screens viewed, feature actions, and device platform to
              help improve Spotted. Never includes photos, messages, contacts, precise
              location, or advertising IDs. Turning this off deletes your raw analytics.
            </Text>
          </View>
          <Toggle
            value={analyticsEnabled}
            onToggle={() => updateAnalytics.mutate(!analyticsEnabled)}
          />
        </View>

        <View className="border border-hairline-strong bg-ink p-4">
          <Text variant="body-strong">Sale or sharing of analytics data</Text>
          <Text variant="caption" className="mt-2">
            Off. Spotted does not sell or share your product analytics data.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
