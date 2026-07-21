import {
  ArrowDownUp,
  ChevronsUp,
  Clover,
  Drumstick,
  Dumbbell,
  Egg,
  Flag,
  Flame,
  Ghost,
  Gift,
  Globe,
  Heart,
  Home,
  Layers,
  Moon,
  PartyPopper,
  Repeat,
  Split,
  Sparkles,
  Sunrise,
  Sunset,
  Swords,
  Trophy,
  Users,
  type LucideIcon
} from "lucide-react-native";

import { colors } from "@/theme/colors";

const ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  "chevrons-up": ChevronsUp,
  "arrow-down-up": ArrowDownUp,
  sunrise: Sunrise,
  moon: Moon,
  sunset: Sunset,
  globe: Globe,
  repeat: Repeat,
  split: Split,
  layers: Layers,
  flame: Flame,
  swords: Swords,
  sparkles: Sparkles,
  heart: Heart,
  clover: Clover,
  egg: Egg,
  ghost: Ghost,
  drumstick: Drumstick,
  gift: Gift,
  "party-popper": PartyPopper,
  home: Home,
  flag: Flag,
  users: Users
};

/** Resolves a trophy `iconKey` to a lucide glyph; gold when earned, dim zinc when locked. */
export function TrophyIcon({ iconKey, earned, size = 22 }: { iconKey: string; earned: boolean; size?: number }) {
  const Icon = ICONS[iconKey] ?? Trophy;
  return <Icon size={size} color={earned ? colors.gold : colors.ash} strokeWidth={2} />;
}
