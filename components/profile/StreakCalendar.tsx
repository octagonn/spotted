import { ChevronLeft, ChevronRight, Moon } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent, Text, View, type ListRenderItemInfo } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import type { StreakDay, StreakDayMap } from "@/hooks/queries/useStreakDays";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";

// Internal horizontal inset within the calendar card.
const H_PAD = 14;
// Tight grid so it reads as one object (GitHub contributions / Apple Fitness).
const CELL_RADIUS = 6;
const CELL_GAP = 3;
const ROW_GAP = 3;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
/** If we don't know the join date, browse this many past months. */
const FALLBACK_MONTHS = 12;
const MAX_MONTHS = 240;

type MonthPage = { year: number; month: number };

function startOfLocalDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Swipeable monthly gym calendar, standard calendar orientation: the past sits
 * to the LEFT (‹ or swiping right walks into older months, stopping at the
 * account's creation month) and › walks forward, stopping at the current
 * month — no future. Data-wise months[0] is still the current month; the
 * inverted pager handles the visual order. Each gym day shows a preview of
 * that day's post with the date over it; tap it to open the post. The day the
 * account was created is marked gold.
 */
export function StreakCalendar({
  days,
  createdAt,
  onDayPress,
  onRestDayPress
}: {
  days: StreakDayMap;
  /** ISO timestamp the account was created — bounds the calendar's start. */
  createdAt?: string | null;
  onDayPress: (dateKey: string) => void;
  /** Own profile only: tapping TODAY's rest cell (change of mind — cancel the
   *  rest day). Past rest days are history and stay read-only. */
  onRestDayPress?: (dateKey: string) => void;
}) {
  const listRef = useRef<FlatList<MonthPage>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const createdKey = createdAt ? localDateKey(new Date(createdAt)) : null;

  // months[0] = current month; the last entry is the account's creation month.
  const months = useMemo<MonthPage[]>(() => {
    const now = new Date();
    let count = FALLBACK_MONTHS;
    if (createdAt) {
      const c = new Date(createdAt);
      count = (now.getFullYear() - c.getFullYear()) * 12 + (now.getMonth() - c.getMonth());
    }
    count = Math.max(0, Math.min(count, MAX_MONTHS));
    return Array.from({ length: count + 1 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, [createdAt]);

  const current = months[index];
  const monthGymDays = useMemo(() => {
    if (!current) return 0;
    const prefix = `${current.year}-${String(current.month + 1).padStart(2, "0")}-`;
    let count = 0;
    // Rest days live in the same ledger but are NOT gym days — counting them
    // here would overstate the month.
    for (const [key, day] of days) if (key.startsWith(prefix) && day.kind !== "rest") count++;
    return count;
  }, [days, current]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== pageWidth) setPageWidth(w);
  };

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), months.length - 1);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  };

  const renderMonth = ({ item }: ListRenderItemInfo<MonthPage>) => (
    <MonthGrid page={item} width={pageWidth} days={days} createdAt={createdAt} createdKey={createdKey} onDayPress={onDayPress} onRestDayPress={onRestDayPress} />
  );

  return (
    <View onLayout={onLayout}>
      {/* Header: month + gym-day count + quiet month nav */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: H_PAD,
          paddingBottom: 12
        }}
      >
        <View>
          <Text style={{ fontFamily: "Boldonse_400Regular", fontSize: 14, color: colors.white }}>
            {current ? `${MONTH_NAMES[current.month]} ${current.year}` : ""}
          </Text>
          <Text style={{ marginTop: 4, fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.fog }}>
            {`${monthGymDays} gym ${monthGymDays === 1 ? "day" : "days"}`}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {/* ‹ = previous month (older), disabled at the creation month */}
          <NavButton disabled={index === months.length - 1} onPress={() => goTo(index + 1)} accessibilityLabel="Previous month">
            <ChevronLeft size={18} color={index === months.length - 1 ? colors.iron : colors.silver} strokeWidth={2} />
          </NavButton>
          {/* › = next month (newer), disabled at the current month */}
          <NavButton disabled={index === 0} onPress={() => goTo(index - 1)} accessibilityLabel="Next month">
            <ChevronRight size={18} color={index === 0 ? colors.iron : colors.silver} strokeWidth={2} />
          </NavButton>
        </View>
      </View>

      {pageWidth > 0 ? (
        <FlatList
          ref={listRef}
          data={months}
          keyExtractor={(m) => `${m.year}-${m.month}`}
          renderItem={renderMonth}
          horizontal
          // Visual order flipped so older months lie to the LEFT (calendar
          // convention) while months[0] stays the current month in data.
          inverted
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_d, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
            if (i !== index) setIndex(i);
          }}
        />
      ) : null}
    </View>
  );
}

