export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          checked_in_at: string
          checked_out_at: string | null
          gym_id: string
          id: string
          source: string
          user_id: string
          verified: boolean
        }
        Insert: {
          checked_in_at?: string
          checked_out_at?: string | null
          gym_id: string
          id?: string
          source?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          checked_in_at?: string
          checked_out_at?: string | null
          gym_id?: string
          id?: string
          source?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "checkins_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_grants: {
        Row: {
          consumed_at: string | null
          granted_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          granted_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          granted_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumable_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          id: string
          name: string
          type: string
          gym_id: string | null
          created_by: string | null
          created_at: string
          photo_url: string | null
          description: string | null
          privacy: string
          location: string | null
          invite_code: string | null
        }
        Insert: {
          id?: string
          name: string
          type?: string
          gym_id?: string | null
          created_by?: string | null
          created_at?: string
          photo_url?: string | null
          description?: string | null
          privacy?: string
          location?: string | null
          invite_code?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string
          gym_id?: string | null
          created_by?: string | null
          created_at?: string
          photo_url?: string | null
          description?: string | null
          privacy?: string
          location?: string | null
          invite_code?: string | null
        }
        Relationships: []
      }
      community_join_requests: {
        Row: {
          community_id: string
          user_id: string
          requested_at: string
        }
        Insert: {
          community_id: string
          user_id: string
          requested_at?: string
        }
        Update: {
          community_id?: string
          user_id?: string
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_join_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_invites: {
        Row: {
          community_id: string
          inviter_id: string
          invitee_id: string
          created_at: string
        }
        Insert: {
          community_id: string
          inviter_id: string
          invitee_id: string
          created_at?: string
        }
        Update: {
          community_id?: string
          inviter_id?: string
          invitee_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_invites_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_notification_prefs: {
        Row: { community_id: string; user_id: string; muted: boolean; updated_at: string }
        Insert: { community_id: string; user_id: string; muted?: boolean; updated_at?: string }
        Update: { community_id?: string; user_id?: string; muted?: boolean; updated_at?: string }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          user_id: string
          joined_at: string
          role: string
        }
        Insert: {
          community_id: string
          user_id: string
          joined_at?: string
          role?: string
        }
        Update: {
          community_id?: string
          user_id?: string
          joined_at?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          id: string
          community_id: string
          sender_id: string
          content: string
          sent_at: string
        }
        Insert: {
          id?: string
          community_id: string
          sender_id: string
          content: string
          sent_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          sender_id?: string
          content?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_communities: {
        Row: {
          post_id: string
          community_id: string
        }
        Insert: {
          post_id: string
          community_id: string
        }
        Update: {
          post_id?: string
          community_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_communities_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_communities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          last_message_at: string | null
          participant_a: string
          participant_b: string
          updated_at: string
          status: string
          requester_id: string | null
        }
        Insert: {
          id?: string
          last_message_at?: string | null
          participant_a: string
          participant_b: string
          updated_at?: string
          status?: string
          requester_id?: string | null
        }
        Update: {
          id?: string
          last_message_at?: string | null
          participant_a?: string
          participant_b?: string
          updated_at?: string
          status?: string
          requester_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          device_token: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          device_token: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          device_token?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string | null
          created_at: string
          geofence_radius_meters: number
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          geofence_radius_meters?: number
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          geofence_radius_meters?: number
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      iap_receipts: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_subscription: boolean
          original_transaction_id: string | null
          product_id: string
          purchased_at: string
          raw_payload: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_subscription: boolean
          original_transaction_id?: string | null
          product_id: string
          purchased_at: string
          raw_payload?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_subscription?: boolean
          original_transaction_id?: string | null
          product_id?: string
          purchased_at?: string
          raw_payload?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iap_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          id: string
          media_url: string | null
          reply_story_media: string | null
          read_at: string | null
          sender_id: string
          sent_at: string
          reply_to_id: string | null
          deleted_at: string | null
          kind: string
          shared_kind: string | null
          shared_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          id?: string
          media_url?: string | null
          reply_story_media?: string | null
          read_at?: string | null
          sender_id: string
          sent_at?: string
          reply_to_id?: string | null
          deleted_at?: string | null
          kind?: string
          shared_kind?: string | null
          shared_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          id?: string
          media_url?: string | null
          reply_story_media?: string | null
          read_at?: string | null
          sender_id?: string
          sent_at?: string
          reply_to_id?: string | null
          deleted_at?: string | null
          kind?: string
          shared_kind?: string | null
          shared_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          read: boolean
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          recipient_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          content_type: string
          content_id: string
          reported_user_id: string | null
          reason: string
          note: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          content_type: string
          content_id: string
          reported_user_id?: string | null
          reason: string
          note?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          content_type?: string
          content_id?: string
          reported_user_id?: string | null
          reason?: string
          note?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          expires_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          media_url: string | null
          post_id: string
          reaction: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          media_url?: string | null
          post_id: string
          reaction?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          media_url?: string | null
          post_id?: string
          reaction?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_replays: {
        Row: {
          id: string
          post_id: string
          replayed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          post_id: string
          replayed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          post_id?: string
          replayed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_replays_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_replays_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lifts: {
        Row: {
          id: string
          user_id: string
          exercise: string
          value: number
          unit: string
          post_id: string | null
          performed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise: string
          value: number
          unit: string
          post_id?: string | null
          performed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise?: string
          value?: number
          unit?: string
          post_id?: string | null
          performed_at?: string
          created_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: { conversation_id: string; user_id: string; joined_at: string; muted: boolean; folder_id: string | null; last_read_at: string | null }
        Insert: { conversation_id: string; user_id: string; joined_at?: string; muted?: boolean; folder_id?: string | null; last_read_at?: string | null }
        Update: { conversation_id?: string; user_id?: string; joined_at?: string; muted?: boolean; folder_id?: string | null; last_read_at?: string | null }
        Relationships: []
      }
      message_folders: {
        Row: { id: string; user_id: string; name: string; created_at: string }
        Insert: { id?: string; user_id: string; name: string; created_at?: string }
        Update: { id?: string; user_id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      message_reactions: {
        Row: { message_id: string; user_id: string; emoji: string; created_at: string }
        Insert: { message_id: string; user_id: string; emoji: string; created_at?: string }
        Update: { message_id?: string; user_id?: string; emoji?: string; created_at?: string }
        Relationships: []
      }
      message_hides: {
        Row: { message_id: string; user_id: string; hidden_at: string }
        Insert: { message_id: string; user_id: string; hidden_at?: string }
        Update: { message_id?: string; user_id?: string; hidden_at?: string }
        Relationships: []
      }
      user_blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string }
        Insert: { blocker_id: string; blocked_id: string; created_at?: string }
        Update: { blocker_id?: string; blocked_id?: string; created_at?: string }
        Relationships: []
      }
      story_tags: {
        Row: { story_id: string; user_id: string }
        Insert: { story_id: string; user_id: string }
        Update: { story_id?: string; user_id?: string }
        Relationships: []
      }
      story_likes: {
        Row: { story_id: string; user_id: string; created_at: string }
        Insert: { story_id: string; user_id: string; created_at?: string }
        Update: { story_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          name: string
          started_at: string
          ended_at: string | null
          duration_seconds: number
          total_volume: number
          total_sets: number
          cardio_minutes: number
          exercise_count: number
          data: Json
          post_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number
          total_volume?: number
          total_sets?: number
          cardio_minutes?: number
          exercise_count?: number
          data?: Json
          post_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number
          total_volume?: number
          total_sets?: number
          cardio_minutes?: number
          exercise_count?: number
          data?: Json
          post_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      post_views: {
        Row: {
          post_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          post_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          post_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tags: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          gym_id: string | null
          id: string
          is_daily_drop: boolean
          is_verified_at_gym: boolean
          lift_name: string | null
          lift_weight: string | null
          lift_exercise: string | null
          lift_value: number | null
          lift_unit: string | null
          thumbnail_url: string | null
          location_kind: string
          media_type: string
          media_url: string
          media_urls: string[] | null
          music_artist: string | null
          music_artwork_url: string | null
          music_clip_start: number
          music_preview_url: string | null
          music_title: string | null
          permanent: boolean
          replay_count: number
          reply_count: number
          saved: boolean
          updated_at: string
          user_id: string
          video_trim_start: number | null
          video_trim_end: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          is_daily_drop?: boolean
          is_verified_at_gym?: boolean
          lift_name?: string | null
          lift_weight?: string | null
          lift_exercise?: string | null
          lift_value?: number | null
          lift_unit?: string | null
          thumbnail_url?: string | null
          location_kind?: string
          media_type: string
          media_url: string
          media_urls?: string[] | null
          music_artist?: string | null
          music_artwork_url?: string | null
          music_clip_start?: number
          music_preview_url?: string | null
          music_title?: string | null
          permanent?: boolean
          replay_count?: number
          reply_count?: number
          saved?: boolean
          updated_at?: string
          user_id: string
          video_trim_start?: number | null
          video_trim_end?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          gym_id?: string | null
          id?: string
          is_daily_drop?: boolean
          is_verified_at_gym?: boolean
          lift_name?: string | null
          lift_weight?: string | null
          lift_exercise?: string | null
          lift_value?: number | null
          lift_unit?: string | null
          thumbnail_url?: string | null
          location_kind?: string
          media_type?: string
          media_url?: string
          media_urls?: string[] | null
          music_artist?: string | null
          music_artwork_url?: string | null
          music_clip_start?: number
          music_preview_url?: string | null
          music_title?: string | null
          permanent?: boolean
          replay_count?: number
          reply_count?: number
          saved?: boolean
          updated_at?: string
          user_id?: string
          video_trim_start?: number | null
          video_trim_end?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          profile_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arrival_notifs_enabled: boolean
          avatar_blurred_url: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          discoverable: boolean
          display_name: string
          ghost_mode: boolean
          gym_score: number
          home_gym_id: string | null
          id: string
          onboarding_stage: string
          premium_since: string | null
          schedule_visibility: Database["public"]["Enums"]["schedule_visibility"]
          social_links: Json
          subscription_expires_at: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          timezone: string
          updated_at: string
          username: string
        }
        Insert: {
          arrival_notifs_enabled?: boolean
          avatar_blurred_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          discoverable?: boolean
          display_name: string
          ghost_mode?: boolean
          gym_score?: number
          home_gym_id?: string | null
          id: string
          onboarding_stage?: string
          premium_since?: string | null
          schedule_visibility?: Database["public"]["Enums"]["schedule_visibility"]
          social_links?: Json
          subscription_expires_at?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          timezone?: string
          updated_at?: string
          username: string
        }
        Update: {
          arrival_notifs_enabled?: boolean
          avatar_blurred_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string
          ghost_mode?: boolean
          gym_score?: number
          home_gym_id?: string | null
          id?: string
          onboarding_stage?: string
          premium_since?: string | null
          schedule_visibility?: Database["public"]["Enums"]["schedule_visibility"]
          social_links?: Json
          subscription_expires_at?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          timezone?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_gym_id_fkey"
            columns: ["home_gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      skip_events: {
        Row: {
          created_at: string
          id: string
          muscle_groups_missed: string[]
          notified_friends: boolean
          scheduled_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_groups_missed?: string[]
          notified_friends?: boolean
          scheduled_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muscle_groups_missed?: string[]
          notified_friends?: boolean
          scheduled_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skip_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          id: string
          user_id: string
          media_url: string
          created_at: string
          expires_at: string
          music_title: string | null
          music_artist: string | null
          music_preview_url: string | null
          music_artwork_url: string | null
          music_clip_start: number
        }
        Insert: {
          id?: string
          user_id: string
          media_url: string
          created_at?: string
          expires_at?: string
          music_title?: string | null
          music_artist?: string | null
          music_preview_url?: string | null
          music_artwork_url?: string | null
          music_clip_start?: number
        }
        Update: {
          id?: string
          user_id?: string
          media_url?: string
          created_at?: string
          expires_at?: string
          music_title?: string | null
          music_artist?: string | null
          music_preview_url?: string | null
          music_artwork_url?: string | null
          music_clip_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewer_id: string
          viewed_at: string
        }
        Insert: {
          story_id: string
          viewer_id: string
          viewed_at?: string
        }
        Update: {
          story_id?: string
          viewer_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          current_streak: number
          freeze_tokens: number
          last_checkin_date: string | null
          longest_streak: number
          user_id: string
        }
        Insert: {
          current_streak?: number
          freeze_tokens?: number
          last_checkin_date?: string | null
          longest_streak?: number
          user_id: string
        }
        Update: {
          current_streak?: number
          freeze_tokens?: number
          last_checkin_date?: string | null
          longest_streak?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_schedule: {
        Row: {
          day_of_week: number
          end_time: string | null
          id: string
          muscle_groups: string[]
          start_time: string | null
          user_id: string
        }
        Insert: {
          day_of_week: number
          end_time?: string | null
          id?: string
          muscle_groups?: string[]
          start_time?: string | null
          user_id: string
        }
        Update: {
          day_of_week?: number
          end_time?: string | null
          id?: string
          muscle_groups?: string[]
          start_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_schedule_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      respond_message_request: { Args: { p_conversation_id: string; p_accept: boolean }; Returns: undefined }
      community_invite_code: { Args: { cid: string }; Returns: string | null }
      regenerate_community_invite_code: { Args: { cid: string }; Returns: string }
      join_community_by_code: { Args: { code: string }; Returns: string | null }
      can_read_post: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
      checkin: {
        Args: {
          p_gym_id: string
          p_latitude: number
          p_longitude: number
          p_verified?: boolean
        }
        Returns: string
      }
      checkout: { Args: { p_checkin_id: string }; Returns: undefined }
      earth: { Args: never; Returns: number }
      get_friend_suggestions: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          mutual_friends_count: number
          username: string
        }[]
      }
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_community_member: {
        Args: { p_community_id: string; p_user_id: string }
        Returns: boolean
      }
      join_gym_community: { Args: { p_gym_id: string }; Returns: string }
      refine_gym_location: {
        Args: { p_gym_id: string; p_latitude: number; p_longitude: number }
        Returns: boolean
      }
      shares_community_post: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      profile_counts: {
        Args: { uid: string }
        Returns: { friends: number; followers: number; following: number; posts: number }[]
      }
      mutual_friends: {
        Args: { uid: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      user_friends: {
        Args: { uid: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      respond_join_request: {
        Args: { p_community_id: string; p_user_id: string; p_accept: boolean }
        Returns: undefined
      }
      respond_community_invite: {
        Args: { p_community_id: string; p_accept: boolean }
        Returns: undefined
      }
      send_taunt: {
        Args: { p_target: string; p_text: string }
        Returns: undefined
      }
      record_streak_high_water: {
        Args: { p_streak: number }
        Returns: undefined
      }
      trophy_rarity: {
        Args: never
        Returns: { trophy_id: string; earned_count: number; total_users: number; pct: number }[]
      }
      search_gyms: {
        Args: {
          p_query?: string | null
          p_latitude?: number | null
          p_longitude?: number | null
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          name: string
          address: string | null
          latitude: number
          longitude: number
          distance_meters: number | null
        }[]
      }
    }
    Enums: {
      friendship_status: "pending" | "accepted" | "blocked"
      notification_type:
        | "friend_request"
        | "friend_accepted"
        | "post_view"
        | "post_reaction"
        | "streak_break_friend"
        | "streak_milestone"
        | "dm"
        | "gym_arrival_friend"
        | "new_follower"
        | "community_invite"
        | "taunt"
      schedule_visibility: "public" | "friends" | "private"
      subscription_tier: "free" | "plus"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      friendship_status: ["pending", "accepted", "blocked"],
      notification_type: [
        "friend_request",
        "friend_accepted",
        "post_view",
        "post_reaction",
        "streak_break_friend",
        "streak_milestone",
        "dm",
        "gym_arrival_friend",
        "new_follower",
        "community_invite",
        "taunt",
      ],
      schedule_visibility: ["public", "friends", "private"],
      subscription_tier: ["free", "plus"],
    },
  },
} as const
