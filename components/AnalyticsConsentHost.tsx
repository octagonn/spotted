import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Localization from "expo-localization";
import { BarChart3 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { ANALYTICS_CONSENT_VERSION, analyticsScreenName, setAnalyticsSession, trackScreenView } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

/**
 * First-party usage analytics is ON by default (disclosed in the Privacy
 * Policy, opt-out under Settings → Privacy). Users in the EEA / UK /
 * Switzerland are asked for opt-in consent instead (GDPR + ePrivacy treat
 * on-device analytics as consent-based); nothing is collected for them until
 * they say yes.
 *
 * `basis` on the preference row records how the current state came to be:
 * consent (affirmative), default (on by default), declined.
 */
const REGULATED_REGIONS = new Set([
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
  "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA
  "IS", "LI", "NO",
  // UK + Switzerland
  "GB", "CH"
]);

export function isRegulatedRegion(): boolean {
  try {
    const region = Localization.getLocales()[0]?.regionCode?.toUpperCase();
    return region ? REGULATED_REGIONS.has(region) : false;
  } catch {
    return false;
  }
}

type AnalyticsPreference = {
  user_id: string;
  product_analytics_enabled: boolean;
  sale_sharing_opt_out: boolean;
  consent_version: string;
  prompted_at: string | null;
  consented_at: string | null;
  basis: "consent" | "default" | "declined";
};

const PREFERENCE_COLUMNS =
  "user_id, product_analytics_enabled, sale_sharing_opt_out, consent_version, prompted_at, consented_at, basis";

export function AnalyticsConsentHost({
  userId,
  pathname
}: {
  userId: string | null;
  pathname: string;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const lastScreen = useRef<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const queryKey = ["analytics-preference", userId];
  const regulated = isRegulatedRegion();

  useEffect(() => {
    setDismissed(false);
  }, [userId]);

  const preferenceQuery = useQuery({
    queryKey,
    enabled: Boolean(userId && isSupabaseConfigured),
    queryFn: async (): Promise<AnalyticsPreference | null> => {
      const { data, error } = await supabase
        .from("analytics_preferences")
        .select(PREFERENCE_COLUMNS)
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data as AnalyticsPreference | null;
    }
  });

  const preference = preferenceQuery.data;
  // A default-on row does not count as consent in a regulated region.
  const enabled =
    preference?.product_analytics_enabled === true && !(regulated && preference.basis === "default");
  // Regulated users must be asked: no row yet, or a row that was only defaulted on.
  const needsPrompt = regulated && (preference === null || preference?.basis === "default");

  useEffect(() => {
    if (!userId || preference === undefined) {
      setAnalyticsSession(null, false);
      return;
    }
    // Session start/end (and app_open) are owned by lib/analytics.
    setAnalyticsSession(userId, enabled);
  }, [enabled, preference, userId]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const screen = analyticsScreenName(pathname);
    const key = `${userId}:${screen}`;
    if (lastScreen.current === key) return;
    lastScreen.current = key;
    trackScreenView(screen);
  }, [enabled, pathname, userId]);

  const saveChoice = useMutation({
    mutationFn: async (choice: "consent" | "declined" | "default") => {
      if (!userId) return null;
      const now = new Date().toISOString();
      const row = {
        user_id: userId,
        product_analytics_enabled: choice !== "declined",
        sale_sharing_opt_out: true,
        consent_version: ANALYTICS_CONSENT_VERSION,
        prompted_at: choice === "default" ? null : now,
        consented_at: choice === "consent" ? now : null,
        basis: choice
      };
      const { data, error } = await supabase
        .from("analytics_preferences")
        .upsert(row, { onConflict: "user_id" })
        .select(PREFERENCE_COLUMNS)
        .single();
      if (error) throw error;
      return data as AnalyticsPreference;
    },
    onSuccess: (row) => {
      if (row) queryClient.setQueryData(queryKey, row);
    }
  });

  // Outside regulated regions there is no prompt: a missing row (pre-trigger
  // accounts, or a trigger race) is created as default-on, silently.
  const creatingDefault = useRef(false);
  useEffect(() => {
    if (!userId || !isSupabaseConfigured || regulated) return;
    if (preferenceQuery.isSuccess && preference === null && !creatingDefault.current) {
      creatingDefault.current = true;
      saveChoice.mutate("default", { onSettled: () => (creatingDefault.current = false) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, regulated, preferenceQuery.isSuccess, preference]);

  const visible = Boolean(userId) && isSupabaseConfigured && preferenceQuery.isSuccess && needsPrompt && !dismissed;

  const decline = () => {
    // Never trap the user behind a network-dependent consent prompt. Collection
    // remains off even if saving the declined choice has to be retried later.
    setDismissed(true);
    saveChoice.mutate("declined");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={decline} statusBarTranslucent>
      <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" }}>
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
            style={{ marginTop: 18, fontFamily: "Boldonse_400Regular", fontSize: 18, lineHeight: 26, color: colors.white }}
          >
            Help improve Spotted
          </Text>
          <Text style={{ marginTop: 12, fontFamily: "Geist_400Regular", fontSize: 14, lineHeight: 21, color: colors.mist }}>
            With your permission we&apos;ll collect app opens, screens viewed, feature actions, app version, and
            device platform so we can see what works and fix what doesn&apos;t. Raw events are kept for up to 90
            days.
          </Text>
          <Text style={{ marginTop: 10, fontFamily: "Geist_600SemiBold", fontSize: 13, lineHeight: 19, color: colors.bone }}>
            Used only by Spotted — never shared with or sold to third parties. Never includes your photos,
            messages, contacts, precise location, or advertising ID. Change it any time in Settings → Privacy.
          </Text>
          {saveChoice.isError ? (
            <Text style={{ marginTop: 10, fontSize: 12, color: colors.mist }}>
              We couldn&apos;t save that choice. Please try again.
            </Text>
          ) : null}
          <View style={{ marginTop: 22, gap: 9 }}>
            <Button
              onPress={() => saveChoice.mutate("consent")}
              loading={saveChoice.isPending && saveChoice.variables === "consent"}
              disabled={saveChoice.isPending}
            >
              Allow analytics
            </Button>
            <Button
              variant="ghost"
              onPress={decline}
              loading={saveChoice.isPending && saveChoice.variables === "declined"}
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
