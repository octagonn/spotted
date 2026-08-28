import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Bell, ChevronRight, ExternalLink } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SettingRow as Row, SettingSectionLabel as SectionLabel, SettingToggle as Toggle } from "@/components/ui/SettingRow";
import { SkeletonToggleRows } from "@/components/ui/Skeleton";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  type FriendCheckinScope,
  type NotificationPrefs
} from "@/hooks/queries/useNotificationPrefs";
import {
  getPushPermissionStatus,
  registerDeviceToken,
  type PushPermissionStatus
} from "@/lib/notifications";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";



const SCOPES: { key: FriendCheckinScope; label: string }[] = [
  { key: "my_gym", label: "My gym" },
  { key: "all_friends", label: "All" },
  { key: "off", label: "Off" }
];

type TimeField = "dailyNudgeTime" | "quietHoursStart" | "quietHoursEnd";

function timeDate(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function databaseTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function displayTime(value: string) {
  return timeDate(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function TimePicker({
  field,
  value,
  onClose,
  onSave
}: {
  field: TimeField | null;
  value: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(timeDate(value));

  useEffect(() => {
    setDraft(timeDate(value));
  }, [field, value]);

  if (!field) return null;

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      onClose();
      if (event.type === "set" && date) onSave(databaseTime(date));
      return;
    }
    if (date) setDraft(date);
  };

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={draft}
        mode="time"
        minuteInterval={5}
        onChange={onChange}
      />
    );
  }

  const title =
    field === "dailyNudgeTime"
      ? "Daily nudge"
      : field === "quietHoursStart"
        ? "Quiet hours start"
        : "Quiet hours end";

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" }}>
        <View
          style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron,
            backgroundColor: colors.ink,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 24
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={onClose} style={{ paddingVertical: 8, paddingRight: 16 }}>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.fog }}>
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: "Geist_700Bold",
                fontSize: 15,
                color: colors.white
              }}
            >
              {title}
            </Text>
            <Pressable
              onPress={() => onSave(databaseTime(draft))}
              style={{ paddingVertical: 8, paddingLeft: 16 }}
            >
              <Text
                style={{
                  fontFamily: "Geist_700Bold",
                  fontSize: 14,
                  color: tokens.accent.gold
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            minuteInterval={5}
            themeVariant="dark"
            textColor={colors.white}
            onChange={onChange}
          />
        </View>
      </View>
    </Modal>
  );
}

