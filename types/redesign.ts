/**
 * Types for the UI-phase redesign (design/REDESIGN-SPEC.md).
 * Everything without a backend runs on typed mock data from `lib/redesignData.ts`.
 */

/** Type-pill values on community cards (§7.1). */
export type CommunityType = "gym" | "friends" | "college" | "custom";

export type CommunityIcon = "dumbbell" | "users" | "school" | "sun";

export type Community = {
  id: string;
  name: string;
  type: CommunityType;
  icon: CommunityIcon;
  members: number;
  /** "N today" pill count. */
  todayCount: number;
  /** Activity line, e.g. "Dana posted a deadlift PR · 34m". */
  activity: string;
  /** Mapped-gym address (gym communities only). */
  address?: string;
};

export type RedesignGym = {
  id: string;
  communityId: string;
  name: string;
  address: string;
  members: number;
  latitude: number;
  longitude: number;
  nearby?: boolean;
  friends: string[];
  hereNow: { id: string; name: string; handle: string; note: string }[];
};

export type TrophyCategory = "Lifting" | "Streak" | "Friends" | "Community";

export type TrophyProofKind = "max-lift video" | "achievement post" | "daily post";

export type Trophy = {
  id: string;
  name: string;
  category: TrophyCategory;
  /** Meta line after the category, e.g. "Verified by max-lift video". */
  meta: string;
  pinned?: boolean;
  proofKind: TrophyProofKind;
  /** Achievement id (lib/redesignData ACHIEVEMENTS) proving this trophy, if any. */
  proofId?: string;
};

/** Cards in the profile Videos panel (§8.5): max-lift videos & achievement posts. */
export type Achievement = {
  id: string;
  kind: "maxlift" | "achievement";
  /** Top-left tag: "MAX LIFT" | "ACHIEVEMENT". */
  tag: "MAX LIFT" | "ACHIEVEMENT";
  /** Bottom-left line 1, e.g. "Deadlift · 405 lb". */
  line: string;
  /** Bottom-left line 2, e.g. "Jun 28". */
  date: string;
  video: boolean;
  /** Video duration, e.g. "0:42". */
  duration?: string;
};

/** Live "Spot me" strip items (§4.5). */
export type LiveFriend = {
  id: string;
  name: string;
  handle: string;
  live: boolean;
  /** Spot-sheet sub is "{note} · {gym}", e.g. "Push day · 25 min in". */
  note?: string;
  gym?: string;
};

/** Rank row (§7.2 rankings, §7.5 top contributors). */
export type RankRow = {
  position: number;
  name: string;
  handle: string;
  /** Right-aligned mono value, e.g. "315", "61", "14". */
  value: string;
  /** Small unit after the value, e.g. "lb", "days", "this wk". */
  unit?: string;
  /** Marks the signed-in user — renders "(you)" after the name. */
  you?: boolean;
};

/** Weekly gym-vs-gym challenge (§7.5). */
export type WeeklyChallenge = {
  id: string;
  /** Card tag, e.g. "◎ GYM VS GYM · WEEKLY CHECK-INS". */
  tag: string;
  teamA: { name: string; checkIns: number };
  teamB: { name: string; checkIns: number };
  /** e.g. "ends in 2d 14h". */
  endsIn: string;
  /** Section label, e.g. "TOP CONTRIBUTORS — GOLD'S". */
  contributorsLabel: string;
  topContributors: RankRow[];
  /** Sheet CTA, e.g. "◎ Check in at Gold's — count me in". */
  cta: string;
};

/** Relationship state machine (§5.3). */
export type RelationshipState = "none" | "requested" | "incoming" | "friend" | "following";

export type FindSection = "mutual" | "nearby" | "suggested" | "contacts";

/** Find Friends row (§5.3). */
export type FindPerson = {
  id: string;
  name: string;
  handle: string;
  /** Row sub renders "{handle} · {note}". */
  note: string;
  section: FindSection;
  state: RelationshipState;
};

/** Inbox thread (§5.1). */
export type InboxThread = {
  id: string;
  kind: "dm" | "group";
  /** User full name or group name. */
  name: string;
  /** Group members line for the conversation panel sub, e.g. "Jordan, Sam, You". */
  membersLine?: string;
  /** Names used by the group avatar (two overlapped). */
  avatarNames: string[];
  preview: string;
  time: string;
  unread: boolean;
};

/** Best-lift row on the Stats panel (§8.2). */
export type BestLift = {
  id: string;
  lift: string;
  /** e.g. "245 lb". */
  value: string;
  /** Sub line, e.g. "Ranked #2 at Gold's Chelsea". */
  rank: string;
};
