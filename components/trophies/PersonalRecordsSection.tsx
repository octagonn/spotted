import { Trophy } from "lucide-react-native";
import { Text, View } from "react-native";

import { relDay } from "@/lib/relDay";
import type { PersonalRecord } from "@/hooks/usePersonalRecords";
import { colors } from "@/theme/colors";

/**
 * Workout-session PRs in the trophy case — every "NEW PR" earned while logging
 * a workout lives here permanently (any exercise, lifts and cardio alike).
 */
export function PersonalRecordsSection({ records }: { records: PersonalRecord[] }) {
  if (records.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: colors.fog }}>
          Personal Records
        </Text>
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.gold }}>
          {records.length}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {records.map((record) => (
          <View
            key={record.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderWidth: 1,
              borderColor: "rgba(232,180,76,0.35)",
              backgroundColor: "rgba(232,180,76,0.10)",
              borderRadius: 16,
              paddingVertical: 13,
              paddingHorizontal: 14
            }}
          >
            <Trophy size={26} color={colors.gold} strokeWidth={1.7} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
                {record.name}
              </Text>
              <Text style={{ marginTop: 1, fontSize: 11, color: colors.fog }}>
                {record.was} · {relDay(record.earnedAt)}
              </Text>
            </View>
            <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 16, color: colors.gold }}>
              {record.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
