import { router } from "expo-router";
import { Check, Mail } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GrainOverlay } from "@/components/GrainOverlay";
import { LegalModal } from "@/components/LegalModal";
import { StaticAuroraBackground } from "@/components/StaticAuroraBackground";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { LEGAL_VERSION } from "@/lib/legal";
import { colors } from "@/theme/colors";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms");
  const [legalAccepted, setLegalAccepted] = useState(false);
  function handleEmail() {
    setErrorText(null);
    if (!legalAccepted) {
      setErrorText("Check the box to agree to the Terms of Use and Privacy Policy.");
      return;
    }
    router.push({ pathname: "/email", params: { legal: LEGAL_VERSION } });
  }

  return (
    <View className="flex-1 bg-black">
      <StaticAuroraBackground />
      <GrainOverlay opacity={0.06} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1
        }}
      >
        <View className="flex-1 justify-end gap-6">
          <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
            <Text variant="micro" className="text-mist">
              STEP 1 OF 5
            </Text>
          </View>
          <Text variant="display-md">SIGN IN.</Text>
          <Text variant="italic">Pick how you want in.</Text>
          <View className="gap-3">
            <Button
              icon={<Mail color={legalAccepted ? colors.black : colors.ash} size={18} />}
              onPress={handleEmail}
              disabled={!legalAccepted}
            >
              Continue with email
            </Button>
          </View>
          {errorText ? (
            <View className="rounded-card border border-hairline-strong bg-glass-strong p-4">
              <Text variant="micro" className="text-white">
                SIGN-IN ERROR
              </Text>
              <Text variant="caption" className="mt-2 text-mist">
                {errorText}
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-start gap-3">
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Agree to the Terms of Use and Privacy Policy"
              accessibilityState={{ checked: legalAccepted }}
              className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${
                legalAccepted ? "border-white bg-white" : "border-hairline-strong bg-glass-soft"
              }`}
              onPress={() => {
                setLegalAccepted((accepted) => !accepted);
                setErrorText(null);
              }}
            >
              {legalAccepted ? <Check color={colors.black} size={16} strokeWidth={3} /> : null}
            </Pressable>
            <View className="flex-1 flex-row flex-wrap items-center">
              <Text variant="caption" className="text-fog">
                I agree to the{" "}
              </Text>
              <Pressable
                haptic={false}
                accessibilityRole="link"
                pressedClassName="opacity-60"
                onPress={() => {
                  setLegalTab("terms");
                  setLegalOpen(true);
                }}
              >
                <Text variant="caption" className="text-white underline">
                  Terms of Use
                </Text>
              </Pressable>
              <Text variant="caption" className="text-fog">
                {" "}
                and{" "}
              </Text>
              <Pressable
                haptic={false}
                accessibilityRole="link"
                pressedClassName="opacity-60"
                onPress={() => {
                  setLegalTab("privacy");
                  setLegalOpen(true);
                }}
              >
                <Text variant="caption" className="text-white underline">
                  Privacy Policy
                </Text>
              </Pressable>
              <Text variant="caption" className="text-fog">
                .
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <LegalModal visible={legalOpen} initialTab={legalTab} onClose={() => setLegalOpen(false)} />
    </View>
  );
}