function NavButton({
  disabled,
  onPress,
  accessibilityLabel,
  children
}: {
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel} haptic={false} hitSlop={8}>
      <View
        style={{
          width: 28,
          height: 28,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

type Cell = {
  day: number;
  key: string;
  gym: StreakDay | undefined;
  future: boolean;
  preCreation: boolean;
  isCreation: boolean;
};

function MonthGrid({
  page,
  width,
  days,
  createdAt,
  createdKey,
  onDayPress,
  onRestDayPress
}: {
  page: MonthPage;
  width: number;
  days: StreakDayMap;
  createdAt?: string | null;
  createdKey: string | null;
  onDayPress: (dateKey: string) => void;
  onRestDayPress?: (dateKey: string) => void;
}) {
  const inner = width - H_PAD * 2;
  const cell = Math.floor((inner - 6 * CELL_GAP) / 7); // 7 cols, tight gaps
  const gap = (inner - cell * 7) / 6;

  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const created = createdAt ? startOfLocalDay(createdAt) : null;
    const first = new Date(page.year, page.month, 1);
    const lead = first.getDay(); // 0 = Sunday
    const daysInMonth = new Date(page.year, page.month + 1, 0).getDate();
    const out: (Cell | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(page.year, page.month, d);
      const key = localDateKey(date);
      out.push({
        day: d,
        key,
        gym: days.get(key),
        future: date.getTime() > today.getTime(),
        preCreation: created ? date.getTime() < created.getTime() : false,
        isCreation: createdKey === key
      });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [page, days, createdAt, createdKey]);

  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ width, paddingHorizontal: H_PAD }}>
      {/* Weekday header */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ width: cell, marginRight: i < 6 ? gap : 0, alignItems: "center" }}>
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, color: colors.ash }}>{w}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", marginBottom: ROW_GAP }}>
          {row.map((c, i) => (
            <View key={i} style={{ width: cell, height: cell, marginRight: i < 6 ? gap : 0 }}>
              {c ? <DayCell cell={c} onPress={onDayPress} onRestPress={onRestDayPress} /> : null}
            </View>
          ))}
        </View>
      ))}

      {/* Legend */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10 }}>
        <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: colors.graphite }} />
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, color: colors.ash }}>REST</Text>
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: 3,
            marginLeft: 10,
            borderWidth: 1.5,
            borderColor: colors.gold
          }}
        />
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, color: colors.ash }}>GYM</Text>
      </View>
    </View>
  );
}

