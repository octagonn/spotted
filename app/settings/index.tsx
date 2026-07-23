import { router, type Href } from "expo-router";
import { Ban, Bell, ChevronRight, Download, FileText, Lock, LogOut, MoonStar, ShieldCheck, Trash2, UserMinus, UserRound } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useDeactivateAccount, useLatestExportRequest, useRequestDataExport } from "@/hooks/queries/useAccountLifecycle";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

const RED = "#E5484D";
const ICON = "#C9C9CE";

function SettingsRow({
  icon,
  label,
  sub,
  danger,
  onPress
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View className="flex-row items-center gap-3 border-b border-hairline px-1 py-4">
        {icon}
        <View className="flex-1">
          <Text variant="body-strong" className={danger ? "text-[#E5484D]" : "text-white"}>
            {label}
          </Text>
          {sub ? (
            <Text variant="caption" className="mt-0.5 text-fog">
              {sub}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={17} color="#6E6E73" />
      </View>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text variant="micro" className="mt-8 mb-1 text-mist">
      {children}
    </Text>
  );
}

/**
 * Account settings hub (8a): Account / Privacy / Notifications / Blocked
 * Users / Legal / Danger Zone. Stubbed sections route to a clean coming-soon
 * screen — no dead taps. Legal docs are routed screens fed from
 * lib/legalContent.ts (8b). Deletion is fully functional (8c).
 */
export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const deactivate = useDeactivateAccount();
  const requestExport = useRequestDataExport();
  const latestExport = useLatestExportRequest();

  const onExport = () => {
    Alert.alert(
      "Download my data",
      "We'll email a download link within 30 days: your profile, check-in history, posts, messages sent, friends, streak, and settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: () =>
            requestExport.mutate(undefined, {
              onSuccess: () => showToast("Request filed — check your email within 30 days"),
              onError: (e) =>
                showToast(e instanceof Error && e.message === "rate_limited" ? "You can request once every 30 days" : "Couldn't file the request")
            })
        }
      ]
    );
  };

  const onDeactivate = () => {
    Alert.alert(
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
    Alert.alert("Log out?", "You'll need to sign back in to post.", [
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
    <Screen>
      <BackButton fallback="/(tabs)/profile" style={{ marginBottom: 18 }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text variant="display-sm">SETTINGS</Text>

        <SectionLabel>Account</SectionLabel>
        <SettingsRow
          icon={<UserRound size={19} color={ICON} strokeWidth={2} />}
          label="Account"
          sub="Email, password, profile"
          onPress={() => router.push("/settings/account")}
        />

        <SectionLabel>Preferences</SectionLabel>
        <SettingsRow
          icon={<Lock size={19} color={ICON} strokeWidth={2} />}
          label="Privacy"
          sub="Ghost mode, discoverability, activity"
          onPress={() => router.push("/settings/privacy")}
        />
        <SettingsRow
          icon={<Bell size={19} color={ICON} strokeWidth={2} />}
          label="Notifications"
          onPress={() => router.push("/settings/notifications" as Href)}
        />
        <SettingsRow
          icon={<Ban size={19} color={ICON} strokeWidth={2} />}
          label="Blocked Users"
          onPress={() => router.push("/settings/blocked" as Href)}
        />
        <SettingsRow
          icon={<UserMinus size={19} color={ICON} strokeWidth={2} />}
          label="Restricted Users"
          onPress={() => router.push("/settings/restricted" as Href)}
        />

        <SectionLabel>Legal</SectionLabel>
        <SettingsRow
          icon={<FileText size={19} color={ICON} strokeWidth={2} />}
          label="Terms of Service"
          onPress={() => router.push("/settings/legal/terms" as Href)}
        />
        <SettingsRow
          icon={<ShieldCheck size={19} color={ICON} strokeWidth={2} />}
          label="Privacy Policy"
          onPress={() => router.push("/settings/legal/privacy" as Href)}
        />

        <SectionLabel>Data</SectionLabel>
        <SettingsRow
          icon={<Download size={19} color={ICON} strokeWidth={2} />}
          label="Download my data"
          sub={latestExport.data ? `Last requested ${new Date(latestExport.data.requestedAt).toLocaleDateString()}` : "Profile, posts, messages, check-ins, more"}
          onPress={onExport}
        />
        <SettingsRow
          icon={<MoonStar size={19} color={ICON} strokeWidth={2} />}
          label="Deactivate account"
          sub="Hide everything; your streak freezes. Reversible on login."
          onPress={onDeactivate}
        />

        <SectionLabel>Danger Zone</SectionLabel>
        <SettingsRow
          icon={<LogOut size={19} color={RED} strokeWidth={2} />}
          label={signingOut ? "Signing out…" : "Log out"}
          danger
          onPress={confirmSignOut}
        />
        <SettingsRow
          icon={<Trash2 size={19} color={RED} strokeWidth={2} />}
          label="Delete Account"
          sub="Permanently erase your account and data"
          danger
          onPress={() => router.push("/settings/delete-account" as Href)}
        />
      </ScrollView>
    </Screen>
  );
}
