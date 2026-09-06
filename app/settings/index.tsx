import { router, type Href } from "expo-router";
import {
  Ban,
  Bell,
  Download,
  FileText,
  Lock,
  LogOut,
  MoonStar,
  Shield,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserRound
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SettingNavRow, SettingSectionLabel } from "@/components/ui/SettingRow";
import {
  useDeactivateAccount,
  useLatestExportRequest,
  useRequestDataExport
} from "@/hooks/queries/useAccountLifecycle";
import { useIsAdmin } from "@/hooks/queries/useModeration";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

const glyph = (Icon: typeof UserRound, danger = false) => (
  <Icon
    size={icon.size.sm - 1}
    color={danger ? tokens.status.danger : tokens.text.secondary}
    strokeWidth={icon.stroke.regular}
  />
);

/**
 * Account settings hub (8a): Account / Privacy / Notifications / Blocked
 * Users / Legal / Danger Zone. Stubbed sections route to a clean coming-soon
 * screen — no dead taps. Legal docs are routed screens fed from
 * lib/legalContent.ts (8b). Deletion is fully functional (8c).
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((state) => state.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const deactivate = useDeactivateAccount();
  const isAdmin = useIsAdmin();
  const requestExport = useRequestDataExport();
  const latestExport = useLatestExportRequest();

  const onExport = () => {
    appAlert(
      "Download my data",
      "We'll email you a zip of everything on your account — profile, posts, workouts, messages you sent, friends, streak, and settings. Media links inside stay valid for 7 days.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email my data",
          onPress: () =>
            requestExport.mutate(undefined, {
              onSuccess: () => showToast("Export sent — check your email"),
              onError: (e) =>
                showToast(
                  e instanceof Error && e.message === "rate_limited"
                    ? "You can export once every 30 days"
                    : "Couldn't build the export — try again"
                )
            })
        }
      ]
    );
  };

  const onDeactivate = () => {
    appAlert(
      "Deactivate account?",
      "Your profile, posts, and presence are hidden until you log back in. Your streak freezes — it resumes where it left off.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () =>
            deactivate.mutate(undefined, {
              onSuccess: () => {
                void signOut();
                router.replace("/(auth)/welcome");
              },
              onError: () => showToast("Couldn't deactivate — try again")
            })
        }
      ]
    );
  };

  const confirmSignOut = () => {
    appAlert("Log out?", "You'll need to sign back in to post.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (signingOut) return;
            setSigningOut(true);
            try {
              await signOut();
              router.replace("/(auth)/welcome");
            } finally {
              setSigningOut(false);
            }
          })();
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Settings"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space[4] + 4, paddingBottom: insets.bottom + space[10] }}
      >
        <SettingSectionLabel>Account</SettingSectionLabel>
        <SettingNavRow
          icon={glyph(UserRound)}
          title="Account"
          sub="Email, password, profile"
          onPress={() => router.push("/settings/account")}
        />

        <SettingSectionLabel>Preferences</SettingSectionLabel>
        <SettingNavRow
          icon={glyph(Lock)}
          title="Privacy"
          sub="Visibility, discoverability, activity"
          onPress={() => router.push("/settings/privacy")}
        />
        <SettingNavRow
          icon={glyph(Bell)}
          title="Notifications"
          onPress={() => router.push("/settings/notifications" as Href)}
        />
        <SettingNavRow
          icon={glyph(Ban)}
          title="Blocked users"
          onPress={() => router.push("/settings/blocked" as Href)}
        />
        <SettingNavRow
          icon={glyph(UserMinus)}
          title="Restricted users"
          onPress={() => router.push("/settings/restricted" as Href)}
        />

        <SettingSectionLabel>Legal</SettingSectionLabel>
        <SettingNavRow
          icon={glyph(FileText)}
          title="Terms of Service"
          onPress={() => router.push("/settings/legal/terms" as Href)}
        />
        <SettingNavRow
          icon={glyph(ShieldCheck)}
          title="Privacy Policy"
          onPress={() => router.push("/settings/legal/privacy" as Href)}
        />

        <SettingSectionLabel>Data</SettingSectionLabel>
        <SettingNavRow
          icon={glyph(Download)}
          title="Download my data"
          sub={
            latestExport.data
              ? `Last requested ${new Date(latestExport.data.requestedAt).toLocaleDateString()}`
              : "Profile, posts, messages, check-ins, more"
          }
          onPress={onExport}
        />
        <SettingNavRow
          icon={glyph(MoonStar)}
          title="Deactivate account"
          sub="Hide everything; your streak freezes. Reversible on login."
          onPress={onDeactivate}
        />

        {isAdmin.data ? (
          <>
            <SettingSectionLabel>Moderation</SettingSectionLabel>
            <SettingNavRow
              icon={glyph(Shield)}
              title="Review queue"
              sub="Flagged posts awaiting review"
              onPress={() => router.push("/settings/review" as Href)}
            />
          </>
        ) : null}

        <SettingSectionLabel>Danger zone</SettingSectionLabel>
        <SettingNavRow
          icon={glyph(LogOut, true)}
          title={signingOut ? "Signing out…" : "Log out"}
          danger
          onPress={confirmSignOut}
        />
        <SettingNavRow
          icon={glyph(Trash2, true)}
          title="Delete account"
          sub="Permanently erase your account and data"
          danger
          onPress={() => router.push("/settings/delete-account" as Href)}
        />
      </ScrollView>
    </View>
  );
}
