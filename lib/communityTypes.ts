import {
  Building2,
  Dumbbell,
  GraduationCap,
  PartyPopper,
  Sparkles,
  Sun,
  Users,
  type LucideIcon
} from "lucide-react-native";

import type { CommunityType } from "@/hooks/queries/useCommunities";

/** Icon per community type (cards, headers, wizard). */
export const COMMUNITY_ICONS: Record<CommunityType, LucideIcon> = {
  gym: Dumbbell,
  crew: Dumbbell,
  friends: Users,
  college: GraduationCap,
  creator: Sparkles,
  brand: Building2,
  fun: PartyPopper,
  custom: Sun
};

export const COMMUNITY_TYPE_LABEL: Record<CommunityType, string> = {
  gym: "Gym",
  crew: "Gym crew",
  friends: "Friends",
  college: "College club",
  creator: "Creator",
  brand: "Brand/organization",
  fun: "Just for fun",
  custom: "Community"
};

/** Selectable types in the creation wizard (gym is mapped-gym only; custom is legacy). */
export const WIZARD_TYPES: { key: CommunityType; label: string; hint: string }[] = [
  { key: "crew", label: "Gym crew", hint: "Your lifting circle" },
  { key: "friends", label: "Friends", hint: "A private group of friends" },
  { key: "college", label: "College club", hint: "Campus org or team" },
  { key: "creator", label: "Creator", hint: "Your audience and fans" },
  { key: "brand", label: "Brand/organization", hint: "A company or organization" },
  { key: "fun", label: "Just for fun", hint: "Anything goes" }
];
