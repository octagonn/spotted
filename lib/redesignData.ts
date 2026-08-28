/**
 * Mock fixtures for the UI-phase redesign. Copy comes from design/REDESIGN-SPEC.md —
 * do not reword strings here; screens must match the spec 1:1.
 */

import type {
  Achievement,
  BestLift,
  Community,
  FindPerson,
  InboxThread,
  LiveFriend,
  RedesignGym,
  Trophy,
  WeeklyChallenge
} from "@/types/redesign";

/** The signed-in user's mapped gym (§8.1). */
export const MY_GYM = "Gold's Gym Chelsea";

/** Live "Spot me" strip (§4.5). Live friends open the spot sheet; others open their profile. */
export const LIVE_FRIENDS: LiveFriend[] = [
  { id: "lf-mia", name: "Mia", handle: "mia_lifts", live: true, note: "Push day · 25 min in", gym: "Gold's Gym Chelsea" },
  { id: "lf-jordan", name: "Jordan", handle: "jordanreps", live: true, note: "Just checked in", gym: "Gold's Gym Chelsea" },
  { id: "lf-alex", name: "Alex", handle: "alexbench", live: false },
  { id: "lf-sam", name: "Sam", handle: "sam_deload", live: false },
  { id: "lf-dana", name: "Dana", handle: "dana_pulls", live: false }
];

/** Inbox threads (§5.1) — exact preview copy from the spec. */
export const INBOX_THREADS: InboxThread[] = [
  {
    id: "th-mia",
    kind: "dm",
    name: "Mia Chen",
    avatarNames: ["Mia Chen"],
    preview: "You hitting Gold's at 6?",
    time: "12m",
    unread: true
  },
  {
    id: "th-legday",
    kind: "group",
    name: "Leg Day Crew",
    membersLine: "Jordan, Sam, You",
    avatarNames: ["Jordan Ellis", "Sam Rivera"],
    preview: "Jordan: squats then we eat",
    time: "40m",
    unread: true
  },
  {
    id: "th-alex",
    kind: "dm",
    name: "Alex Moore",
    avatarNames: ["Alex Moore"],
    preview: "That bench PR was clean",
    time: "2h",
    unread: false
  },
  {
    id: "th-5am",
    kind: "group",
    name: "5AM Club",
    membersLine: "Octavio, Mia, +3",
    avatarNames: ["Octavio Reyes", "Mia Chen"],
    preview: "Octavio: doors at 4:55, no excuses",
    time: "6h",
    unread: false
  },
  {
    id: "th-sam",
    kind: "dm",
    name: "Sam Rivera",
    avatarNames: ["Sam Rivera"],
    preview: "Sent you the deload plan",
    time: "1d",
    unread: false
  }
];

/** Find Friends rows (§5.3) — section + note copy from the spec; states cover the machine. */
export const FIND_PEOPLE: FindPerson[] = [
  { id: "fp-dana", name: "Dana Cole", handle: "dana_pulls", note: "3 mutual friends", section: "mutual", state: "incoming" },
  { id: "fp-chris", name: "Chris Park", handle: "chrisgrinds", note: "1 mutual friend", section: "mutual", state: "none" },
  { id: "fp-lena", name: "Lena Ortiz", handle: "lena_lifts", note: "1.8 mi · Equinox Bryant Park", section: "nearby", state: "none" },
  { id: "fp-marcus", name: "Marcus Webb", handle: "webbgetsit", note: "2.6 mi · Crunch Fulton", section: "nearby", state: "requested" },
  { id: "fp-priya", name: "Priya Shah", handle: "priyapower", note: "Popular near Brooklyn", section: "suggested", state: "following" },
  { id: "fp-tom", name: "Tom Nguyen", handle: "tomtrains", note: "From your contacts", section: "contacts", state: "none" }
];

/** Section labels for Find Friends, in render order (§5.3). */
export const FIND_SECTION_LABELS: Record<FindPerson["section"], string> = {
  mutual: "Mutual friends",
  nearby: "Nearby",
  suggested: "Suggested",
  contacts: "From your contacts"
};

/** Communities list (§7.1) — activity lines are exact spec copy. */
export const COMMUNITIES: Community[] = [
  {
    id: "cm-golds",
    name: "Gold's Gym Chelsea",
    type: "gym",
    icon: "dumbbell",
    members: 812,
    todayCount: 23,
    activity: "Dana posted a deadlift PR · 34m",
    address: "212 W 23rd St"
  },
  {
    id: "cm-legday",
    name: "Leg Day Crew",
    type: "friends",
    icon: "users",
    members: 4,
    todayCount: 3,
    activity: "Jordan: squats then we eat · 40m"
  },
  {
    id: "cm-college",
    name: "Brooklyn College Barbell",
    type: "college",
    icon: "school",
    members: 156,
    todayCount: 12,
    activity: "Fresh posts rolling in"
  },
  {
    id: "cm-5am",
    name: "5AM Club",
    type: "custom",
    icon: "sun",
    members: 9,
    todayCount: 5,
    activity: "Octavio opened the chat · 6h"
  }
];

