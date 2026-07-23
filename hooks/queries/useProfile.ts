import { useQuery } from "@tanstack/react-query";

import { mockFeed, mockGyms, mockPermanentDrops, mockProfiles, mockRoutine, mockStreak } from "@/lib/mockData";
import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Gym, PermanentDrop, Post, Profile, RoutineItem, Streak } from "@/types/domain";

export type ProfileWithGym = Profile & { gym: Gym | null };

const PROFILE_WITH_GYM_SELECT = "*, gym:home_gym_id(*)";

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type ScheduleRow = {
  day_of_week: number;
  muscle_groups: string[];
  start_time: string | null;
};

function formatStartTime(time: string | null): string {
  if (!time) {
    return "—";
  }
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? "0");
  if (Number.isNaN(hour)) {
    return "—";
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function rowsToRoutine(rows: ScheduleRow[]): RoutineItem[] {
  const items: RoutineItem[] = [];
  for (const dayIndex of DAY_ORDER) {
    const row = rows.find((item) => item.day_of_week === dayIndex);
    if (!row) {
      continue;
    }
    const muscle = row.muscle_groups.length > 0 ? row.muscle_groups.join(" + ") : "Rest";
    const isRest = muscle.toLowerCase() === "rest";
    items.push({
      day: DAY_LABELS[dayIndex],
      muscle,
      time: isRest ? "OFF" : formatStartTime(row.start_time)
    });
  }
  return items;
}

export function useMyProfile() {
  const profileId = useAuthStore((state) => state.profileId);
  return useQuery({
    queryKey: ["profile", "me", profileId],
    enabled: !isSupabaseConfigured || Boolean(profileId),
    queryFn: async (): Promise<ProfileWithGym | null> => {
      if (!isSupabaseConfigured) {
        return { ...mockProfiles[0], gym: mockGyms[0] };
      }
      if (!profileId) {
        return null;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_WITH_GYM_SELECT)
        .eq("id", profileId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return (data as unknown as ProfileWithGym | null) ?? null;
    }
  });
}

export function useProfileByUsername(username?: string) {
  return useQuery({
    queryKey: ["profile", "username", username],
    enabled: Boolean(username),
    queryFn: async (): Promise<ProfileWithGym | null> => {
      if (!username) {
        return null;
      }
      if (!isSupabaseConfigured) {
        const profile = mockProfiles.find((item) => item.username === username);
        return profile ? { ...profile, gym: mockGyms[0] } : null;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_WITH_GYM_SELECT)
        .eq("username", username)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return (data as unknown as ProfileWithGym | null) ?? null;
    }
  });
}

export function useProfileById(profileId?: string) {
  return useQuery({
    queryKey: ["profile", "id", profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<ProfileWithGym | null> => {
      if (!profileId) {
        return null;
      }
      if (!isSupabaseConfigured) {
        const profile = mockProfiles.find((item) => item.id === profileId) ?? mockProfiles[1];
        return { ...profile, gym: mockGyms[0] };
      }
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_WITH_GYM_SELECT)
        .eq("id", profileId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return (data as unknown as ProfileWithGym | null) ?? null;
    }
  });
}

export function useRoutine(userId?: string | null) {
  return useQuery({
    queryKey: ["routine", userId],
    enabled: !isSupabaseConfigured || Boolean(userId),
    queryFn: async (): Promise<RoutineItem[]> => {
      if (!isSupabaseConfigured) {
        return mockRoutine;
      }
      if (!userId) {
        return [];
      }
      const { data, error } = await supabase
        .from("workout_schedule")
        .select("day_of_week, muscle_groups, start_time")
        .eq("user_id", userId);
      if (error) {
        throw error;
      }
      return rowsToRoutine(data ?? []);
    }
  });
}

export function useUserStreak(userId?: string | null) {
  return useQuery({
    queryKey: ["streak", "user", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Streak | null> => {
      if (!userId) {
        return null;
      }
      if (!isSupabaseConfigured) {
        return mockStreak;
      }
      const { data, error } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ?? null;
    }
  });
}

export type UserPost = Pick<
  Post,
  "id" | "media_url" | "caption" | "created_at" | "saved" | "permanent" | "is_daily_drop" | "media_type"
> & {
  thumbnail_url: string | null;
  /** Carousel photo paths (unsigned) — everything posted that day. */
  media_urls?: string[] | null;
  inset_url?: string | null;
  /** Workouts attached to the daily post — shown as extra archive slides. */
  attached_workouts?: { id: string; name: string; duration_seconds: number; started_at: string; data: unknown }[] | null;
};

export function useUserPosts(userId?: string | null) {
  return useQuery({
    queryKey: ["user-posts", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserPost[]> => {
      if (!userId) {
        return [];
      }
      if (!isSupabaseConfigured) {
        return mockFeed
          .filter((post) => post.user_id === userId)
          .map((post) => ({
            id: post.id,
            media_url: post.media_url,
            caption: post.caption,
            created_at: post.created_at,
            saved: post.saved,
            permanent: post.permanent,
            is_daily_drop: post.is_daily_drop,
            media_type: post.media_type,
            thumbnail_url: null,
            media_urls: post.media_urls ?? null,
            inset_url: null,
            attached_workouts: null
          }));
      }
      // No expiry filter: your own archive keeps history (RLS already hides
      // other users' expired posts).
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, media_url, caption, created_at, saved, permanent, is_daily_drop, media_type, thumbnail_url, media_urls, inset_url, attached_workouts:workouts!workouts_post_id_fkey(id, name, duration_seconds, started_at, data)"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) {
        throw error;
      }
      // Cast: generated types don't know the workouts.post_id FK (same as useFeed).
      const rows = (data ?? []) as unknown as UserPost[];
      return Promise.all(
        rows.map(async (row) => {
          let mediaUrl = row.media_url;
          if (mediaUrl && !mediaUrl.startsWith("http")) {
            try {
              mediaUrl = await signedPostUrl(mediaUrl);
            } catch {
              mediaUrl = row.media_url;
            }
          }
          let thumbnailUrl = row.thumbnail_url;
          if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
            try {
              thumbnailUrl = await signedPostUrl(thumbnailUrl);
            } catch {
              thumbnailUrl = null;
            }
          }
          return { ...row, media_url: mediaUrl, thumbnail_url: thumbnailUrl };
        })
      );
    }
  });
}

export function useSavedDrops(userId?: string | null) {
  return useQuery({
    queryKey: ["saved-drops", userId],
    enabled: !isSupabaseConfigured || Boolean(userId),
    queryFn: async (): Promise<PermanentDrop[]> => {
      if (!isSupabaseConfigured) {
        return mockPermanentDrops;
      }
      if (!userId) {
        return [];
      }
      const { data, error } = await supabase
        .from("posts")
        .select("id, media_url, caption, created_at")
        .eq("user_id", userId)
        .or("saved.eq.true,permanent.eq.true")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) {
        throw error;
      }
      const rows = data ?? [];
      return Promise.all(
        rows.map(async (row) => {
          let mediaUrl = row.media_url;
          if (mediaUrl && !mediaUrl.startsWith("http")) {
            try {
              mediaUrl = await signedPostUrl(mediaUrl);
            } catch {
              mediaUrl = row.media_url;
            }
          }
          return {
            id: row.id,
            media_url: mediaUrl,
            label: row.caption?.toUpperCase() ?? "SAVED",
            saved_at: row.created_at
          };
        })
      );
    }
  });
}

export type FriendshipStatus =
  | "self"
  | "none"
  | "pending-outgoing"
  | "pending-incoming"
  | "accepted"
  | "blocked";

export function useFriendshipStatus(otherUserId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["friendship-status", userId, otherUserId],
    enabled: Boolean(otherUserId) && (!isSupabaseConfigured || Boolean(userId)),
    queryFn: async (): Promise<FriendshipStatus> => {
      if (!otherUserId) {
        return "none";
      }
      if (userId && userId === otherUserId) {
        return "self";
      }
      if (!isSupabaseConfigured || !userId) {
        return "none";
      }
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(
          `and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`
        )
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        return "none";
      }
      if (data.status === "accepted") {
        return "accepted";
      }
      if (data.status === "blocked") {
        return "blocked";
      }
      return data.user_id === userId ? "pending-outgoing" : "pending-incoming";
    }
  });
}
