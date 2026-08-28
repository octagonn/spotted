import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { appAlert } from "@/components/ui/AppDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { colors } from "@/theme/colors";
import { getDeviceId } from "@/lib/deviceId";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { requestDeclaredAgeRange } from "@/modules/declared-age-range";
import { useAuthStore } from "@/stores/auth";

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
const MIN_AGE = 13;
/** Remembered so a user who declined is never re-prompted on this device. */
const AGE_RANGE_DECLINED_KEY = "age-range-declined";
/** A sheet that never presents must not freeze onboarding. */
const AGE_RANGE_TIMEOUT_MS = 8000;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function ageOn(today: Date, year: number, monthIndex: number, day: number): number {
  let age = today.getFullYear() - year;
  if (today.getMonth() < monthIndex || (today.getMonth() === monthIndex && today.getDate() < day)) {
    age -= 1;
  }
  return age;
}

function Wheel({
  items,
  index,
  onChange,
  label
}: {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  /** Accessible name for the whole picker ("Month"/"Day"/"Year"). */
  label: string;
}) {
  const scrollRef = useRef<ScrollView>(null);

  // Re-sync scroll position when the list shrinks (e.g. 31 days -> 28).
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const raw = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const next = Math.min(Math.max(raw, 0), items.length - 1);
    if (next !== index) {
      onChange(next);
    }
  }

  return (
    // WCAG 4.1.2 / 2.1.1: the scroll picker is unusable with a screen reader
    // (swipe does nothing, the value isn't announced) — which blocked the age
    // gate entirely. Expose it as an "adjustable" so VoiceOver/TalkBack can
    // swipe up/down to change the value, and hide the raw rows underneath.
    <View
      style={{ flex: 1, height: WHEEL_HEIGHT }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") {
          onChange(Math.min(index + 1, items.length - 1));
        } else if (event.nativeEvent.actionName === "decrement") {
          onChange(Math.max(index - 1, 0));
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        nestedScrollEnabled
      >
        {items.map((item, itemIndex) => {
          const selected = itemIndex === index;
          return (
            <View key={item} style={{ height: ITEM_HEIGHT }} className="items-center justify-center">
              <Text
                variant={selected ? "body-strong" : "body"}
                className={selected ? "text-white" : "text-fog"}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 border-y border-hairline-strong"
        style={{ top: WHEEL_PADDING, height: ITEM_HEIGHT }}
      />
    </View>
  );
}

export default function BirthdayScreen() {
  const { fadeStyle, fadeNavigate } = usePageFade();
  const today = useMemo(() => new Date(), []);
  const years = useMemo(() => {
    const current = today.getFullYear();
    return Array.from({ length: 100 }, (_, i) => String(current - i));
  }, [today]);

  const [monthIndex, setMonthIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [yearListIndex, setYearListIndex] = useState(18);
  const [submitting, setSubmitting] = useState(false);
  const [appleAgeConfirmed, setAppleAgeConfirmed] = useState(false);
  // What Apple's age-range sheet returned — recorded with the birthday so
  // there is an audit trail of how age was assured.
  const [ageAssurance, setAgeAssurance] = useState<"shared" | "declined" | "unavailable">("unavailable");
  // Apple's age-range sheet takes a beat to present. Show a loading state until
  // it resolves so the screen doesn't read as frozen.
  const [ageChecking, setAgeChecking] = useState(true);

  // Age Assurance (iOS 26+): ask the OS for the user's declared age range
  // before the DOB form. A parent-declared child account under 13 is blocked
  // outright — it can't lie its way past the wheel. Shared 13+ ranges show a
  // confirmation note; declined/unavailable falls back to the DOB gate alone
  // (declining must not punish, per Apple guidance).
  const askedAgeRange = useRef(false);
  useEffect(() => {
    if (askedAgeRange.current) return;
    askedAgeRange.current = true;
    void (async () => {
      try {
        // Once someone taps "Don't Share" we remember it and never ask again on
        // this device. Apple's guidance is explicit that declining must not be
        // punished, and re-prompting every time the screen mounts is a form of
        // nagging. A SHARED answer is deliberately not remembered, so the
        // under-13 hard block below can't be dodged by relaunching the app.
        const previouslyDeclined = await AsyncStorage.getItem(AGE_RANGE_DECLINED_KEY).catch(() => null);
        if (previouslyDeclined === "1") {
          setAgeAssurance("declined");
          setAgeChecking(false);
          return;
        }

        // Never let a sheet that fails to present strand onboarding: if the OS
        // doesn't answer in time we fall through to the manual DOB gate.
        const result = await Promise.race([
          requestDeclaredAgeRange(),
          new Promise<{ status: "unavailable" }>((resolve) =>
            setTimeout(() => resolve({ status: "unavailable" }), AGE_RANGE_TIMEOUT_MS)
          )
        ]);

        if (result.status === "shared") {
          setAgeAssurance("shared");
          if (typeof result.upperBound === "number" && result.upperBound < MIN_AGE) {
            // Under-13 (parent-declared): hard block. Leave the loading state up
            // while we navigate so the DOB form never flashes into view.
            fadeNavigate(() => router.replace("/blocked"));
            return;
          }
          if (typeof result.lowerBound === "number" && result.lowerBound >= MIN_AGE) {
            setAppleAgeConfirmed(true);
          }
        } else if (result.status === "declined") {
          // Declining is a valid choice: fall back to the DOB gate, exactly as
          // if the API weren't available at all.
          setAgeAssurance("declined");
          void AsyncStorage.setItem(AGE_RANGE_DECLINED_KEY, "1").catch(() => {});
        }
      } catch {
        // Any failure just falls back to the manual DOB gate below.
      }
      setAgeChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const year = Number(years[yearListIndex]);
  const maxDays = daysInMonth(year, monthIndex);
  const days = useMemo(() => Array.from({ length: maxDays }, (_, i) => String(i + 1)), [maxDays]);
  const day = Math.min(dayIndex, maxDays - 1) + 1;

  const age = ageOn(today, year, monthIndex, day);
  const tooYoung = age < MIN_AGE;

  async function handleContinue() {
    if (tooYoung || submitting) {
      return;
    }
    if (!isSupabaseConfigured) {
      fadeNavigate(() => router.push("/create-profile"));
      return;
    }
    setSubmitting(true);
    try {
      const birthDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // Server-side age gate (§1): verifies >=13 and enforces the 12-month
      // retry block by hashed email/device. Never trusts a client age flag.
      const email = useAuthStore.getState().session?.user.email ?? "";
      const deviceId = await getDeviceId();
      const { data: gate, error: gateError } = await supabase.rpc("check_age_gate", {
        p_email: email,
        p_device_id: deviceId,
        p_dob: birthDate
      });
      if (gateError) throw gateError;
      if (gate !== "ok") {
        // Hard block: no account, no explanation of the threshold, no retry.
        fadeNavigate(() => router.replace("/blocked"));
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { birth_date: birthDate, age_assurance: ageAssurance }
      });
      if (error) {
        throw error;
      }
      // Persist DOB to the profile too (server age calc + immutability guard).
      const uid = useAuthStore.getState().userId;
      if (uid) {
        await supabase.from("profiles").update({ birth_date: birthDate }).eq("id", uid);
      }
      useAuthStore.setState({ needsBirthdate: false });
      fadeNavigate(() => router.push("/create-profile"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your birthday.";
      appAlert("Couldn't save", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1 }, fadeStyle]}>
    <Screen transparent>
      <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
        <Text variant="micro" className="text-mist">
          STEP 2 OF 7
        </Text>
      </View>
      <Text variant="display-md" className="mt-6">
        WHEN WERE YOU BORN?
      </Text>

      {ageChecking ? (
        <View
          className="mt-10 items-center justify-center"
          style={{ minHeight: WHEEL_HEIGHT + 96 }}
          accessibilityLiveRegion="polite"
          accessibilityLabel="Checking your age range with Apple"
        >
          <ActivityIndicator color={colors.mist} />
          <Text variant="caption" className="mt-4 text-mist">
            Checking your age range with Apple…
          </Text>
        </View>
      ) : (
        <>
          {/* Three EQUAL columns, evenly spread — mismatched widths made the
              wheels sit off-center. */}
          <View className="mt-10 flex-row rounded-card border border-hairline-strong bg-glass-strong px-2 py-2">
            <Wheel items={MONTHS} index={monthIndex} onChange={setMonthIndex} label="Month" />
            <Wheel
              items={days}
              index={Math.min(dayIndex, maxDays - 1)}
              onChange={setDayIndex}
              label="Day"
            />
            <Wheel items={years} index={yearListIndex} onChange={setYearListIndex} label="Year" />
          </View>

          {tooYoung ? (
            <View
              className="mt-6 rounded-card border border-hairline-strong bg-glass-strong p-4"
              accessibilityLiveRegion="assertive"
            >
              <Text variant="micro" className="text-white">
                NOT OLD ENOUGH
              </Text>
              <Text variant="caption" className="mt-2 text-mist">
                Spotted is for people {MIN_AGE} and up. You can't create an account yet.
              </Text>
            </View>
          ) : appleAgeConfirmed ? (
            <Text variant="caption" className="mt-4 text-mist">
              Age range confirmed with Apple. Your birthday sets up your profile.
            </Text>
          ) : null}

          <Button className="mt-10" onPress={handleContinue} loading={submitting} disabled={tooYoung}>
            Continue
          </Button>
        </>
      )}
    </Screen>
    </Animated.View>
  );
}
