import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SkeletonToggleRows } from "@/components/ui/Skeleton";
import { setAnalyticsSession } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";
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

const AUDIENCE_OPTIONS: { key: LocationAudience; label: string }[] = [
  { key: "friends", label: "Friends" },
  { key: "close_friends", label: "Close friends" },
  { key: "nobody", label: "Nobody" }
];
const VISIBILITY_OPTIONS: { key: ScheduleVisibility; label: string }[] = [
  { key: "public", label: "Public" },
  { key: "friends", label: "Friends" },
  { key: "private", label: "Private" }
];

// --- Shared visual language, matched to the Notifications screen ---------------

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onToggle}
      haptic={false}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 3,
        backgroundColor: value ? tokens.accent.gold : colors.iron,
        alignItems: value ? "flex-end" : "flex-start"
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: value ? colors.black : colors.silver
        }}
      />
    </Pressable>
  );
}

function Row({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.graphite
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{title}</Text>
        {sub ? (
          <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>{sub}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

function NavRow({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      haptic={false}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.graphite
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{title}</Text>
        {sub ? (
          <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>{sub}</Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.fog} />
    </Pressable>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        marginTop: 26,
        marginBottom: 4,
        fontFamily: "GeistMono_400Regular",
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: colors.mist
      }}
    >
      {children}
    </Text>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onSelect
}: {
  options: { key: T; label: string }[];
  value: T;
  onSelect: (key: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            haptic={false}
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={8}
          >
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: selected ? colors.white : "transparent",
                borderWidth: 1,
                borderColor: selected ? colors.white : colors.iron
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 11.5,
                  color: selected ? colors.black : colors.silver
                }}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------------------

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

  type BoolKey =
    | "quiet_checkin_default"
    | "ghost_mode"
    | "discoverable"
    | "arrival_notifs_enabled"
    | "show_activity"
    | "dm_preview_enabled";
  const toggle = (key: BoolKey) => updateSettings.mutate({ [key]: !settings[key] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Privacy" />
      {settingsQuery.isLoading ? (
        <SkeletonToggleRows count={8} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
          <SectionLabel>Visibility</SectionLabel>
          <Row
            title="Private account"
            sub="People can find you by username, but must be approved to see your posts, gyms, streak, and friends."
            right={
              <Toggle
                value={settings.is_private}
                onToggle={() =>
                  updateSettings.mutate({ is_private: !settings.is_private, discoverable: settings.is_private })
                }
              />
            }
          />
          <Row
            title="Discoverable"
            sub="Let people at your gym find you."
            right={<Toggle value={settings.discoverable} onToggle={() => toggle("discoverable")} />}
          />
          <Row
            title="Ghost mode"
            sub="Hide your avatar from the gym map."
            right={<Toggle value={settings.ghost_mode} onToggle={() => toggle("ghost_mode")} />}
          />
          <Row
            title="Schedule visibility"
            sub="Friends by default. Public if you mean it."
            right={
              <Segmented
                options={VISIBILITY_OPTIONS}
                value={settings.schedule_visibility}
                onSelect={(option) => updateSettings.mutate({ schedule_visibility: option })}
              />
            }
          />

          <SectionLabel>Location & check-ins</SectionLabel>
          <Row
            title="Who can see my check-ins"
            sub="Your gym location is never public — only these people see it."
            right={
              <Segmented
                options={AUDIENCE_OPTIONS}
                value={settings.location_audience}
                onSelect={(option) => updateSettings.mutate({ location_audience: option })}
              />
            }
          />
          <Row
            title="Quiet check-in by default"
            sub="Log your streak and unlock the feed without posting or notifying anyone."
            right={
              <Toggle value={settings.quiet_checkin_default} onToggle={() => toggle("quiet_checkin_default")} />
            }
          />
          <Row
            title="Arrival notifications"
            sub="Tell friends when you get to the gym."
            right={
              <Toggle value={settings.arrival_notifs_enabled} onToggle={() => toggle("arrival_notifs_enabled")} />
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
            title="Product analytics"
            sub="Share app opens, screens viewed, feature actions, and device platform to help improve Spotted. Never includes photos, messages, contacts, precise location, or advertising IDs. Turning this off deletes your raw analytics."
            right={<Toggle value={analyticsEnabled} onToggle={() => updateAnalytics.mutate(!analyticsEnabled)} />}
          />
          <Row
            title="Sale or sharing of analytics data"
            sub="Spotted does not sell or share your product analytics data."
            right={
              <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 12, color: colors.fog }}>Off</Text>
            }
          />
        </ScrollView>
      )}
    </View>
  );
}
