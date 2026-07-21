import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export default function AccountSettingsScreen() {
  const session = useAuthStore((state) => state.session);
  const userId = useAuthStore((state) => state.userId);
  const signOut = useAuthStore((state) => state.signOut);

  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["account-profile", userId],
    enabled: Boolean(userId) && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", userId as string)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    }
  });

  const email = session?.user.email ?? null;
  const username = profileQuery.data?.username ?? null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/welcome");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.functions.invoke("delete-account");
        if (error) {
          throw error;
        }
      }
      await signOut();
      router.replace("/(auth)/welcome");
    } catch (error) {
      logger.error("account_deletion_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      setDeleteError("Deletion failed. Try again or contact support.");
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <BackButton fallback="/settings" style={{ marginBottom: 18 }} />
      <Text variant="display-sm">ACCOUNT</Text>

      <View className="mt-8 border border-hairline-strong bg-ink p-4">
        <Text variant="body-strong">{username ? `@${username}` : (email ?? "Signed in")}</Text>
        {email ? (
          <Text variant="caption" className="mt-2 text-mist">
            {email}
          </Text>
        ) : null}
      </View>

      <View className="mt-6 gap-3">
        <Button variant="ghost" loading={signingOut} onPress={handleSignOut}>
          Sign Out
        </Button>
      </View>

      <View className="mt-10 border border-hairline-strong bg-ink p-4">
        <Text variant="body-strong">Delete account</Text>
        <Text variant="caption" className="mt-2 text-mist">
          Permanently removes your profile, posts, streaks, messages, and media. This cannot be
          undone.
        </Text>
        {!confirmingDelete ? (
          <Button className="mt-4" variant="danger" onPress={() => setConfirmingDelete(true)}>
            Delete Account
          </Button>
        ) : (
          <View className="mt-4 gap-3">
            <Text variant="caption" className="text-white">
              Are you sure? This is permanent.
            </Text>
            <Button variant="danger" loading={deleting} onPress={handleDeleteAccount}>
              Yes, Permanently Delete
            </Button>
            <Button variant="ghost" disabled={deleting} onPress={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </View>
        )}
        {deleteError ? (
          <Text variant="caption" className="mt-3 text-fog">
            {deleteError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
