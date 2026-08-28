import { router } from "expo-router";
import { Globe, Lock } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import Animated from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
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
          borderColor: active ? "#E8B44C" : "rgba(255,255,255,0.14)",
          backgroundColor: active ? "rgba(232,180,76,0.08)" : "rgba(255,255,255,0.04)",
          borderRadius: 18,
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
            borderColor: active ? "rgba(232,180,76,0.45)" : "rgba(255,255,255,0.14)",
            backgroundColor: "rgba(255,255,255,0.05)"
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
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(232,180,76,0.5)",
                  backgroundColor: "rgba(232,180,76,0.12)",
                  paddingHorizontal: 8,
                  paddingVertical: 2
                }}
              >
                <Text variant="micro" className="text-[#E8B44C]">
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
            borderColor: active ? "#E8B44C" : "rgba(255,255,255,0.25)"
          }}
        >
          {active ? (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#E8B44C" }} />
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
        await supabase
          .from("profiles")
          .update({ is_private: isPrivate })
          .eq("id", uid);
      }
      fadeNavigate(() => router.push("/home-gym"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1 }, fadeStyle]}>
    <Screen transparent>
      <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
        <Text variant="micro" className="text-mist">
          STEP 6 OF 7
        </Text>
      </View>
      <Text variant="display-md" className="mt-6">
        WHO CAN SEE YOU?
      </Text>
      <Text variant="body" className="mt-3 text-mist">
        You can change this anytime in Settings.
      </Text>

      <View className="mt-2">
        <Option
          active={choice === "private"}
          icon={<Lock size={18} color="#E8B44C" strokeWidth={2} />}
          title="Private"
          badge="RECOMMENDED"
          description="People can find you by username, but must be approved to see your posts, gyms, streak, and friends."
          onPress={() => setChoice("private")}
        />
        <Option
          active={choice === "public"}
          icon={<Globe size={18} color="#C9C9CE" strokeWidth={2} />}
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
