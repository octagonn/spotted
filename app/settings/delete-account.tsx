import { router } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

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
      <View
        style={{
          flex: 1,
          paddingHorizontal: space[4] + 4,
          paddingTop: space[4],
          paddingBottom: insets.bottom + space[6]
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: tokens.status.danger,
            alignItems: "center",
            justifyContent: "center",
            marginTop: space[3]
          }}
        >
          <TriangleAlert size={icon.size.md} color={tokens.status.danger} strokeWidth={icon.stroke.regular} />
        </View>
        <Text variant="subheading" className="mt-[18px] text-center">
          Delete your account
        </Text>
        <Text variant="body-sm" className="mt-3 text-center text-mist">
          Either way, your profile, posts, photos, workouts, trophies, streaks, and friend graph are erased. Messages
          you sent stay in your friends&apos; threads (they&apos;re their record too) but are no longer linked to you.
        </Text>
        {armed ? (
          <View style={{ marginTop: space[4] + 2, gap: space[2] + 2 }}>
            <Text variant="meta" className="text-silver">
              <Text variant="meta-strong" className="text-white">
                Delete in 30 days
              </Text>
              {
                " — your account hides immediately and you can restore everything by logging back in any time before the purge date."
              }
            </Text>
            <Text variant="meta" className="text-silver">
              <Text variant="meta-strong" className="text-danger">
                Delete permanently now
              </Text>
              {" — everything is erased immediately and can never be recovered."}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {error ? (
          <Text variant="meta" className="mb-3 text-center text-danger">
            {error}
          </Text>
        ) : null}

        {!armed ? (
          <Button variant="danger" onPress={() => setArmed(true)} accessibilityLabel="I understand, continue">
            I understand — continue
          </Button>
        ) : (
          <View style={{ gap: space[2] + 2 }}>
            <Button
              variant="danger"
              onPress={() => void handleGraceDelete()}
              loading={deleting === "grace"}
              disabled={deleting !== null}
              accessibilityLabel="Delete in 30 days, restorable by logging back in"
            >
              Delete in 30 days (restorable)
            </Button>
            <Button
              variant="danger-solid"
              onPress={confirmHardDelete}
              loading={deleting === "now"}
              disabled={deleting !== null}
              accessibilityLabel="Delete my account permanently right now"
            >
              Delete permanently now
            </Button>
          </View>
        )}
        <Pressable
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
          disabled={deleting !== null}
          haptic="none"
          style={{ marginTop: space[3], paddingVertical: space[3], alignItems: "center" }}
        >
          <Text variant="meta-strong">Never mind — keep my account</Text>
        </Pressable>
      </View>
    </View>
  );
}