export const MAP_GYMS: RedesignGym[] = [
  {
    id: "golds",
    communityId: "cm-golds",
    name: "Gold's Gym Chelsea",
    address: "270 W 17th St \u00b7 Chelsea",
    members: 284,
    latitude: 40.7429,
    longitude: -74.0007,
    nearby: true,
    friends: ["Mia", "Jordan"],
    hereNow: [
      { id: "mia", name: "Mia Torres", handle: "mia.lifts", note: "Push day \u00b7 here 25 min" },
      { id: "jordan", name: "Jordan Price", handle: "jordan_p", note: "Just checked in" }
    ]
  },
  {
    id: "equinox",
    communityId: "cm-gym-equinox",
    name: "Equinox Bryant Park",
    address: "129 W 41st St \u00b7 Midtown",
    members: 412,
    latitude: 40.7547,
    longitude: -73.9853,
    friends: ["Alex"],
    hereNow: [{ id: "alex", name: "Alex Chen", handle: "alex.gym", note: "Pull day \u00b7 here 40 min" }]
  },
  {
    id: "crunch",
    communityId: "cm-gym-crunch",
    name: "Crunch Fulton",
    address: "100 Fulton St \u00b7 FiDi",
    members: 196,
    latitude: 40.7097,
    longitude: -74.0065,
    friends: ["Sam"],
    hereNow: []
  },
  {
    id: "blink",
    communityId: "cm-gym-blink",
    name: "Blink Nostrand",
    address: "932 Nostrand Ave \u00b7 Crown Heights",
    members: 151,
    latitude: 40.6697,
    longitude: -73.9505,
    friends: [],
    hereNow: []
  }
];

/** Weekly gym-vs-gym challenge (§7.5) — numbers and copy are exact. */
export const WEEKLY_CHALLENGE: WeeklyChallenge = {
  id: "wc-1",
  tag: "◎ GYM VS GYM · WEEKLY CHECK-INS",
  teamA: { name: "GOLD'S CHELSEA", checkIns: 214 },
  teamB: { name: "EQUINOX BP", checkIns: 158 },
  endsIn: "ends in 2d 14h",
  contributorsLabel: "TOP CONTRIBUTORS — GOLD'S",
  topContributors: [
    { position: 1, name: "Dana Cole", handle: "dana_pulls", value: "16", unit: "this wk" },
    { position: 2, name: "Mia Chen", handle: "mia_lifts", value: "14", unit: "this wk" },
    { position: 3, name: "Jordan Ellis", handle: "jordanreps", value: "11", unit: "this wk" },
    { position: 4, name: "You", handle: "you", value: "8", unit: "this wk", you: true }
  ],
  cta: "◎ Check in at Gold's — count me in"
};

/** Trophies (§8.3) — exact names, categories and meta. Max two pinned. */
export const TROPHIES: Trophy[] = [
  {
    id: "tr-405",
    name: "405 Club — Deadlift",
    category: "Lifting",
    meta: "Verified by max-lift video",
    pinned: true,
    proofKind: "max-lift video",
    proofId: "ach-deadlift-405"
  },
  {
    id: "tr-streak30",
    name: "30-Day Streak",
    category: "Streak",
    meta: "30 daily posts in a row",
    pinned: true,
    proofKind: "achievement post",
    proofId: "ach-streak-30"
  },
  {
    id: "tr-225",
    name: "225 Club — Bench",
    category: "Lifting",
    meta: "Verified by max-lift video",
    proofKind: "max-lift video",
    proofId: "ach-bench-225"
  },
  {
    id: "tr-top5",
    name: "Gold's Top 5 — Squat",
    category: "Community",
    meta: "Ranked #4 at Gold's Chelsea",
    proofKind: "max-lift video",
    proofId: "ach-squat-315"
  },
  {
    id: "tr-squad",
    name: "Squad of 25",
    category: "Friends",
    meta: "25 mutual friends",
    proofKind: "daily post"
  }
];

