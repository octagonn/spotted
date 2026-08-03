import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import {
  analyticsScreenName,
  setAnalyticsSession,
  trackAnalyticsEvent
} from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

const CONSENT_VERSION = "2026-07-25";

type AnalyticsPreference = {
  user_id: string;
  product_analytics_enabled: boolean;
  sale_sharing_opt_out: boolean;
  consent_version: string;
  prompted_at: string | null;
  consented_at: string | null;
};

export function AnalyticsConsentHost({
  userId,
  pathname
}: {
  userId: string | null;
  pathname: string;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const openedFor = useRef<string | null>(null);
  const lastScreen = useRef<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const queryKey = ["analytics-preference", userId];

  useEffect(() => {
    setDismissed(false);
  }, [userId]);

  const preferenceQuery = useQuery({
    queryKey,
    enabled: Boolean(userId && isSupabaseConfigured),
    queryFn: async (): Promise<AnalyticsPreference | null> => {
      const { data, error } = await supabase
        .from("analytics_preferences")
        .select(
          "user_id, product_analytics_enabled, sale_sharing_opt_out, consent_version, prompted_at, consented_at"
        )
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const preference = preferenceQuery.data;
  const enabled = preference?.product_analytics_enabled === true;

  useEffect(() => {
    if (!userId || preference === undefined) {
      setAnalyticsSession(null, false);
      return;
    }
    setAnalyticsSession(userId, enabled);
    if (enabled && openedFor.current !== userId) {
      openedFor.current = userId;
      trackAnalyticsEvent("app_open", { platform: Platform.OS });
    }
    if (!enabled) openedFor.current = null;
  }, [enabled, preference, userId]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const screen = analyticsScreenName(pathname);
    const key = `${userId}:${screen}`;
    if (lastScreen.current === key) return;
    lastScreen.current = key;
    trackAnalyticsEvent("screen_view", { screen });
  }, [enabled, pathname, userId]);

  const saveChoice = useMutation({
    mutationFn: async (productAnalyticsEnabled: boolean) => {
      if (!userId) return null;
      const now = new Date().toISOString();
      const row = {
        user_id: userId,
        product_analytics_enabled: productAnalyticsEnabled,
        sale_sharing_opt_out: true,
        consent_version: CONSENT_VERSION,
        prompted_at: now,
        consented_at: productAnalyticsEnabled ? now : null
      };
      const { data, error } = await supabase
        .from("analytics_preferences")
        .upsert(row, { onConflict: "user_id" })
        .select(
          "user_id, product_analytics_enabled, sale_sharing_opt_out, consent_version, prompted_at, consented_at"
        )
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      if (row) queryClient.setQueryData(queryKey, row);
    }
  });

  const visible =
    Boolean(userId) &&
    isSupabaseConfigured &&
    preferenceQuery.isSuccess &&
    preference === null &&
    !dismissed;

  const decline = () => {
    // Never trap the user behind a network-dependent consent prompt. Collection
    // remains off even if saving the declined choice has to be retried later.
    setDismissed(true);
    saveChoice.mutate(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={decline}
      statusBarTranslucent
    >
      <View
        accessibilityViewIsModal
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" }}
      >
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron,
            paddingHorizontal: 24,
            paddingTop: 26,
            paddingBottom: insets.bottom + 20
          }}
        >
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              borderWidth: 1,
              borderColor: colors.slate,
              backgroundColor: colors.charcoal,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <BarChart3 size={23} color={colors.white} strokeWidth={2} />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 18,
              fontFamily: "Boldonse_400Regular",
              fontSize: 18,
              lineHeight: 26,
              color: colors.white
            }}
          >
            Help improve Spotted
          </Text>
          <Text
            style={{
              marginTop: 12,
              fontFamily: "Geist_400Regular",
              fontSize: 14,
              lineHeight: 21,
              color: colors.mist
            }}
          >
            If you agree, we&apos;ll collect app opens, screens viewed, feature actions, and
            your device platform. We use it only to improve Spotted and keep raw events for
            up to 90 days.
          </Text>
          <Text
            style={{
              marginTop: 10,
              fontFamily: "Geist_600SemiBold",
              fontSize: 13,
              lineHeight: 19,
              color: colors.bone
            }}
          >
            This never includes your photos, messages, contacts, precise location, or
            advertising ID. We do not sell or share this analytics data.
          </Text>
          {saveChoice.isError ? (
            <Text style={{ marginTop: 10, fontSize: 12, color: colors.mist }}>
              We couldn&apos;t save that choice. Please try again.
            </Text>
          ) : null}
          <View style={{ marginTop: 22, gap: 9 }}>
            <Button
              onPress={() => saveChoice.mutate(true)}
              loading={saveChoice.isPending && saveChoice.variables === true}
              disabled={saveChoice.isPending}
            >
              Help improve Spotted
            </Button>
            <Button
              variant="ghost"
              onPress={decline}
              loading={saveChoice.isPending && saveChoice.variables === false}
              disabled={saveChoice.isPending}
            >
              Not now
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
