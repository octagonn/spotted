import { router } from "expo-router";
import { appAlert } from "@/components/ui/AppDialog";
import { AtSign } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

const usernameRegex = /^[a-z0-9_]+$/;

export default function OnboardingCreateProfileScreen() {
  const insets = useSafeAreaInsets();
  const { fadeStyle, fadeNavigate } = usePageFade();
  const userId = useAuthStore((state) => state.userId);
  const session = useAuthStore((state) => state.session);
  const markProfileCreated = useAuthStore((state) => state.markProfileCreated);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usernameValid = username.length >= 3 && username.length <= 20 && usernameRegex.test(username);
  const displayNameValid = displayName.trim().length >= 1 && displayName.trim().length <= 40;
  const ready = usernameValid && displayNameValid && !submitting;

  async function handleNext() {
    if (!ready) return;
    // The photo moved to its own prominent (but skippable) step next.
    if (!isSupabaseConfigured || !userId) {
      fadeNavigate(() => router.push("/profile-photo"));
      return;
    }
    setSubmitting(true);
    try {
      const metadataBirthDate = session?.user.user_metadata?.birth_date;
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        username: username.toLowerCase(),
        display_name: displayName.trim(),
        birth_date: typeof metadataBirthDate === "string" ? metadataBirthDate : null,
        onboarding_stage: "permissions"
      });
      if (error) {
        throw error;
      }
      markProfileCreated(userId);
      fadeNavigate(() => router.push("/profile-photo"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save profile.";
      appAlert("Couldn't save profile", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, fadeStyle]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24
          }}
        >
          <OnboardingHeader step={3} title="CLAIM YOUR NAME." body="What your crew sees. Photo comes next." />

          <View className="mt-8 rounded-card border border-hairline-strong bg-glass-strong p-4">
            <View className="gap-3">
              <AuthField
                value={displayName}
                onChangeText={setDisplayName}
                accessibilityLabel="Display name"
                placeholder="Display name"
                autoCapitalize="words"
                maxLength={40}
                returnKeyType="next"
                inputClassName="font-sansMedium"
              />
              <AuthField
                icon={<AtSign color={colors.mist} size={icon.size.xs - 1} strokeWidth={icon.stroke.regular} />}
                value={username}
                onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                accessibilityLabel="Username"
                placeholder="username"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
              />
            </View>
          </View>
          {!usernameValid && username.length > 0 ? (
            <Text variant="micro" accessibilityLiveRegion="polite" className="mt-3 text-mist">
              3–20 chars, lowercase letters, numbers, underscore.
            </Text>
          ) : null}

          <View className="flex-1" />
          <Button className="mt-8" onPress={handleNext} loading={submitting} disabled={!ready}>
            Next
          </Button>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
