import { useRouter, type Href } from "expo-router";
import { ChevronLeft, ChevronRight, Dumbbell, Globe, Lock } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { FlatList, Text, View, type ListRenderItemInfo } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { SkeletonWorkoutRow } from "@/components/ui/Skeleton";
import type { WorkoutRow } from "@/hooks/queries/useWorkouts";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/** Weeks of history to keep swipeable (spec #12). */
const MAX_WEEKS = 12;
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

type DayEntry = {
  dateKey: string;
  label: string;
  /** Workouts hit that day (usually 0–1, supports AM/PM doubles). */
  workouts: { id: string; name: string }[];
  isFuture: boolean;
  isToday: boolean;
  /** They posted a SPOTTED that day (gym_days ledger) — so it wasn't a rest day
   *  even though no workout was logged. */
  posted: boolean;
};

type WeekPage = {
  /** 0 = current week, 1 = last week, … */
  index: number;
  startKey: string;
  title: string;
  days: DayEntry[];
};

/** Monday 00:00 of the week containing `d` (weeks run Mon–Sun, spec #8). */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - dow);
  return out;
}

function fmtRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (x: Date) => x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${f(start)} – ${f(end)}`;
}

/**
 * The weekly split (profile spec #6–13): all 7 days Mon–Sun labeled with the
 * workout(s) hit that day, REST for past no-gym days, grayed for future days.
 * Swipe left for previous weeks (12-week cap). Tapping a workout opens its
 * exact logged detail.
 */
export function WeeklySplit({
  workouts,
  gymDays,
  isLoading,
  ownProfile,
  splitPublic,
  onTogglePublic
}: {
  workouts: WorkoutRow[];
  /** Local-date keys the user posted on. A day they posted but didn't log is
   *  "workout not listed", NOT a rest day. */
  gymDays?: ReadonlySet<string> | Map<string, unknown>;
  isLoading: boolean;
  ownProfile: boolean;
  /** Current privacy value (own profile only). */
  splitPublic?: boolean;
  onTogglePublic?: (next: boolean) => void;
}) {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const listRef = useRef<FlatList<WeekPage>>(null);

  const pages = useMemo<WeekPage[]>(() => {
    // Bucket workouts by local date key.
    const byDay = new Map<string, { id: string; name: string }[]>();
    for (const w of workouts) {
      const key = localDateKey(new Date(w.startedAt));
      const list = byDay.get(key) ?? [];
      list.push({ id: w.id, name: w.name });
      byDay.set(key, list);
    }
    const todayKey = localDateKey(new Date());
    const thisMonday = mondayOf(new Date());
    // History stops at the week of the EARLIEST workout — no endless empty
    // REST weeks before the user ever posted (12-week cap still applies).
    const earliest = workouts.length
      ? workouts.reduce((min, w) => (w.startedAt < min ? w.startedAt : min), workouts[0].startedAt)
      : null;
    // History depth must account for POSTED days too — someone who posts daily
    // but never logs a workout previously got zero history pages.
    const gymDayKeys = gymDays ? [...(gymDays as Map<string, unknown>).keys()] : [];
    const earliestGymDay = gymDayKeys.length ? gymDayKeys.reduce((a, b) => (a < b ? a : b)) : null;
    const earliestWorkoutMonday = earliest ? localDateKey(mondayOf(new Date(earliest))) : null;
    const earliestGymMonday = earliestGymDay
      ? localDateKey(mondayOf(new Date(`${earliestGymDay}T12:00:00`)))
      : null;
    const candidates = [earliestWorkoutMonday, earliestGymMonday].filter((k): k is string => Boolean(k));
    const earliestMondayKey = candidates.length
      ? candidates.reduce((a, b) => (a < b ? a : b))
      : localDateKey(thisMonday);
    const out: WeekPage[] = [];
    for (let weekBack = 0; weekBack < MAX_WEEKS; weekBack += 1) {
      const start = new Date(thisMonday);
      start.setDate(start.getDate() - weekBack * 7);
      if (weekBack > 0 && localDateKey(start) < earliestMondayKey) break;
      const days: DayEntry[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateKey = localDateKey(d);
        days.push({
          dateKey,
          label: DAY_LABELS[i],
          // Reverse chronological within the day so AM session lists first.
          workouts: (byDay.get(dateKey) ?? []).slice().reverse(),
          isFuture: dateKey > todayKey,
          isToday: dateKey === todayKey,
          posted: gymDays ? gymDays.has(dateKey) : false
        });
      }
      out.push({
        index: weekBack,
        startKey: localDateKey(start),
        title: weekBack === 0 ? "This week" : weekBack === 1 ? "Last week" : fmtRange(start),
        days
      });
    }
    return out;
  }, [workouts, gymDays]);

  // Loading: one placeholder row per day of the week.
  if (isLoading) {
    return (
      <View>
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonWorkoutRow key={i} />
        ))}
      </View>
    );
  }

  // Empty state (#13): brand-new users see intent, not a wall of REST.
  if (!isLoading && workouts.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingTop: 44, paddingHorizontal: 40 }}>
        <Dumbbell size={26} color={tokens.text.tertiary} strokeWidth={1.8} />
        <Text style={{ marginTop: 12, fontFamily: "Geist_400Regular", fontSize: 14, color: tokens.text.tertiary, textAlign: "center", lineHeight: 20 }}>
          {ownProfile
            ? "No workouts logged yet. Hit Start a workout and your split builds itself."
            : "No workouts logged yet."}
        </Text>
      </View>
    );
  }

  const current = pages[pageIndex];

  const renderPage = ({ item }: ListRenderItemInfo<WeekPage>) => (
    <View style={{ width, paddingHorizontal: 18 }}>
      <View style={{ gap: 6 }}>
        {item.days.map((day) => {
          const nothingLogged = !day.isFuture && day.workouts.length === 0;
          // Posted but never opened the workout logger → the session happened,
          // we just don't know what it was. Calling that "REST" was wrong.
          const notListed = nothingLogged && day.posted;
          const rest = nothingLogged && !day.posted;
          return (
            <View
              key={day.dateKey}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: day.isToday ? "rgba(232,180,76,0.45)" : colors.iron,
                backgroundColor: day.workouts.length ? colors.ink : "transparent",
                paddingVertical: 11,
                paddingHorizontal: 14,
                opacity: day.isFuture ? 0.35 : 1
              }}
            >
              <Text style={{ width: 38, fontFamily: "GeistMono_500Medium", fontSize: 11, letterSpacing: 1, color: day.isToday ? colors.gold : tokens.text.tertiary }}>
                {day.label}
              </Text>
              {day.isFuture ? (
                /* Not here yet (#9) — grayed blank, never REST. */
                <View
                  accessible
                  accessibilityLabel="Upcoming"
                  style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.graphite }}
                />
              ) : notListed ? (
                <Text
                  accessibilityLabel="Workout not listed"
                  style={{ flex: 1, fontFamily: "Geist_500Medium", fontSize: 12.5, letterSpacing: 1, color: colors.fog }}
                >
                  WORKOUT NOT LISTED
                </Text>
              ) : rest ? (
                <Text
                  accessibilityLabel="Rest day"
                  style={{ flex: 1, fontFamily: "Geist_500Medium", fontSize: 13, letterSpacing: 2, color: tokens.text.tertiary }}
                >
                  REST
                </Text>
              ) : (
                /* Multiple sessions in one day each get their own tap target (#10, #11). */
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {day.workouts.map((w) => (
                    <Pressable
                      key={w.id}
                      onPress={() => router.push(`/workout/${w.id}` as Href)}
                      accessibilityLabel={`Open ${w.name}`}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: tokens.accent.goldSubtle, borderWidth: 1, borderColor: "rgba(232,180,76,0.4)", paddingVertical: 5, paddingHorizontal: 11 }}>
                        <Dumbbell size={11} color={colors.gold} strokeWidth={2} />
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>{w.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Week header: range + arrows + privacy toggle (own profile, #14). */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 10 }}>
        <Pressable
          accessibilityLabel="Previous week"
          disabled={pageIndex >= MAX_WEEKS - 1}
          onPress={() => listRef.current?.scrollToIndex({ index: pageIndex + 1, animated: true })}
          hitSlop={8}
        >
          <ChevronLeft size={18} color={pageIndex >= MAX_WEEKS - 1 ? colors.iron : colors.mist} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.bone }}>
          {current?.title ?? ""}
        </Text>
        <Pressable
          accessibilityLabel="Next week"
          disabled={pageIndex === 0}
          onPress={() => listRef.current?.scrollToIndex({ index: pageIndex - 1, animated: true })}
          hitSlop={8}
        >
          <ChevronRight size={18} color={pageIndex === 0 ? colors.iron : colors.mist} />
        </Pressable>
        {ownProfile && onTogglePublic ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={splitPublic ? "Split is public — make private" : "Split is private — make public"}
            accessibilityState={{ checked: Boolean(splitPublic) }}
            onPress={() => onTogglePublic(!splitPublic)}
            hitSlop={8}
            style={{ marginLeft: 12 }}
          >
            {splitPublic ? (
              <Globe size={15} color={colors.fog} strokeWidth={2} />
            ) : (
              <Lock size={15} color={colors.gold} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>

      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(item) => item.startKey}
          horizontal
          pagingEnabled
          // Swipe LEFT reveals previous weeks (#12) — inverted so index grows leftward.
          inverted
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
          renderItem={renderPage}
        />
      ) : null}
    </View>
  );
}
