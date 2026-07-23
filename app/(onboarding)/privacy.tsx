import { router } from "expo-router";
import { Globe, Lock } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

type Choice = "private" | "public";

function Option({
  active,
  icon,
  title,
  lines,
  onPress
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  lines: string[];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} haptic={false} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <View
        style={{
          borderWidth: 1.5,
          borderColor: active ? "#E8B44C" : "rgba(255,255,255,0.14)",
          backgroundColor: active ? "rgba(232,180,76,0.10)" : "transparent",
          borderRadius: 18,
          padding: 18,
          marginTop: 14
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {icon}
          <Text variant="body-strong" className="text-white">
            {title}
          </Text>
        </View>
        {lines.map((line) => (
          <Text key={line} variant="caption" className="mt-2 text-mist">
            {line}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

/**
 * Onboarding privacy choice (§2, adjusted per request: chosen in onboarding
 * rather than defaulted). Private is preselected — safe by default — but the
 * user explicitly picks. Writes is_private + discoverable to the profile.
 */
export default function PrivacyScreen() {
  const [choice, setChoice] = useState<Choice>("private");
  const [submitting, setSubmitting] = useState(false);

  async function handleNext() {
    if (submitting) return;
    if (!isSupabaseConfigured) {
      router.push("/home-gym");
      return;
    }
    setSubmitting(true);
    try {
      const uid = useAuthStore.getState().userId;
      if (uid) {
        const isPrivate = choice === "private";
        await supabase
          .from("profiles")
          .update({ is_private: isPrivate, discoverable: !isPrivate })
          .eq("id", uid);
      }
      router.push("/home-gym");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
        <Text variant="micro" className="text-mist">
          STEP 5 OF 6
        </Text>
      </View>
      <Text variant="display-md" className="mt-6">
        WHO CAN SEE YOU?
      </Text>
      <Text variant="body" className="mt-3 text-mist">
        You can change this anytime in Settings.
      </Text>

      <Option
        active={choice === "private"}
        icon={<Lock size={18} color="#E8B44C" strokeWidth={2} />}
        title="Private"
        lines={[
          "People can find you by username, but must be approved to see your posts, gyms, streak, and friends.",
          "Recommended."
        ]}
        onPress={() => setChoice("private")}
      />
      <Option
        active={choice === "public"}
        icon={<Globe size={18} color="#C9C9CE" strokeWidth={2} />}
        title="Public"
        lines={["Anyone can see your posts and stats. Friend requests are auto-accepted."]}
        onPress={() => setChoice("public")}
      />

      <View className="flex-1" />
      <Button onPress={handleNext} loading={submitting}>
        Continue
      </Button>
    </Screen>
  );
}