/** Videos panel cards (§8.5) — dates from the spec: Jun 28, Jun 12, May 30, May 18. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: "ach-deadlift-405", kind: "maxlift", tag: "MAX LIFT", line: "Deadlift · 405 lb", date: "Jun 28", video: true, duration: "0:42" },
  { id: "ach-bench-225", kind: "maxlift", tag: "MAX LIFT", line: "Bench press · 225 lb", date: "Jun 12", video: true, duration: "0:31" },
  { id: "ach-streak-30", kind: "achievement", tag: "ACHIEVEMENT", line: "30-Day Streak", date: "May 30", video: false },
  { id: "ach-squat-315", kind: "maxlift", tag: "MAX LIFT", line: "Squat · 315 lb", date: "May 18", video: true, duration: "0:38" }
];

/** Best lifts on the Stats panel (§8.2) — rows Bench press / Squat / Deadlift. */
export const BEST_LIFTS: BestLift[] = [
  { id: "bl-bench", lift: "Bench press", value: "245 lb", rank: "Ranked #2 at Gold's Chelsea" },
  { id: "bl-squat", lift: "Squat", value: "315 lb", rank: "Ranked #4 at Gold's Chelsea" },
  { id: "bl-deadlift", lift: "Deadlift", value: "405 lb", rank: "Ranked #1 at Gold's Chelsea" }
];

/** Profile headline numbers (§8.1/§8.2). */
export const PROFILE_STATS = {
  friends: 48,
  following: 112,
  streakDays: 34,
  dailyPosts: 86,
  verifiedPrs: 3,
  /** Community standing row (§8.2): "Streak rank — Gold's Gym Chelsea leaderboard — #3". */
  streakRank: "#3"
} as const;

/* ================================================================
   HOME AGENT BLOCK — feed post fixtures (spec §4, copy from
   design/redesign.html FRIEND_POSTS / PUBLIC_POSTS verbatim).
   Do not edit outside this block; other agents append below/above.
   ================================================================ */

/** Simulated-photo scene gradients (mockup `.ph s1–s6`) — placeholders for real media. */
export type FeedScene = "s1" | "s2" | "s3" | "s4" | "s5" | "s6";

/** Post media kinds (§4.3). */
export type FeedPostKind = "fb" | "pr" | "streak" | "video" | "lift" | "compare";

export type FeedCtxIcon = "pin" | "users" | "flame";

export type FeedMockComment = {
  id: string;
  /** Commenter display name (drives avatar initial/gradient). */
  name: string;
  /** Handle without the `@`, bolded before the text. `you` for own comments. */
  handle: string;
  text: string;
  time: string;
};

export type FeedMockReactor = {
  /** Reactor name — initial shows over the mock selfie scene. */
  name: string;
  scene: FeedScene;
};

export type FeedMockPost = {
  id: string;
  kind: FeedPostKind;
  user: { name: string; handle: string; avatarUrl?: string | null };
  /** Mapped gym name; when absent, `altLoc` renders the italic unmapped line. */
  gym?: string;
  altLoc?: string;
  time: string;
  /** Scene placeholders for mock media; real posts use `mediaUri`/`insetUri`. */
  /** Post author's user id (real posts) — powers report/block targeting. */
  authorId?: string;
  main?: FeedScene;
  inset?: FeedScene;
  mediaUri?: string;
  insetUri?: string;
  /** Owner-only: this post is hidden pending moderation review. */
  underReview?: boolean;
  /** Multi-photo carousel (real posts): signed URLs, first = cover. */
  mediaUris?: string[];
  /** Real video post: signed URL + soft-trim window (seconds). posterUrl is
   *  the signed thumbnail painted while the stream buffers. */
  video?: { uri: string; trimStart: number; trimEnd: number; posterUrl?: string | null };
  /** Milestone plate (kinds pr/streak). */
  plate?: { tag: string; big: string; unit: string };
  /** Video chips top-left, e.g. ["PR", "Form check"]. */
  chips?: string[];
  duration?: string;
  /** Max-lift stat pill (kind lift): trophy glyph + {lift} + {weight}. */
  lift?: { lift: string; weight: string };
  /** Before/after compare (kind compare). */
  cmp?: { left: string; right: string; beforeScene: FeedScene; afterScene: FeedScene };
  caption?: string;
  /** Attached song (real posts): metadata + Apple 30s preview clip. */
  music?: { title: string; artist: string; artworkUrl?: string | null; previewUrl?: string | null; clipStart?: number };
  /** Public-feed context chips (§4.2). `handle` makes a chip tap-to-profile. */
  ctx?: { icon: FeedCtxIcon; label: string; handle?: string }[];
  /** Tagged friends — rendered as tappable chips that open each profile. */
  taggedFriends?: { handle: string; name: string }[];
  /** Positional photo tags (M1) — overlaid on the media at normalized coords. */
  photoTags?: { username: string; x: number; y: number }[];
  /** Username whose taunt this post answered ("Answered the Call" tag). */
  answeredCall?: string | null;
  /** Workouts attached to this daily post — rendered as extra swipe slides. */
  workouts?: import("@/components/post/WorkoutSlideCard").FeedWorkout[];
  reactions: FeedMockReactor[];
  comments: FeedMockComment[];
};

