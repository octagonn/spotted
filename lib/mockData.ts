import type {
  DailyPrompt,
  FeedPost,
  FriendPresence,
  FriendSuggestion,
  Gym,
  PermanentDrop,
  Profile,
  ProfileSignal,
  RoutineItem,
  StoryReply,
  Streak,
  ViewerPreview
} from "@/types/domain";

const now = new Date().toISOString();
const expires = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();

export const mockGyms: Gym[] = [
  {
    id: "gym-eos-ladera",
    name: "EOS Ladera",
    address: "Ladera Heights",
    latitude: 33.9958,
    longitude: -118.3656,
    geofence_radius_meters: 85,
    created_at: now
  },
  {
    id: "gym-ironworks",
    name: "Ironworks NoHo",
    address: "28 Cooper Sq",
    latitude: 40.7289,
    longitude: -73.9914,
    geofence_radius_meters: 75,
    created_at: now
  }
];

export const mockProfiles: Profile[] = [
  {
    id: "user-octavio",
    username: "octavio",
    display_name: "Octavio",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240&h=240&fit=crop",
    avatar_blurred_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240&h=240&fit=crop&blur=80",
    bio: "Arnold split. 5 PM unless life gets disrespectful.",
    home_gym_id: "gym-eos-ladera",
    schedule_visibility: "friends",
    ghost_mode: false,
    discoverable: true,
    gym_score: 740,
    timezone: "America/Los_Angeles",
    arrival_notifs_enabled: true,
    subscription_tier: "free",
    subscription_expires_at: null,
    premium_since: null,
    created_at: now,
    updated_at: now
  },
  {
    id: "user-mia",
    username: "miafit",
    display_name: "Mia",
    avatar_url: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=240&h=240&fit=crop",
    avatar_blurred_url: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=240&h=240&fit=crop&blur=80",
    bio: "Leg day twice. Complaints never.",
    home_gym_id: "gym-eos-ladera",
    schedule_visibility: "public",
    ghost_mode: false,
    discoverable: true,
    gym_score: 910,
    timezone: "America/Los_Angeles",
    arrival_notifs_enabled: true,
    subscription_tier: "plus",
    subscription_expires_at: expires,
    premium_since: now,
    created_at: now,
    updated_at: now
  },
  {
    id: "user-dre",
    username: "drepulls",
    display_name: "Dre",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
    avatar_blurred_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop&blur=80",
    bio: "Deadlift accountant.",
    home_gym_id: "gym-eos-ladera",
    schedule_visibility: "friends",
    ghost_mode: false,
    discoverable: true,
    gym_score: 680,
    timezone: "America/Los_Angeles",
    arrival_notifs_enabled: true,
    subscription_tier: "free",
    subscription_expires_at: null,
    premium_since: null,
    created_at: now,
    updated_at: now
  },
  {
    id: "user-aria",
    username: "ariapush",
    display_name: "Aria",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    avatar_blurred_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop&blur=80",
    bio: "Chest, shoulders, and disappearing after cardio.",
    home_gym_id: "gym-eos-ladera",
    schedule_visibility: "public",
    ghost_mode: false,
    discoverable: true,
    gym_score: 820,
    timezone: "America/Los_Angeles",
    arrival_notifs_enabled: true,
    subscription_tier: "free",
    subscription_expires_at: null,
    premium_since: null,
    created_at: now,
    updated_at: now
  },
  {
    id: "user-jules",
    username: "julescore",
    display_name: "Jules",
    avatar_url: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=240&h=240&fit=crop",
    avatar_blurred_url: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=240&h=240&fit=crop&blur=80",
    bio: "Core, cardio, then pretending it was easy.",
    home_gym_id: "gym-eos-ladera",
    schedule_visibility: "friends",
    ghost_mode: false,
    discoverable: true,
    gym_score: 590,
    timezone: "America/Los_Angeles",
    arrival_notifs_enabled: true,
    subscription_tier: "free",
    subscription_expires_at: null,
    premium_since: null,
    created_at: now,
    updated_at: now
  }
];

export const mockDailyPrompt: DailyPrompt = {
  title: "DROP TODAY'S LIFT",
  body: "Progress pic, mirror check, sweaty proof. It disappears tomorrow.",
  window: "OPEN UNTIL MIDNIGHT",
  posted: false,
  friend_posted_count: 2,
  friend_skipped_count: 1
};

