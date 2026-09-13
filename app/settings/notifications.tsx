import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Bell, ChevronRight, ExternalLink } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AppState, Linking, Modal, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import {
  SettingChoice,
  SettingRow as Row,
  SettingSectionLabel as SectionLabel,
  SettingToggle as Toggle
} from "@/components/ui/SettingRow";
import { SkeletonToggleRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  type FriendCheckinScope,
  type NotificationPrefs
} from "@/hooks/queries/useNotificationPrefs";
import {
  ensureBackgroundLocation,
  getBackgroundLocationStatus,
  syncGymGeofenceById,
  type BackgroundLocationStatus
} from "@/lib/gymGeofence";
import { getPushPermissionStatus, registerDeviceToken, type PushPermissionStatus } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

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
  const insets = useSafeAreaInsets();

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
    return <DateTimePicker value={draft} mode="time" minuteInterval={5} onChange={onChange} />;
  }

  const title =
    field === "dailyNudgeTime" ? "Daily nudge" : field === "quietHoursStart" ? "Quiet hours start" : "Quiet hours end";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: tokens.bg.scrim }}>
        <View
          style={{
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            backgroundColor: colors.ink,
            paddingHorizontal: space[4] + 4,
            paddingTop: space[4] + 2,
            paddingBottom: insets.bottom + space[4]
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={onClose}
              haptic="none"
              accessibilityLabel="Cancel"
              style={{ paddingVertical: space[2], paddingRight: space[4] }}
            >
              <Text variant="meta-strong" className="text-fog">
                Cancel
              </Text>
            </Pressable>
            <Text variant="subheading" className="flex-1 text-center">
              {title}
            </Text>
            <Pressable
              onPress={() => onSave(databaseTime(draft))}
              haptic="selection"
              accessibilityLabel="Done"
              style={{ paddingVertical: space[2], paddingLeft: space[4] }}
            >
              <Text variant="meta-strong" className="text-gold">
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
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={`Change time, currently ${displayTime(value)}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], opacity: disabled ? 0.45 : 1 }}>
        <Text variant="numeral-sm" className="text-[13px]">
          {displayTime(value)}
        </Text>
        <ChevronRight size={icon.size.xs - 1} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
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
  const [bgLocation, setBgLocation] = useState<BackgroundLocationStatus>("unavailable");

  useEffect(() => {
    const refresh = () => {
      void getPushPermissionStatus()
        .then(setOsStatus)
        .catch(() => setOsStatus("denied"));
      void getBackgroundLocationStatus().then(setBgLocation);
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

  // "Always" location = arrival buzz fires with the app closed. Once the OS
  // has an answer only the Settings app can change it, so route there.
  const enableBackgroundLocation = async () => {
    if (bgLocation === "denied") {
      await Linking.openSettings();
      return;
    }
    const result = await ensureBackgroundLocation();
    setBgLocation(result);
    if (result === "granted" && userId) {
      const { data } = await supabase.from("profiles").select("home_gym_id").eq("id", userId).maybeSingle();
      void syncGymGeofenceById(data?.home_gym_id ?? null).catch(() => undefined);
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
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4] + 4, paddingBottom: insets.bottom + space[8] }}
        >
          {/* Permission card — the one raised surface on this screen. */}
          <View
            style={{
              marginTop: space[3],
              borderRadius: radius.md,
              borderWidth: osStatus === "granted" ? 0 : 1,
              borderColor: tokens.accent.gold,
              backgroundColor: tokens.bg.raised,
              padding: space[4]
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
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
                <Bell size={icon.size.sm - 1} color={tokens.accent.gold} strokeWidth={icon.stroke.regular} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="username">
                  {osStatus === "granted"
                    ? p.pushEnabled
                      ? "Push notifications are on"
                      : "Push notifications are paused"
                    : osStatus === "denied"
                      ? "Notifications are blocked"
                      : "Turn on push notifications"}
                </Text>
                <Text variant="meta" className="mt-[3px]">
                  {osStatus === "granted"
                    ? "These controls apply to this account. System controls apply to this device."
                    : osStatus === "denied"
                      ? "Open your device settings to allow alerts from Spotted."
                      : "Enable alerts, sounds, and badges for the categories below."}
                </Text>
              </View>
            </View>

            {osStatus === "granted" ? (
              <View style={{ marginTop: space[3] + 2 }}>
                <Row
                  title="Allow push notifications"
                  right={
                    <Toggle value={p.pushEnabled} onToggle={() => update.mutate({ pushEnabled: !p.pushEnabled })} />
                  }
                />
                <Pressable
                  onPress={() => void Linking.openSettings()}
                  haptic="none"
                  accessibilityLabel="Device notification settings"
                  style={{ paddingTop: space[3], flexDirection: "row", alignItems: "center", gap: space[1] + 2 }}
                >
                  <Text variant="meta-strong">Device notification settings</Text>
                  <ExternalLink size={13} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: space[3] + 2 }}>
                <Button onPress={() => void enableNotifications()} loading={permissionBusy} disabled={permissionBusy}>
                  {osStatus === "denied" ? "Open device settings" : "Enable notifications"}
                </Button>
              </View>
            )}
          </View>

          <SectionLabel>Gym reminders</SectionLabel>
          <Row
            title="Gym and post reminders"
            sub="Your daily nudge and check-in confirmations."
            right={<CategoryToggle value={p.gymRemindersEnabled} field="gymRemindersEnabled" update={update} />}
          />
          {bgLocation !== "unavailable" ? (
            <Row
              title="Arrival buzz with the app closed"
              sub={
                bgLocation === "granted"
                  ? "On — location set to Always. One low-power geofence on your gym, no history."
                  : "Needs location set to Always so your gym can wake the app when you walk in."
              }
              right={
                bgLocation === "granted" ? (
                  <Text variant="meta-strong" className="text-gold">
                    On
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Turn on background arrival detection"
                    onPress={() => void enableBackgroundLocation()}
                    haptic="selection"
                  >
                    <Text variant="meta-strong" className="text-gold">
                      {bgLocation === "denied" ? "Open Settings" : "Turn on"}
                    </Text>
                  </Pressable>
                )
              }
            />
          ) : null}
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
              <SettingChoice
                options={SCOPES}
                value={p.friendCheckinsScope}
                onSelect={(key) => update.mutate({ friendCheckinsScope: key })}
              />
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
            sub="When someone tags you in a post."
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
            right={<CategoryToggle value={p.quietHoursEnabled} field="quietHoursEnabled" update={update} />}
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
          <Text variant="meta" className="mt-3">
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
