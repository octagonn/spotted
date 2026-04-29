export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Enums: {
      schedule_visibility: "public" | "friends" | "private";
      friendship_status: "pending" | "accepted" | "blocked";
      notification_type:
        | "friend_request"
        | "friend_accepted"
        | "post_view"
        | "post_reaction"
        | "streak_break_friend"
        | "streak_milestone"
        | "dm"
        | "gym_arrival_friend";
      subscription_tier: "free" | "plus";
    };
    Tables: {
      gyms: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          geofence_radius_meters: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          latitude: number;
          longitude: number;
          geofence_radius_meters?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gyms"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          avatar_blurred_url: string | null;
          bio: string | null;
          home_gym_id: string | null;
          schedule_visibility: Database["public"]["Enums"]["schedule_visibility"];
          ghost_mode: boolean;
          discoverable: boolean;
          gym_score: number;
          timezone: string;
          arrival_notifs_enabled: boolean;
          subscription_tier: Database["public"]["Enums"]["subscription_tier"];
          subscription_expires_at: string | null;
          premium_since: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          avatar_blurred_url?: string | null;
          bio?: string | null;
          home_gym_id?: string | null;
          schedule_visibility?: Database["public"]["Enums"]["schedule_visibility"];
          ghost_mode?: boolean;
          discoverable?: boolean;
          gym_score?: number;
          timezone?: string;
          arrival_notifs_enabled?: boolean;
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"];
          subscription_expires_at?: string | null;
          premium_since?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      workout_schedule: {
        Row: {
          id: string;
          user_id: string;
          day_of_week: number;
          muscle_groups: string[];
          start_time: string | null;
          end_time: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_of_week: number;
          muscle_groups?: string[];
          start_time?: string | null;
          end_time?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_schedule"]["Insert"]>;
        Relationships: [];
      };
      checkins: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          checked_in_at: string;
          checked_out_at: string | null;
          source: "geofence" | "manual" | "post";
          verified: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          checked_in_at?: string;
          checked_out_at?: string | null;
          source?: "geofence" | "manual" | "post";
          verified?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["checkins"]["Insert"]>;
        Relationships: [];
      };
      streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_checkin_date: string | null;
          freeze_tokens: number;
        };
        Insert: {
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_checkin_date?: string | null;
          freeze_tokens?: number;
        };
        Update: Partial<Database["public"]["Tables"]["streaks"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          media_url: string;
          media_type: "image" | "video";
          caption: string | null;
          gym_id: string | null;
          is_verified_at_gym: boolean;
          expires_at: string;
          saved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_url: string;
          media_type: "image" | "video";
          caption?: string | null;
          gym_id?: string | null;
          is_verified_at_gym?: boolean;
          expires_at?: string;
          saved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      friendships: {
        Row: {
          user_id: string;
          friend_id: string;
          status: Database["public"]["Enums"]["friendship_status"];
          created_at: string;
        };
        Insert: {
          user_id: string;
          friend_id: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["friendships"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          participant_a: string;
          participant_b: string;
          last_message_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          participant_a: string;
          participant_b: string;
          last_message_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string | null;
          media_url: string | null;
          sent_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content?: string | null;
          media_url?: string | null;
          sent_at?: string;
          read_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      post_views: {
        Row: {
          post_id: string;
          viewer_id: string;
          viewed_at: string;
        };
        Insert: {
          post_id: string;
          viewer_id: string;
          viewed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_views"]["Insert"]>;
        Relationships: [];
      };
      post_reactions: {
        Row: {
          post_id: string;
          user_id: string;
          reaction: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          reaction: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_reactions"]["Insert"]>;
        Relationships: [];
      };
      skip_events: {
        Row: {
          id: string;
          user_id: string;
          scheduled_date: string;
          muscle_groups_missed: string[];
          notified_friends: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scheduled_date: string;
          muscle_groups_missed?: string[];
          notified_friends?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["skip_events"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          payload: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          payload?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      device_tokens: {
        Row: {
          user_id: string;
          device_token: string;
          platform: "ios";
          updated_at: string;
        };
        Insert: {
          user_id: string;
          device_token: string;
          platform: "ios";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["device_tokens"]["Insert"]>;
        Relationships: [];
      };
      iap_receipts: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          transaction_id: string;
          original_transaction_id: string | null;
          purchased_at: string;
          expires_at: string | null;
          is_subscription: boolean;
          raw_payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          transaction_id: string;
          original_transaction_id?: string | null;
          purchased_at: string;
          expires_at?: string | null;
          is_subscription: boolean;
          raw_payload?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["iap_receipts"]["Insert"]>;
        Relationships: [];
      };
      consumable_grants: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          granted_at: string;
          consumed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          granted_at?: string;
          consumed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["consumable_grants"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      checkin: {
        Args: {
          p_gym_id: string;
          p_latitude: number;
          p_longitude: number;
          p_verified: boolean;
        };
        Returns: string;
      };
      checkout: {
        Args: {
          p_checkin_id: string;
        };
        Returns: undefined;
      };
    };
    CompositeTypes: Record<string, never>;
  };
};
