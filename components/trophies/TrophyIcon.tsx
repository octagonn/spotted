import {
  Activity,
  AlarmClock,
  ArrowDownUp,
  Cake,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ChevronsUp,
  Clock,
  Clover,
  Crown,
  Drumstick,
  Dumbbell,
  Egg,
  Flag,
  Flame,
  Footprints,
  Ghost,
  Gift,
  Globe,
  HandMetal,
  Heart,
  Home,
  Layers,
  MapPin,
  Moon,
  PartyPopper,
  Repeat,
  RotateCcw,
  Sandwich,
  Shield,
  Shuffle,
  Sparkles,
  Split,
  Sun,
  Sunrise,
  Sunset,
  Swords,
  Timer,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react-native";

import { colors } from "@/theme/colors";

/**
 * Every icon key used by trophy_definitions.icon must be mapped here — the DB
 * stores only the key string; the glyph itself ships with the client. An
 * unmapped key falls back to the generic Trophy glyph, so when adding a trophy
 * server-side, add its key here first.
 */
const ICONS: Record<string, LucideIcon> = {
  // Keys currently used by trophy_definitions
  activity: Activity,
  "alarm-clock": AlarmClock,
  cake: Cake,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus,
  clock: Clock,
  crown: Crown,
  dumbbell: Dumbbell,
  flame: Flame,
  footprints: Footprints,
  gift: Gift,
  "hand-metal": HandMetal,
  home: Home,
  "map-pin": MapPin,
  moon: Moon,
  "party-popper": PartyPopper,
  "rotate-ccw": RotateCcw,
  sandwich: Sandwich,
  shield: Shield,
  shuffle: Shuffle,
  sun: Sun,
  sunrise: Sunrise,
  timer: Timer,
  "user-plus": UserPlus,
  users: Users,
  // Legacy keys kept for older definitions
  "chevrons-up": ChevronsUp,
  "arrow-down-up": ArrowDownUp,
  sunset: Sunset,
  globe: Globe,
  repeat: Repeat,
  split: Split,
  layers: Layers,
  swords: Swords,
  sparkles: Sparkles,
  heart: Heart,
  clover: Clover,
  egg: Egg,
  ghost: Ghost,
  drumstick: Drumstick,
  flag: Flag
};

/** Resolves a trophy `iconKey` to a lucide glyph; gold when earned, dim zinc when locked. */
export function TrophyIcon({
  iconKey,
  earned,
  size = 22,
  color
}: {
  iconKey: string;
  earned: boolean;
  size?: number;
  /** Overrides the earned/locked color — used when composited over medallion art. */
  color?: string;
}) {
  const Icon = ICONS[iconKey] ?? Trophy;
  return <Icon size={size} color={color ?? (earned ? colors.gold : colors.ash)} strokeWidth={2} />;
}
