import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

import { appAlert } from "@/components/ui/AppDialog";
import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { AppleSignInError, linkAppleToCurrentAccount } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";

export default function AccountSettingsScreen() {
  const session = useAuthStore((state) => state.session);
  const userId = useAuthStore((state) => state.userId);
  const signOut = useAuthStore((state) => state.signOut);
  const queryClient = useQueryClient();

  const [signingOut, setSigningOut] = useState(false);

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

  // Which sign-in methods are attached to this account (email / apple).
  const identitiesQuery = useQuery({
    queryKey: ["account-identities", userId],
    enabled: Boolean(userId) && isSupabaseConfigured,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return (data?.identities ?? []).map((identity) => identity.provider);
    }
  });
  const appleLinked = (identitiesQuery.data ?? []).includes("apple");
  // Password management only applies to accounts that sign in with email —
  // Apple-only accounts have no password to change.
  const hasEmailIdentity = (identitiesQuery.data ?? []).includes("email");

  const email = session?.user.email ?? null;
  const username = profileQuery.data?.username ?? null;
  const [linkingApple, setLinkingApple] = useState(false);

  async function connectApple() {
    if (linkingApple) return;
    setLinkingApple(true);
    try {
      // One native sheet; the server attaches the identity. Works with Hide My
      // Email because the email is never used to match accounts.
      const result = await linkAppleToCurrentAccount();
      if (result === "linked" || result === "already-linked") {
        showToast(result === "linked" ? "Apple sign-in connected" : "Apple sign-in already connected");
        void queryClient.invalidateQueries({ queryKey: ["account-identities"] });
        return;
      }
      if (result === "already-has-apple") {
        appAlert(
          "Already connected",
          "This account is already linked to a different Apple Account. Disconnect that one first."
        );
        return;
      }
      appAlert(
        "That Apple Account is taken",
        "It's already connected to another Spotted account. Sign in with Apple to use that account, or pick a different Apple Account."
      );
    } catch (error) {
      if (error instanceof AppleSignInError && error.code === "ERR_REQUEST_CANCELED") {
        return; // user closed the sheet
      }
      logger.warn("apple_link_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      showToast(error instanceof Error ? error.message : "Couldn't connect Apple sign-in");
    } finally {
      setLinkingApple(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/welcome");
    } finally {
      setSigningOut(false);
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
        {appleLinked ? (
          <Text variant="caption" className="mt-2 text-mist">
             Apple sign-in connected
          </Text>
        ) : null}
      </View>

      <View className="mt-6 gap-3">
        <Button variant="ghost" onPress={() => router.push("/edit-profile")}>
          Edit profile
        </Button>
        {hasEmailIdentity ? (
          <Button variant="ghost" onPress={() => router.push("/settings/change-password")}>
            Change password
          </Button>
        ) : null}
        {Platform.OS === "ios" && !appleLinked && identitiesQuery.isSuccess ? (
          <Button variant="ghost" loading={linkingApple} onPress={connectApple}>
            Connect Apple sign-in
          </Button>
        ) : null}
        <Button variant="ghost" loading={signingOut} onPress={handleSignOut}>
          Sign Out
        </Button>
      </View>

      <Text variant="caption" className="mt-10 text-fog">
        Looking to delete your account? It moved to Settings → Danger Zone.
      </Text>
    </Screen>
  );
}