/** The signed-in mock user (mockup `ME`) — own reaction chip + comment identity. */
export const FEED_ME = { name: "Riley Park", handle: "rileymax", scene: "s2" as FeedScene };

/** Friends-feed posts (§4.1) — relatable milestones lead, aspirational video lives lower. */
export const FRIEND_POSTS: FeedMockPost[] = [
  {
    id: "fp0",
    kind: "pr",
    user: { name: "Octavio Reyes", handle: "octavio" },
    gym: "Gold's Gym Chelsea",
    time: "11m",
    plate: { tag: "New PR — Bench", big: "275", unit: "LB" },
    caption: "Stuck at 265 for six weeks. Just kept showing up.",
    reactions: [
      { name: "Mia Torres", scene: "s5" },
      { name: "Jordan Price", scene: "s3" }
    ],
    comments: [
      { id: "fp0-c1", name: "Jordan Price", handle: "jordan_p", text: "Called it last week 👊", time: "6m" }
    ]
  },
  {
    id: "fp1",
    kind: "fb",
    user: { name: "Mia Torres", handle: "mia.lifts" },
    gym: "Gold's Gym Chelsea",
    time: "21m",
    main: "s2",
    inset: "s5",
    caption: "Pull day. Grip gave out before my back did.",
    reactions: [
      { name: "Jordan Price", scene: "s3" },
      { name: "Alex Chen", scene: "s3" },
      { name: "Sam Okafor", scene: "s3" }
    ],
    comments: [
      { id: "fp1-c1", name: "Jordan Price", handle: "jordan_p", text: "That bar speed tho", time: "18m" },
      { id: "fp1-c2", name: "Alex Chen", handle: "alex.gym", text: "Straps exist for a reason 😤", time: "12m" }
    ]
  },
  {
    id: "fp5",
    kind: "streak",
    user: { name: "Sam Okafor", handle: "samxlifts" },
    gym: "Crunch Fulton",
    time: "48m",
    plate: { tag: "Streak milestone", big: "30", unit: "DAYS" },
    caption: "30 days straight. No crazy numbers — just didn't miss.",
    reactions: [
      { name: "Mia Torres", scene: "s5" },
      { name: "Alex Chen", scene: "s3" },
      { name: "Jordan Price", scene: "s3" }
    ],
    comments: [
      { id: "fp5-c1", name: "Alex Chen", handle: "alex.gym", text: "This is the real flex", time: "30m" }
    ]
  },
  {
    id: "fp2",
    kind: "fb",
    user: { name: "Alex Chen", handle: "alex.gym" },
    gym: "Equinox Bryant Park",
    time: "1h",
    main: "s3",
    inset: "s6",
    caption: "Bench felt heavy. Showed up anyway.",
    reactions: [{ name: "Mia Torres", scene: "s5" }],
    comments: [
      { id: "fp2-c1", name: "Sam Okafor", handle: "samxlifts", text: "Showing up is the whole job", time: "44m" }
    ]
  },
  {
    id: "fp3",
    kind: "fb",
    user: { name: "Jordan Price", handle: "jordan_p" },
    altLoc: "Home gym",
    time: "2h",
    main: "s4",
    inset: "s1",
    caption: "Garage session. Squat rack finally assembled.",
    reactions: [
      { name: "Mia Torres", scene: "s5" },
      { name: "Octavio Reyes", scene: "s3" }
    ],
    comments: []
  },
  {
    id: "fp4",
    kind: "fb",
    user: { name: "Sam Okafor", handle: "samxlifts" },
    gym: "Crunch Fulton",
    time: "4h",
    main: "s5",
    inset: "s3",
    caption: "Zone 2 and a podcast. Recovery counts.",
    reactions: [
      { name: "Alex Chen", scene: "s3" },
      { name: "Jordan Price", scene: "s3" }
    ],
    comments: [
      { id: "fp4-c1", name: "Mia Torres", handle: "mia.lifts", text: "The discipline post", time: "3h" }
    ]
  },
  {
    id: "fp6",
    kind: "video",
    user: { name: "Jordan Price", handle: "jordan_p" },
    gym: "Gold's Gym Chelsea",
    time: "5h",
    main: "s6",
    duration: "0:42",
    chips: ["PR", "Form check"],
    caption: "405 pull, third attempt angle. Lower back — tell me the truth.",
    reactions: [
      { name: "Mia Torres", scene: "s5" },
      { name: "Sam Okafor", scene: "s3" },
      { name: "Octavio Reyes", scene: "s3" }
    ],
    comments: [
      { id: "fp6-c1", name: "Sam Okafor", handle: "samxlifts", text: "Hips shot up a touch off the floor", time: "4h" },
      { id: "fp6-c2", name: "Octavio Reyes", handle: "octavio", text: "Lockout was clean tho", time: "3h" }
    ]
  }
];

