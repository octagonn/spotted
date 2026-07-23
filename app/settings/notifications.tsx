import { type ReactNode } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  type FriendCheckinScope
} from "@/hooks/queries/useNotificationPrefs";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onToggle}
      haptic={false}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 3,
        backgroundColor: value ? tokens.accent.gold : colors.iron,
        alignItems: value ? "flex-end" : "flex-start"
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? colors.black : colors.silver }} />
    </Pressable>
  );
}

function Row({ title, sub, right }: { title: string; sub?: string; right: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{title}</Text>
        {sub ? <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text style={{ marginTop: 26, marginBottom: 4, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: colors.mist }}>
      {children}
    </Text>
  );
}

const SCOPES: { key: FriendCheckinScope; label: string }[] = [
  { key: "my_gym", label: "My gym" },
  { key: "all_friends", label: "All friends" },
  { key: "off", label: "Off" }
];

/**
 * Notification settings (push spec). Every toggle maps to a
 * notification_preferences column; the server gate reads them before any push.
 */
export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const p = prefs.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Notifications" />
      {!p ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
          <SectionLabel>Gym reminders</SectionLabel>
          <Row
            title="Gym reminders"
            sub="Arrival check-in prompts and your daily nudge. At most 2 a day."
            right={<Toggle value={p.gymRemindersEnabled} onToggle={() => update.mutate({ gymRemindersEnabled: !p.gymRemindersEnabled })} />}
          />
          <Row
            title="Daily nudge time"
            sub="When we remind you if you haven't posted yet."
            right={<Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 15, color: p.gymRemindersEnabled ? colors.white : colors.fog }}>{p.dailyNudgeTime}</Text>}
          />

          <SectionLabel>Social</SectionLabel>
          <Row
            title="Friend check-ins"
            sub="When friends hit the gym."
            right={
              <View style={{ flexDirection: "row", gap: 6 }}>
                {SCOPES.map((s) => {
                  const on = p.friendCheckinsScope === s.key;
                  return (
                    <Pressable key={s.key} onPress={() => update.mutate({ friendCheckinsScope: s.key })} haptic={false}>
                      <View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? colors.white : "transparent", borderWidth: 1, borderColor: on ? colors.white : colors.iron }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 11.5, color: on ? colors.black : colors.silver }}>{s.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            }
          />
          <Row title="Taunts" sub="When a friend roasts your missed day." right={<Toggle value={p.tauntsEnabled} onToggle={() => update.mutate({ tauntsEnabled: !p.tauntsEnabled })} />} />
          <Row title="Messages" right={<Toggle value={p.messagesEnabled} onToggle={() => update.mutate({ messagesEnabled: !p.messagesEnabled })} />} />
          <Row title="Friend requests" right={<Toggle value={p.friendRequestsEnabled} onToggle={() => update.mutate({ friendRequestsEnabled: !p.friendRequestsEnabled })} />} />
          <Row title="Reactions on your posts" right={<Toggle value={p.reactionsEnabled} onToggle={() => update.mutate({ reactionsEnabled: !p.reactionsEnabled })} />} />

          <SectionLabel>Quiet hours</SectionLabel>
          <Row
            title="No notifications overnight"
            sub={`Nothing between ${p.quietHoursStart} and ${p.quietHoursEnd} your time.`}
            right={<Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 13, color: colors.fog }}>{`${p.quietHoursStart}–${p.quietHoursEnd}`}</Text>}
          />
        </ScrollView>
      )}
    </View>
  );
}
