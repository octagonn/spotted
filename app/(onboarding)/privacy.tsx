import { router } from "expo-router";
import { Globe, Lock } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import Animated from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { colors } from "@/theme/colors";
import { icon, radius, tokens } from "@/theme/tokens";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

type Choice = "private" | "public";

function Option({
  active,
  icon,
  title,
  badge,
  description,
  onPress
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} haptic={false} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          borderWidth: 1.5,
          borderColor: active ? tokens.accent.gold : colors.hairlineStrong,
          backgroundColor: active ? tokens.accent.goldSubtle : colors.glassSoft,
          borderRadius: radius.md,
          padding: 16,
          marginTop: 12
        }}
      >
        {/* Fixed icon column so title AND description share one left edge. */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: active ? tokens.accent.gold : colors.hairlineStrong,
            backgroundColor: colors.glass
          }}
        >
          {icon}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 20 }}>
            <Text variant="body-strong" className="text-white">
              {title}
            </Text>
            {badge ? (
              <View
                style={{
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: tokens.accent.gold,
                  backgroundColor: tokens.accent.goldSubtle,
                  paddingHorizontal: 8,
                  paddingVertical: 2
                }}
              >
                <Text variant="micro" className="text-gold">
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" className="mt-1.5 text-mist">
            {description}
          </Text>
        </View>

        {/* Radio indicator — selection reads instantly, not just via border. */}
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 1.5,
            marginTop: 10,
            alignItems: "center",
            justifyContent: "center",
            borderColor: active ? tokens.accent.gold : colors.hairlineStrong
          }}
        >
          {active ? (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.accent.gold }} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Onboarding privacy choice (§2, adjusted per request: chosen in onboarding
 * rather than defaulted). Private is preselected — safe by default — but the
 * user explicitly picks. Writes only is_private: private accounts stay
 * discoverable in search (content is still friends-only) so Find Friends
 * works; hiding from search is the separate Discoverable toggle in Settings.
 */
export default function PrivacyScreen() {
  const { fadeStyle, fadeNavigate } = usePageFade();
  const [choice, setChoice] = useState<Choice>("private");
  const [submitting, setSubmitting] = useState(false);

  async function handleNext() {
    if (submitting) return;
    if (!isSupabaseConfigured) {
      fadeNavigate(() => router.push("/home-gym"));
      return;
    }
    setSubmitting(true);
    try {
      const uid = useAuthStore.getState().userId;
      if (uid) {
        const isPrivate = choice === "private";
        await supabase.from("profiles").update({ is_private: isPrivate }).eq("id", uid);
      }
      fadeNavigate(() => router.push("/home-gym"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1 }, fadeStyle]}>
      <Screen transparent>
        <OnboardingHeader step={6} title="WHO CAN SEE YOU?" />
        <Text variant="body" className="mt-3 text-silver">
          You can change this anytime in Settings.
        </Text>

        <View className="mt-2">
          <Option
            active={choice === "private"}
            icon={<Lock size={icon.size.xs + 2} color={tokens.accent.gold} strokeWidth={icon.stroke.regular} />}
            title="Private"
            badge="RECOMMENDED"
            description="People can find you by username, but must be approved to see your posts, gyms, streak, and friends."
            onPress={() => setChoice("private")}
          />
          <Option
            active={choice === "public"}
            icon={<Globe size={icon.size.xs + 2} color={colors.mist} strokeWidth={icon.stroke.regular} />}
            title="Public"
            description="Anyone can see your posts and stats. Friend requests are auto-accepted."
            onPress={() => setChoice("public")}
          />
        </View>

        <View className="flex-1" />
        <Button onPress={handleNext} loading={submitting}>
          Continue
        </Button>
      </Screen>
    </Animated.View>
  );
}