function DayCell({
  cell,
  onPress,
  onRestPress
}: {
  cell: Cell;
  onPress: (dateKey: string) => void;
  onRestPress?: (dateKey: string) => void;
}) {
  const { gym, future, preCreation, isCreation } = cell;
  const inactive = future || preCreation;

  // Human date + status so the day is announced as more than a bare number, and
  // the gym/rest/upcoming state isn't conveyed by color alone (WCAG 1.4.1).
  const [, mm, dd] = cell.key.split("-").map(Number);
  const dateLabel = `${MONTH_NAMES[mm - 1]} ${dd}`;
  const isRest = gym?.kind === "rest";
  const statusLabel = isRest ? "rest day" : gym ? "gym day" : future ? "upcoming" : "no activity";
  const a11yLabel = `${dateLabel}, ${statusLabel}`;

  // Declared rest day: deliberately quiet and clearly NOT a gym day — a moon
  // on a slate ring rather than the gold photo cell, so the calendar never
  // implies you trained. It still reads as intentional (unlike an empty cell).
  if (isRest) {
    // Only TODAY's rest day is still a decision — the server only lets today
    // be cleared, so past cells stay read-only history.
    const undoable = Boolean(onRestPress) && cell.key === localDateKey();
    const body = (
      <View
        accessible={!undoable}
        accessibilityLabel={a11yLabel}
        style={{
          flex: 1,
          borderRadius: CELL_RADIUS,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.graphite,
          borderWidth: 1.5,
          borderColor: colors.slate
        }}
      >
        <Moon size={13} color={colors.silver} strokeWidth={2.2} />
        <Text
          style={{
            marginTop: 2,
            fontFamily: "GeistMono_400Regular",
            fontSize: 9.5,
            color: colors.silver
          }}
        >
          {cell.day}
        </Text>
      </View>
    );
    return (
      <View style={{ flex: 1, aspectRatio: 1, padding: CELL_GAP / 2 }}>
        {undoable ? (
          <Pressable
            onPress={() => onRestPress?.(cell.key)}
            accessibilityLabel={`${a11yLabel}. Tap to cancel the rest day.`}
            haptic={false}
            style={{ flex: 1 }}
          >
            {body}
          </Pressable>
        ) : (
          body
        )}
      </View>
    );
  }

  // Gym day: post preview with the date overlaid + a satisfying gold ring.
  if (gym) {
    const content = (
      <View
        style={{
          flex: 1,
          borderRadius: CELL_RADIUS,
          overflow: "hidden",
          backgroundColor: colors.graphite,
          borderWidth: isCreation ? 2 : 1.5,
          borderColor: colors.gold
        }}
      >
        {gym.thumbUrl ? (
          <CachedImage source={{ uri: gym.thumbUrl }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : null}
        {/* Dual-camera selfie PIP. The calendar previously showed only the rear
            frame, which is why dual posts "sometimes didn't show up" — it was
            every dual post, not a subset. */}
        {gym.insetUrl ? (
          <CachedImage
            source={{ uri: gym.insetUrl }}
            contentFit="cover"
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              width: "38%",
              aspectRatio: 3 / 4,
              borderRadius: 3,
              borderWidth: 0.5,
              borderColor: "rgba(0,0,0,0.6)"
            }}
          />
        ) : null}
        {/* Scrim keeps the date legible over any photo. */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.32)" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              fontFamily: "Geist_700Bold",
              fontSize: 12,
              color: colors.white,
              textShadowColor: "rgba(0,0,0,0.9)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2
            }}
          >
            {cell.day}
          </Text>
        </View>
      </View>
    );
    return (
      <Pressable onPress={() => onPress(cell.key)} accessibilityLabel={a11yLabel} haptic={false} style={{ flex: 1 }}>
        {content}
      </Pressable>
    );
  }

  // Non-gym day — empty cells are dimmed hard; day one keeps a quiet gold ring.
  const box = {
    flex: 1,
    borderRadius: CELL_RADIUS,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: inactive ? "transparent" : colors.graphite,
    borderWidth: isCreation ? 1.5 : 0,
    borderColor: colors.gold
  };
  const numberColor = isCreation ? colors.gold : inactive ? colors.iron : colors.ash;

  return (
    <View style={box} accessible accessibilityLabel={a11yLabel}>
      <Text
        style={{
          fontFamily: isCreation ? "Geist_700Bold" : "Geist_500Medium",
          fontSize: 12,
          color: numberColor
        }}
      >
        {cell.day}
      </Text>
    </View>
  );
}
