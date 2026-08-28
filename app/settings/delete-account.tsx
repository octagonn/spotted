import { router } from "expo-router";
import { appAlert } from "@/components/ui/AppDialog";
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

type Mode = "grace" | "now";

/**
 * Danger-zone account deletion (8c) — App Store requirement. Offers BOTH:
 *   • "grace" — request_account_deletion: hides the account immediately and is
 *     restorable by logging back in until the 30-day purge date, then
 *     account_purge_sweep hard-deletes it.
 *   • "now" — the delete-account edge function: an immediate, irreversible hard
 *     delete (storage + R2 + profile cascade + auth user), gated behind a final
 *     confirm because there is no undo.
 * Either path signs out and returns to onboarding.
 */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((state) => state.signOut);
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  const handleGraceDelete = async () => {
    if (deleting) return;
    setDeleting("grace");
    setError(null);
    try {
      if (isSupabaseConfigured) {
        // 30-day archive: hides immediately, restorable by logging back in.
        const { error: rpcError } = await supabase.rpc("request_account_deletion");
        if (rpcError) throw rpcError;
      }
      await finish();
    } catch (err) {
      logger.error("account_deletion_failed", {
        mode: "grace",
        message: err instanceof Error ? err.message : String(err)
      });
      setError("Deletion failed. Try again, or contact support if it keeps happening.");
      setDeleting(null);
    }
  };

  const runHardDelete = async () => {
    if (deleting) return;
    setDeleting("now");
    setError(null);
    try {
      if (isSupabaseConfigured) {
        // Immediate, irreversible hard delete. The edge function authenticates
        // the caller from their JWT (auto-attached by supabase-js).
        const { error: fnError } = await supabase.functions.invoke("delete-account", { method: "POST" });
        if (fnError) throw fnError;
      }
      await finish();
    } catch (err) {
      logger.error("account_deletion_failed", {
        mode: "now",
        message: err instanceof Error ? err.message : String(err)
      });
      setError("Deletion failed. Try again, or contact support if it keeps happening.");
      setDeleting(null);
    }
  };

  const confirmHardDelete = () => {
    if (deleting) return;
    appAlert(
      "Delete permanently now?",
      "This erases your account and everything in it right now. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete forever", style: "destructive", onPress: () => void runHardDelete() }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Delete account" />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
        <View style={{ alignSelf: "center", width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: RED, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
          <TriangleAlert size={24} color={RED} strokeWidth={2} />
        </View>
        <Text style={{ marginTop: 18, fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white, textAlign: "center" }}>
          Delete your account
        </Text>
        <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 20, color: colors.mist, textAlign: "center" }}>
          Either way, your profile, posts, photos, workouts, trophies, streaks, and friend graph are
          erased. Messages you sent stay in your friends&apos; threads (they&apos;re their record too)
          but are no longer linked to you.
        </Text>
        {armed ? (
          <View style={{ marginTop: 18, gap: 10 }}>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.silver }}>
              <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>Delete in 30 days</Text> — your
              account hides immediately and you can restore everything by logging back in any time before the
              purge date.
            </Text>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.silver }}>
              <Text style={{ fontFamily: "Geist_700Bold", color: RED }}>Delete permanently now</Text> — everything
              is erased immediately and can never be recovered.
            </Text>
          </View>
        ) : null}

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
          <View style={{ gap: 10 }}>
            <Pressable
              accessibilityLabel="Delete in 30 days, restorable by logging back in"
              onPress={() => void handleGraceDelete()}
              disabled={deleting !== null}
              style={{ borderWidth: 1, borderColor: RED, borderRadius: 999, paddingVertical: 15, alignItems: "center" }}
            >
              {deleting === "grace" ? (
                <ActivityIndicator color={RED} />
              ) : (
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: RED }}>
                  Delete in 30 days (restorable)
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Delete my account permanently right now"
              onPress={confirmHardDelete}
              disabled={deleting !== null}
              style={{ backgroundColor: RED, borderRadius: 999, paddingVertical: 15, alignItems: "center" }}
            >
              {deleting === "now" ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>
                  Delete permanently now
                </Text>
              )}
            </Pressable>
          </View>
        )}
        <Pressable
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
          disabled={deleting !== null}
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
