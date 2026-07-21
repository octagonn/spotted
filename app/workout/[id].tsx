import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Dumbbell, Flame, Trophy } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useWorkout, type CardioSet, type LiftSet } from "@/hooks/queries/useWorkouts";
import { fmtClock } from "@/lib/workoutLibrary";
import { relDay } from "@/lib/relDay";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const DISP = "Geist_700Bold";
const NUM = "GeistMono_500Medium";
const CARDIO = "#FF8A4C";
const CARDIO_TINT = "rgba(255,138,76,0.14)";

function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text style={[{ fontFamily: "Geist_600SemiBold", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: tokens.text.tertiary }, style]}>
      {children}
    </Text>
  );
}

function PrBadge() {
  return (
    <View style={{ backgroundColor: tokens.accent.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontFamily: DISP, fontSize: 10, letterSpacing: 1, color: colors.black }}>PR</Text>
    </View>
  );
}

/** Read-only session detail (prototype SESSION DETAIL) — self or friend (RLS). */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const workout = useWorkout(id);

  if (workout.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg.base, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!workout.data) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg.base, paddingTop: insets.top + 12 }}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={{ paddingHorizontal: 18 }}>
          <ChevronLeft size={26} color={tokens.text.secondary} />
        </Pressable>
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          This workout is no longer available.
        </Text>
      </View>
    );
  }

  const w = workout.data;
  const timeLabel = new Date(w.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const when = `${relDay(w.startedAt)} · ${timeLabel}`;
  const stats = [
    { v: w.totalVolume.toLocaleString(), l: "Volume · lb" },
    { v: `${w.totalSets}`, l: "Sets" },
    { v: fmtClock(w.durationSeconds), l: "Duration" },
    { v: `${w.exerciseCount}`, l: "Exercises" }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.base }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 2 }}>
            <ChevronLeft size={28} color={tokens.text.secondary} />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: DISP, fontSize: 26, letterSpacing: -0.6, color: tokens.text.primary }}>
            {w.name}
          </Text>
        </View>
        <Text style={{ paddingLeft: 36, marginTop: 4, fontSize: 14, color: tokens.text.tertiary }}>{when}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 28 }}>
        {/* stat grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {stats.map((st) => (
            <View
              key={st.l}
              style={{ width: "48%", flexGrow: 1, borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.bg.raised, borderRadius: radius.md, padding: 16 }}
            >
              <Text style={{ fontFamily: NUM, fontSize: 26, lineHeight: 28, color: tokens.text.primary }}>{st.v}</Text>
              <Micro style={{ marginTop: 6, letterSpacing: 1.5 }}>{st.l}</Micro>
            </View>
          ))}
        </View>

        {/* trophies earned */}
        {w.prs.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Micro style={{ letterSpacing: 3, marginBottom: 12, marginHorizontal: 2 }}>Trophies earned</Micro>
            <View style={{ gap: 12 }}>
              {w.prs.map((pr) => (
                <View
                  key={pr.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    borderWidth: 1,
                    borderColor: "rgba(232,180,76,0.35)",
                    backgroundColor: tokens.accent.goldSubtle,
                    borderRadius: radius.md,
                    paddingVertical: 15,
                    paddingHorizontal: 16
                  }}
                >
                  <Trophy size={34} color={tokens.accent.gold} strokeWidth={1.6} />
                  <View style={{ flex: 1 }}>
                    <Micro style={{ color: tokens.accent.gold }}>New PR</Micro>
                    <Text style={{ marginTop: 1, fontFamily: DISP, fontSize: 17, color: tokens.text.primary }}>{pr.name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: NUM, fontSize: 19, color: tokens.text.primary }}>{pr.value}</Text>
                    <Text style={{ fontSize: 11, color: "#9A8A5A" }}>{pr.was}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* exercises + sets */}
        <View style={{ marginTop: 22 }}>
          <Micro style={{ letterSpacing: 3, marginBottom: 12, marginHorizontal: 2 }}>Exercises</Micro>
          <View style={{ gap: 14 }}>
            {w.exercises.map((ex) => {
              const isCardio = ex.kind === "cardio";
              const sets = ex.sets.filter((s) => s.done);
              return (
                <View key={ex.id} style={{ borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.bg.raised, borderRadius: radius.md, padding: 15 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: isCardio ? CARDIO_TINT : tokens.accent.goldSubtle, alignItems: "center", justifyContent: "center" }}>
                      {isCardio ? <Flame size={18} color={CARDIO} strokeWidth={1.7} /> : <Dumbbell size={19} color={tokens.accent.gold} strokeWidth={1.8} />}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 17, color: tokens.text.primary }}>{ex.name}</Text>
                      {sets.some((s) => s.pr) ? <PrBadge /> : null}
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {(sets.length ? sets : ex.sets).map((s, i) => {
                      const pr = Boolean(s.pr);
                      const text = isCardio
                        ? `${(s as CardioSet).mi} mi · ${(s as CardioSet).min} min`
                        : `${(s as LiftSet).w} lb × ${(s as LiftSet).r}`;
                      const sub = isCardio
                        ? `${(s as CardioSet).mi > 0 ? ((s as CardioSet).min / (s as CardioSet).mi).toFixed(1) : "0"} min/mi`
                        : `${(s as LiftSet).w * (s as LiftSet).r} lb`;
                      return (
                        <View
                          key={s.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            backgroundColor: pr ? tokens.accent.goldSubtle : tokens.bg.subtle,
                            borderWidth: 1,
                            borderColor: pr ? "rgba(232,180,76,0.4)" : tokens.border.default,
                            borderRadius: 13,
                            paddingVertical: 12,
                            paddingHorizontal: 15
                          }}
                        >
                          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: tokens.bg.base, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontFamily: NUM, fontSize: 13, color: tokens.text.secondary }}>{i + 1}</Text>
                          </View>
                          <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.text.primary }}>{text}</Text>
                          {pr ? <PrBadge /> : null}
                          <Text style={{ fontFamily: NUM, fontSize: 13, color: tokens.text.tertiary }}>{sub}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            {w.exercises.length === 0 ? (
              <Text style={{ paddingTop: 10, textAlign: "center", fontSize: 13, color: colors.fog }}>No exercises were logged.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
