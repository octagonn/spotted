import { Play, Trophy } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

/** Title-case a lift name ("bench press" → "Bench Press"). */
function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Badges & chips per spec §2.11. All are display-only; wrap in a Pressable
 * at the call site when they need to be tappable.
 */

/** `.type-pill` — community type after the name: mono 9.5 uppercase, iron border, radius 5. */
export function TypePill({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.iron,
        borderRadius: 5,
        paddingVertical: 2,
        paddingHorizontal: 6,
        alignSelf: "flex-start"
      }}
    >
      <Text
        style={{
          fontFamily: "GeistMono_400Regular",
          fontSize: 9.5,
          letterSpacing: 9.5 * 0.1,
          textTransform: "uppercase",
          color: colors.silver
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** `.today-pill` — "N today": mono 9 700, black on white, radius 999. */
export function TodayPill({ count }: { count: number }) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 8,
        alignSelf: "flex-start"
      }}
    >
      <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 9, color: colors.black }}>{count} today</Text>
    </View>
  );
}

/** `.ctx` — public-feed context chip: icon + mono 10 silver, iron border, radius 999. */
export function CtxChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderWidth: 1,
        borderColor: colors.iron,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 9,
        alignSelf: "flex-start"
      }}
    >
      {icon}
      <Text
        style={{
          fontFamily: "GeistMono_400Regular",
          fontSize: 10,
          letterSpacing: 10 * 0.05,
          color: colors.silver
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** `.vchip` — video chip ("PR", "Form check"): mono 9 700 uppercase; `hot` = black on white. */
export function VChip({ children, hot }: { children: ReactNode; hot?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: hot ? colors.white : "rgba(0,0,0,0.7)",
        borderWidth: hot ? 0 : 1,
        borderColor: colors.slate,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 9,
        alignSelf: "flex-start"
      }}
    >
      <Text
        style={{
          fontFamily: "GeistMono_500Medium",
          fontSize: 9,
          letterSpacing: 9 * 0.16,
          textTransform: "uppercase",
          color: hot ? colors.black : colors.mist
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * Lift stat pill on media (§3c redesign): gold trophy glyph + title-case lift
 * name (Geist 600) + value in gold Geist Mono. Sits top-left of the media, on a
 * translucent bg.base plate with a subtle gold hairline — reads as a milestone,
 * not debug text.
 */
export function LiftTag({
  lift,
  weight,
  line,
  style
}: {
  lift?: string;
  weight?: string;
  /** Convenience for "Deadlift · 405 lb" — split into name + value. */
  line?: string;
  style?: ViewStyle;
}) {
  let name = lift ?? "";
  let value = weight;
  if (line) {
    const parts = line.split(/\s*·\s*/);
    name = parts[0] ?? line;
    value = parts.slice(1).join(" · ") || undefined;
  }
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: "rgba(9,9,11,0.7)",
          borderWidth: 1,
          borderColor: "rgba(232,180,76,0.4)",
          borderRadius: radius.sm,
          paddingVertical: 8,
          paddingHorizontal: 12,
          alignSelf: "flex-start"
        },
        style
      ]}
    >
      <Trophy size={16} color={tokens.accent.gold} strokeWidth={2} />
      <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: tokens.text.primary }}>{titleCase(name)}</Text>
      {value ? (
        <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 13, color: tokens.accent.gold }}>{value}</Text>
      ) : null}
    </View>
  );
}

/** `.vid-dur` — video duration bottom-right: mono 10.5 white on rgba(0,0,0,0.65), radius 6. */
export function VidDur({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: "rgba(0,0,0,0.65)",
          borderRadius: 6,
          paddingVertical: 4,
          paddingHorizontal: 8,
          alignSelf: "flex-start"
        },
        style
      ]}
    >
      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.white }}>{children}</Text>
    </View>
  );
}

/** `.live-badge` — "LIVE": mono 8 700 ls 0.14em, black on white, hanging below the avatar ring. */
export function LiveBadge({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: 999,
          paddingVertical: 2,
          paddingHorizontal: 7,
          alignSelf: "center"
        },
        style
      ]}
    >
      <Text
        style={{
          fontFamily: "GeistMono_500Medium",
          fontSize: 8,
          letterSpacing: 8 * 0.14,
          color: colors.black
        }}
      >
        LIVE
      </Text>
    </View>
  );
}

/** `.play-badge` — centered play circle on media: rgba(0,0,0,0.55) bg, 1.5px white border. */
export function PlayBadge({ size = 56, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "rgba(0,0,0,0.55)",
          borderWidth: 1.5,
          borderColor: colors.white,
          alignItems: "center",
          justifyContent: "center"
        },
        style
      ]}
    >
      <Play
        color={colors.white}
        fill={colors.white}
        size={Math.round(size * 0.36)}
        strokeWidth={1}
        style={{ marginLeft: size * 0.04 }}
      />
    </View>
  );
}