export const mockFeed: FeedPost[] = [
  {
    id: "post-mia-1",
    user_id: "user-mia",
    media_url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=900&h=1125&fit=crop",
    media_type: "image",
    caption: "Legs first. Excuses last.",
    gym_id: "gym-eos-ladera",
    is_verified_at_gym: true,
    expires_at: expires,
    saved: false,
    created_at: now,
    updated_at: now,
    profile: mockProfiles[1],
    gym: mockGyms[0],
    viewer_count: 23,
    replay_count: 4,
    reply_count: 6,
    music_title: "No Hands",
    music_artist: "Waka Flocka Flame",
    is_daily_drop: true,
    permanent: false
  },
  {
    id: "post-dre-1",
    user_id: "user-dre",
    media_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=1125&fit=crop",
    media_type: "image",
    caption: "Back day. Nobody talk to me.",
    gym_id: "gym-eos-ladera",
    is_verified_at_gym: true,
    expires_at: expires,
    saved: false,
    created_at: now,
    updated_at: now,
    profile: mockProfiles[2],
    gym: mockGyms[0],
    viewer_count: 17,
    replay_count: 2,
    reply_count: 3,
    music_title: "Dreams and Nightmares",
    music_artist: "Meek Mill",
    is_daily_drop: true,
    permanent: false
  }
];

export const mockStreak: Streak = {
  user_id: "user-octavio",
  current_streak: 14,
  longest_streak: 22,
  last_checkin_date: new Date().toISOString().slice(0, 10),
  freeze_tokens: 1
};

export const mockFriendPresence: FriendPresence[] = [
  {
    id: "presence-mia",
    profile: mockProfiles[1],
    gym: mockGyms[0],
    checked_in_at: now
  },
  {
    id: "presence-dre",
    profile: mockProfiles[2],
    gym: mockGyms[0],
    checked_in_at: now
  }
];

export const mockSuggestions: FriendSuggestion[] = [
  {
    id: mockProfiles[3].id,
    username: mockProfiles[3].username,
    display_name: mockProfiles[3].display_name,
    avatar_url: mockProfiles[3].avatar_url,
    mutual_friends_count: 4
  },
  {
    id: mockProfiles[4].id,
    username: mockProfiles[4].username,
    display_name: mockProfiles[4].display_name,
    avatar_url: mockProfiles[4].avatar_url,
    mutual_friends_count: 2
  }
];

export const mockRoutine: RoutineItem[] = [
  { day: "MON", muscle: "Chest + Back", time: "5:00 PM" },
  { day: "TUE", muscle: "Shoulders + Arms", time: "5:00 PM" },
  { day: "WED", muscle: "Legs", time: "6:00 PM" },
  { day: "THU", muscle: "Chest + Back", time: "5:00 PM" },
  { day: "FRI", muscle: "Shoulders + Arms", time: "5:00 PM" },
  { day: "SAT", muscle: "Cardio + Core", time: "10:00 AM" },
  { day: "SUN", muscle: "Rest", time: "OFF" }
];

export const mockProfileSignals: ProfileSignal[] = [
  { label: "PROFILE VIEWS", value: "12", detail: "3 new since your last drop" },
  { label: "STORY REPLAYS", value: "6", detail: "Mia replayed twice" },
  { label: "ROUTINE SAVES", value: "4", detail: "People studying the split" }
];

export const mockStoryReplies: StoryReply[] = [
  {
    id: "reply-mia-1",
    from: mockProfiles[1],
    post_id: "post-self-preview",
    preview: "that lighting is insane",
    unread: true,
    sent_at: now
  },
  {
    id: "reply-dre-1",
    from: mockProfiles[2],
    post_id: "post-self-preview",
    preview: "you actually showed up for legs",
    unread: false,
    sent_at: now
  }
];

export const mockPermanentDrops: PermanentDrop[] = [
  {
    id: "highlight-1",
    media_url: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=640&h=800&fit=crop",
    label: "START",
    saved_at: now
  },
  {
    id: "highlight-2",
    media_url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=640&h=800&fit=crop",
    label: "CUT",
    saved_at: now
  }
];

export const mockSkipSignals = [
  {
    id: "skip-1",
    display_name: "Jules",
    muscle: "pull",
    body: "Jules missed pull day yesterday. Quiet, but everybody saw it."
  }
] as const;

export const mockViewersFree: ViewerPreview = {
  tier: "free",
  total_count: 23,
  viewers: mockProfiles.slice(0, 3).map((profile) => ({ avatar_blurred_url: profile.avatar_blurred_url }))
};

export const mockViewersPlus: ViewerPreview = {
  tier: "plus",
  total_count: 3,
  viewers: mockProfiles.slice(0, 3)
};
