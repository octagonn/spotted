import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Gym = Database["public"]["Tables"]["gyms"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Checkin = Database["public"]["Tables"]["checkins"]["Row"];
export type Streak = Database["public"]["Tables"]["streaks"]["Row"];
export type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Arms"
  | "Legs"
  | "Core"
  | "Push"
  | "Pull"
  | "Cardio"
  | "Rest";

export type FeedPost = Post & {
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "avatar_blurred_url">;
  gym: Pick<Gym, "id" | "name" | "latitude" | "longitude"> | null;
  viewer_count: number;
};

export type FriendSuggestion = Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> & {
  mutual_friends_count: number;
};

export type FriendPresence = {
  id: string;
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  gym: Pick<Gym, "id" | "name" | "latitude" | "longitude">;
  checked_in_at: string;
};

export type ViewerPreview =
  | {
      tier: "free";
      total_count: number;
      viewers: { avatar_blurred_url: string | null }[];
    }
  | {
      tier: "plus";
      total_count: number;
      viewers: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">[];
    };