function TimeButton({ value, onPress, disabled = false }: { value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={`Change time, currently ${displayTime(value)}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: disabled ? 0.45 : 1 }}>
        <Text
          style={{
            fontFamily: "GeistMono_500Medium",
            fontSize: 13,
            color: colors.white
          }}
        >
          {displayTime(value)}
        </Text>
        <ChevronRight size={15} color={colors.fog} />
      </View>
    </Pressable>
  );
}

function CategoryToggle({
  value,
  field,
  update
}: {
  value: boolean;
  field: keyof NotificationPrefs;
  update: ReturnType<typeof useUpdateNotificationPrefs>;
}) {
  return <Toggle value={value} onToggle={() => update.mutate({ [field]: !value })} />;
}

/** Complete push controls for every notification type emitted by the app. */
export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const p = prefs.data;
  const [osStatus, setOsStatus] = useState<PushPermissionStatus>("not_asked");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [timeField, setTimeField] = useState<TimeField | null>(null);

  useEffect(() => {
    const refresh = () => {
      void getPushPermissionStatus().then(setOsStatus).catch(() => setOsStatus("denied"));
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, []);

  const enableNotifications = async () => {
    if (!userId) return;
    if (osStatus === "denied") {
      await Linking.openSettings();
      return;
    }
    setPermissionBusy(true);
    try {
      const token = await registerDeviceToken(userId, { requestPermission: true });
      setOsStatus(token ? "granted" : await getPushPermissionStatus());
      if (token && p && !p.pushEnabled) update.mutate({ pushEnabled: true });
      void prefs.refetch();
    } finally {
      setPermissionBusy(false);
    }
  };

  const saveTime = (value: string) => {
    if (!timeField) return;
    update.mutate({ [timeField]: value });
    setTimeField(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Notifications" />
      {!p ? (
        <SkeletonToggleRows count={8} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
          <View
            style={{
              marginTop: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: osStatus === "granted" ? colors.iron : tokens.accent.gold,
              backgroundColor: colors.ink,
              padding: 16
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.accent.goldSubtle
                }}
              >
                <Bell size={19} color={tokens.accent.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
                  {osStatus === "granted"
                    ? p.pushEnabled
                      ? "Push notifications are on"
                      : "Push notifications are paused"
                    : osStatus === "denied"
                      ? "Notifications are blocked"
                      : "Turn on push notifications"}
                </Text>
                <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>
                  {osStatus === "granted"
                    ? "These controls apply to this account. System controls apply to this device."
                    : osStatus === "denied"
                      ? "Open your device settings to allow alerts from Spotted."
                      : "Enable alerts, sounds, and badges for the categories below."}
                </Text>
              </View>
            </View>

            {osStatus === "granted" ? (
              <View style={{ marginTop: 14 }}>
                <Row
                  title="Allow push notifications"
                  right={
                    <Toggle
                      value={p.pushEnabled}
                      onToggle={() => update.mutate({ pushEnabled: !p.pushEnabled })}
                    />
                  }
                />
                <Pressable
                  onPress={() => void Linking.openSettings()}
                  haptic={false}
                  style={{ paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.silver }}>
                    Device notification settings
                  </Text>
                  <ExternalLink size={13} color={colors.fog} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => void enableNotifications()}
                disabled={permissionBusy}
                style={{ marginTop: 14 }}
              >
                <View
                  style={{
                    minHeight: 44,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.white
                  }}
                >
                  {permissionBusy ? (
                    <ActivityIndicator color={colors.black} />
                  ) : (
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>
                      {osStatus === "denied" ? "Open device settings" : "Enable notifications"}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
          </View>

          <SectionLabel>Gym reminders</SectionLabel>
          <Row
            title="Gym and post reminders"
            sub="Your daily nudge and check-in confirmations."
            right={
              <CategoryToggle
                value={p.gymRemindersEnabled}
                field="gymRemindersEnabled"
                update={update}
              />
            }
          />
          <Row
            title="Daily nudge time"
            sub="Only sent if you haven't posted that day."
            right={
              <TimeButton
                value={p.dailyNudgeTime}
                disabled={!p.gymRemindersEnabled}
                onPress={() => setTimeField("dailyNudgeTime")}
              />
            }
          />

          <SectionLabel>People</SectionLabel>
          <Row
            title="Friend check-ins"
            sub="When friends hit the gym."
            right={
              <View style={{ flexDirection: "row", gap: 5 }}>
                {SCOPES.map((scope) => {
                  const selected = p.friendCheckinsScope === scope.key;
                  return (
                    <Pressable
                      key={scope.key}
                      onPress={() => update.mutate({ friendCheckinsScope: scope.key })}
                      haptic={false}
                      accessibilityLabel={scope.label}
                      accessibilityState={{ selected }}
                      hitSlop={8}
                    >
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: selected ? colors.white : "transparent",
                          borderWidth: 1,
                          borderColor: selected ? colors.white : colors.iron
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Geist_600SemiBold",
                            fontSize: 11.5,
                            color: selected ? colors.black : colors.silver
                          }}
                        >
                          {scope.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            }
          />
          <Row
            title="Friend requests"
            sub="Requests and accepted friendships."
            right={<CategoryToggle value={p.friendRequestsEnabled} field="friendRequestsEnabled" update={update} />}
          />
          <Row
            title="New followers"
            right={<CategoryToggle value={p.followsEnabled} field="followsEnabled" update={update} />}
          />
          <Row
            title="Friend activity"
            sub="Waves, streak breaks, and extra workouts."
            right={<CategoryToggle value={p.friendActivityEnabled} field="friendActivityEnabled" update={update} />}
          />
          <Row
            title="Taunts"
            sub="Taunts and when someone answers yours."
            right={<CategoryToggle value={p.tauntsEnabled} field="tauntsEnabled" update={update} />}
          />

          <SectionLabel>Posts & messages</SectionLabel>
          <Row
            title="Messages"
            right={<CategoryToggle value={p.messagesEnabled} field="messagesEnabled" update={update} />}
          />
          <Row
            title="Reactions"
            right={<CategoryToggle value={p.reactionsEnabled} field="reactionsEnabled" update={update} />}
          />
          <Row
            title="Tags"
            sub="When someone tags you in a post or story."
            right={<CategoryToggle value={p.tagsEnabled} field="tagsEnabled" update={update} />}
          />

          <SectionLabel>Communities & progress</SectionLabel>
          <Row
            title="Communities"
            sub="Invites and community nudges."
            right={<CategoryToggle value={p.communitiesEnabled} field="communitiesEnabled" update={update} />}
          />
          <Row
            title="Achievements"
            sub="Streak milestones, trophies, and claim decisions."
            right={<CategoryToggle value={p.achievementsEnabled} field="achievementsEnabled" update={update} />}
          />

          <SectionLabel>Quiet hours</SectionLabel>
          <Row
            title="No notifications overnight"
            sub="Pushes are suppressed during this window in your current timezone."
            right={
              <CategoryToggle
                value={p.quietHoursEnabled}
                field="quietHoursEnabled"
                update={update}
              />
            }
          />
          <Row
            title="Starts"
            right={
              <TimeButton
                value={p.quietHoursStart}
                disabled={!p.quietHoursEnabled}
                onPress={() => setTimeField("quietHoursStart")}
              />
            }
          />
          <Row
            title="Ends"
            right={
              <TimeButton
                value={p.quietHoursEnd}
                disabled={!p.quietHoursEnabled}
                onPress={() => setTimeField("quietHoursEnd")}
              />
            }
          />
          <Text style={{ marginTop: 12, fontSize: 11.5, lineHeight: 17, color: colors.fog }}>
            Turning off a push category never removes its activity from your in-app Notifications inbox.
          </Text>
        </ScrollView>
      )}

      {p ? (
        <TimePicker
          field={timeField}
          value={timeField ? p[timeField] : "12:00"}
          onClose={() => setTimeField(null)}
          onSave={saveTime}
        />
      ) : null}
    </View>
  );
}
