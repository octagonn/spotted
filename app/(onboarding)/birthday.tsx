import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { getDeviceId } from "@/lib/deviceId";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
const MIN_AGE = 13;

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
  onChange
}: {
  items: string[];
  index: number;
  onChange: (index: number) => void;
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
    <View style={{ flex: 1, height: WHEEL_HEIGHT }}>
      <ScrollView
        ref={scrollRef}
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
  const today = useMemo(() => new Date(), []);
  const years = useMemo(() => {
    const current = today.getFullYear();
    return Array.from({ length: 100 }, (_, i) => String(current - i));
  }, [today]);

  const [monthIndex, setMonthIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [yearListIndex, setYearListIndex] = useState(18);
  const [submitting, setSubmitting] = useState(false);

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
      router.push("/create-profile");
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
        router.replace("/blocked");
        return;
      }
      const { error } = await supabase.auth.updateUser({ data: { birth_date: birthDate } });
      if (error) {
        throw error;
      }
      // Persist DOB to the profile too (server age calc + immutability guard).
      const uid = useAuthStore.getState().userId;
      if (uid) {
        await supabase.from("profiles").update({ birth_date: birthDate }).eq("id", uid);
      }
      useAuthStore.setState({ needsBirthdate: false });
      router.push("/create-profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your birthday.";
      Alert.alert("Couldn't save", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
        <Text variant="micro" className="text-mist">
          STEP 2 OF 6
        </Text>
      </View>
      <Text variant="display-md" className="mt-6">
        WHEN WERE YOU BORN?
      </Text>

      {/* Three EQUAL columns, evenly spread — mismatched widths made the
          wheels sit off-center. */}
      <View className="mt-10 flex-row rounded-card border border-hairline-strong bg-glass-strong px-2 py-2">
        <Wheel items={MONTHS} index={monthIndex} onChange={setMonthIndex} />
        <Wheel
          items={days}
          index={Math.min(dayIndex, maxDays - 1)}
          onChange={setDayIndex}
        />
        <Wheel items={years} index={yearListIndex} onChange={setYearListIndex} />
      </View>

      {tooYoung ? (
        <View className="mt-6 rounded-card border border-hairline-strong bg-glass-strong p-4">
          <Text variant="micro" className="text-white">
            NOT OLD ENOUGH
          </Text>
          <Text variant="caption" className="mt-2 text-mist">
            Spotted is for people {MIN_AGE} and up. You can't create an account yet.
          </Text>
        </View>
      ) : null}

      <Button className="mt-10" onPress={handleContinue} loading={submitting} disabled={tooYoung}>
        Continue
      </Button>
    </Screen>
  );
}