/** Public-feed posts (§4.1) — ordering demonstrates proximity + mutuals + traction. */
export const PUBLIC_POSTS: FeedMockPost[] = [
  {
    id: "pp1",
    kind: "fb",
    user: { name: "Dana Whitfield", handle: "dana.dl" },
    gym: "Gold's Gym Chelsea",
    time: "34m",
    main: "s6",
    inset: "s2",
    caption: "Deadlift day at the usual spot.",
    ctx: [
      { icon: "pin", label: "0.4 mi · your gym" },
      { icon: "users", label: "3 mutual friends" },
      { icon: "flame", label: "38 reactions today" }
    ],
    reactions: [
      { name: "Mia Torres", scene: "s5" },
      { name: "Jordan Price", scene: "s3" },
      { name: "Octavio Reyes", scene: "s3" },
      { name: "Priya Nair", scene: "s5" }
    ],
    comments: [
      { id: "pp1-c1", name: "Priya Nair", handle: "priya.pr", text: "Casual 315 warmup", time: "20m" }
    ]
  },
  {
    id: "pp2",
    kind: "video",
    user: { name: "Marcus Hale", handle: "marc.presses" },
    gym: "Blink Nostrand",
    time: "1h",
    main: "s1",
    duration: "0:31",
    chips: ["Form check"],
    caption: "Paused reps only. No bounce, no ego. Notes welcome.",
    ctx: [
      { icon: "users", label: "1 mutual friend" },
      { icon: "flame", label: "Rising in Brooklyn" }
    ],
    reactions: [
      { name: "Sam Okafor", scene: "s3" },
      { name: "Theo Marsh", scene: "s3" }
    ],
    comments: []
  },
  {
    id: "pp3",
    kind: "compare",
    user: { name: "Lena Vogt", handle: "lena.lifts" },
    gym: "Equinox Bryant Park",
    time: "2h",
    cmp: { left: "JAN", right: "JUL", beforeScene: "s4", afterScene: "s5" },
    caption: "Six months between these two. Drag the slider.",
    ctx: [
      { icon: "pin", label: "1.8 mi away" },
      { icon: "flame", label: "112 reactions today" }
    ],
    reactions: [
      { name: "Alex Chen", scene: "s3" },
      { name: "Dana Whitfield", scene: "s5" },
      { name: "Marcus Hale", scene: "s3" }
    ],
    comments: [
      { id: "pp3-c1", name: "Dana Whitfield", handle: "dana.dl", text: "Consistency looks good on you", time: "1h" }
    ]
  },
  {
    id: "pp4",
    kind: "fb",
    user: { name: "Theo Marsh", handle: "theo.trains" },
    altLoc: "Unlisted location",
    time: "3h",
    main: "s2",
    inset: "s5",
    caption: "Hill sprints somewhere in Queens.",
    ctx: [
      { icon: "users", label: "1 mutual friend" },
      { icon: "pin", label: "Nearby" }
    ],
    reactions: [{ name: "Alex Chen", scene: "s3" }],
    comments: []
  }
];

/** Scene gradient stops (mockup `.s1–.s6`) shared by feed media placeholders. */
export const FEED_SCENES: Record<FeedScene, { colors: [string, string, string]; angle: number }> = {
  s1: { colors: ["#2E2E33", "#17171A", "#26262B"], angle: 155 },
  s2: { colors: ["#3A3A41", "#1C1C1F", "#101012"], angle: 200 },
  s3: { colors: ["#222227", "#35353C", "#131315"], angle: 120 },
  s4: { colors: ["#17171A", "#2A2A30", "#1A1A1D"], angle: 170 },
  s5: { colors: ["#40404A", "#202024", "#2C2C31"], angle: 140 },
  s6: { colors: ["#26262B", "#111113", "#222227"], angle: 195 }
};

/* ============================ END HOME AGENT BLOCK ============================ */
