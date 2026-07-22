import { router } from "expo-router";
import { Bell, ChevronRight, FileText, Lock, LogOut, ShieldCheck, UserRound } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Linking, Platform, View } from "react-native";

import { LegalModal } from "@/components/LegalModal";
import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useAuthStore } from "@/stores/auth";

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

export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/welcome");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <BackButton fallback="/(tabs)/profile" style={{ marginBottom: 18 }} />
      <Text variant="display-sm">SETTINGS</Text>

      <SectionLabel>Your account</SectionLabel>
      <SettingsRow
        icon={<UserRound size={19} color="#C9C9CE" strokeWidth={2} />}
        label="Account"
        sub="Email, password, delete account"
        onPress={() => router.push("/settings/account")}
      />
      <SettingsRow
        icon={<Lock size={19} color="#C9C9CE" strokeWidth={2} />}
        label="Privacy"
        sub="Ghost mode, discoverability, activity"
        onPress={() => router.push("/settings/privacy")}
      />
      <SettingsRow
        icon={<Bell size={19} color="#C9C9CE" strokeWidth={2} />}
        label="Notifications"
        sub="Push permissions live in your device settings"
        onPress={() => {
          if (Platform.OS !== "web") void Linking.openSettings();
        }}
      />

      <SectionLabel>Legal</SectionLabel>
      <SettingsRow
        icon={<FileText size={19} color="#C9C9CE" strokeWidth={2} />}
        label="Terms of Service"
        onPress={() => setLegal("terms")}
      />
      <SettingsRow
        icon={<ShieldCheck size={19} color="#C9C9CE" strokeWidth={2} />}
        label="Privacy Policy"
        onPress={() => setLegal("privacy")}
      />

      <View className="mt-8">
        <SettingsRow
          icon={<LogOut size={19} color="#E5484D" strokeWidth={2} />}
          label={signingOut ? "Signing out…" : "Sign out"}
          danger
          onPress={() => void handleSignOut()}
        />
      </View>

      <LegalModal visible={legal !== null} initialTab={legal ?? "terms"} onClose={() => setLegal(null)} />
    </Screen>
  );
}
