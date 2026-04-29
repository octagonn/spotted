import type { FeedPost, FriendPresence, FriendSuggestion, Gym, Profile, Streak, ViewerPreview } from "@/types/domain";

const now = new Date().toISOString();
const expires = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();

export const mockGyms: Gym[] = [
  {
    id: "gym-golds-chelsea",
    name: "Gold's Gym Chelsea",
    address: "250 W 26th St",
    latitude: 40.7472,
    longitude: -73.9935,
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
    bio: "Push day evangelist.",
    home_gym_id: "gym-golds-chelsea",
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
    home_gym_id: "gym-golds-chelsea",
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
    home_gym_id: "gym-golds-chelsea",
    schedule_visibility: "friends",
    ghost_mode: false,
    discoverable: true,
    gym_score: 680,
    timezone: "America/New_York",
    arrival_notifs_enabled: true,
    subscription_tier: "free",
    subscription_expires_at: null,
    premium_since: null,
    created_at: now,
    updated_at: now
  }
];

export const mockFeed: FeedPost[] = [
  {
    id: "post-mia-1",
    user_id: "user-mia",
    media_url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=900&h=1125&fit=crop",
    media_type: "image",
    caption: "Legs first. Excuses last.",
    gym_id: "gym-golds-chelsea",
    is_verified_at_gym: true,
    expires_at: expires,
    saved: false,
    created_at: now,
    updated_at: now,
    profile: mockProfiles[1],
    gym: mockGyms[0],
    viewer_count: 23
  },
  {
    id: "post-dre-1",
    user_id: "user-dre",
    media_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=1125&fit=crop",
    media_type: "image",
    caption: "Back day. Nobody talk to me.",
    gym_id: "gym-golds-chelsea",
    is_verified_at_gym: true,
    expires_at: expires,
    saved: false,
    created_at: now,
    updated_at: now,
    profile: mockProfiles[2],
    gym: mockGyms[0],
    viewer_count: 17
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
    id: "user-aria",
    username: "ariapush",
    display_name: "Aria",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    mutual_friends_count: 4
  },
  {
    id: "user-jules",
    username: "julescore",
    display_name: "Jules",
    avatar_url: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=240&h=240&fit=crop",
    mutual_friends_count: 2
  }
];

export const mockViewersFree: ViewerPreview = {
  tier: "free",
  total_count: 23,
  viewers: mockProfiles.slice(0, 3).map((profile) => ({ avatar_blurred_url: profile.avatar_blurred_url }))
};

export const mockViewersPlus: ViewerPreview = {
  tier: "plus",
  total_count: 3,
  viewers: mockProfiles
};
