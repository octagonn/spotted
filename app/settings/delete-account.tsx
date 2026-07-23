import { router } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

const RED = "#E5484D";

/**
 * Danger-zone account deletion (8c) — App Store requirement. A dedicated
 * screen that spells out the consequences, requires an explicit armed
 * confirm, calls the delete-account edge function (storage → owned custom
 * communities → profile cascade → auth user), signs out, and returns to
 * onboarding.
 */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((state) => state.signOut);
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      if (isSupabaseConfigured) {
        const { error: fnError } = await supabase.functions.invoke("delete-account");
        if (fnError) throw fnError;
      }
      await signOut();
      router.replace("/(auth)/welcome");
    } catch (err) {
      logger.error("account_deletion_failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      setError("Deletion failed. Try again, or contact support if it keeps happening.");
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Delete account" />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
        <View style={{ alignSelf: "center", width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: RED, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
          <TriangleAlert size={24} color={RED} strokeWidth={2} />
        </View>
        <Text style={{ marginTop: 18, fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white, textAlign: "center" }}>
          This is permanent.
        </Text>
        <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 20, color: colors.mist, textAlign: "center" }}>
          Deleting your account removes your profile, every post and photo, your workouts and
          trophies, your streaks, your messages, and the communities you created. Friends lose
          your conversations. None of it can be recovered, and your username is released.
        </Text>

        <View style={{ flex: 1 }} />

        {error ? (
          <Text style={{ marginBottom: 12, fontSize: 12.5, color: RED, textAlign: "center" }}>{error}</Text>
        ) : null}

        {!armed ? (
          <Pressable
            accessibilityLabel="I understand, continue"
            onPress={() => setArmed(true)}
            style={{ borderWidth: 1, borderColor: RED, borderRadius: 999, paddingVertical: 15, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: RED }}>
              I understand — continue
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Permanently delete my account"
            onPress={() => void handleDelete()}
            disabled={deleting}
            style={{ backgroundColor: RED, borderRadius: 999, paddingVertical: 15, alignItems: "center" }}
          >
            {deleting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>
                Permanently delete my account
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
          disabled={deleting}
          style={{ marginTop: 12, paddingVertical: 13, alignItems: "center" }}
        >
          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.silver }}>
            Never mind — keep my account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
