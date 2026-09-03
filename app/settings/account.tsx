import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SettingNavRow, SettingRow, SettingSectionLabel } from "@/components/ui/SettingRow";
import { Text } from "@/components/ui/Text";
import { AppleSignInError, linkAppleToCurrentAccount } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Account" sub={username ? `@${username}` : undefined} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space[4] + 4, paddingBottom: insets.bottom + space[8] }}>
        <SettingSectionLabel>Signed in as</SettingSectionLabel>
        <SettingRow title={username ? `@${username}` : (email ?? "Signed in")} sub={email ?? undefined} />
        <SettingRow
          title="Sign-in methods"
          sub={[hasEmailIdentity ? "Email" : null, appleLinked ? "Apple" : null].filter(Boolean).join(" · ") || "—"}
        />

        <SettingSectionLabel>Manage</SettingSectionLabel>
        <SettingNavRow
          title="Edit profile"
          sub="Name, photo, bio, links, home gym"
          onPress={() => router.push("/edit-profile")}
        />
        {hasEmailIdentity ? (
          <SettingNavRow title="Change password" onPress={() => router.push("/settings/change-password")} />
        ) : null}

        <View style={{ marginTop: space[6], gap: space[3] }}>
          {Platform.OS === "ios" && !appleLinked && identitiesQuery.isSuccess ? (
            <Button variant="ghost" loading={linkingApple} onPress={connectApple}>
              Connect Apple sign-in
            </Button>
          ) : null}
          <Button variant="ghost" loading={signingOut} onPress={handleSignOut}>
            Sign out
          </Button>
        </View>

        <Text variant="meta" className="mt-10">
          Looking to delete your account? It lives under Settings → Danger zone.
        </Text>
      </ScrollView>
    </View>
  );
}
