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
      analytics_preferences: {
        Row: {
          user_id: string
          product_analytics_enabled: boolean
          sale_sharing_opt_out: boolean
          consent_version: string
          prompted_at: string | null
          consented_at: string | null
          basis: string
          updated_at: string
        }
        Insert: {
          user_id: string
          product_analytics_enabled?: boolean
          sale_sharing_opt_out?: boolean
          consent_version?: string
          prompted_at?: string | null
          consented_at?: string | null
          basis?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          product_analytics_enabled?: boolean
          sale_sharing_opt_out?: boolean
          consent_version?: string
          prompted_at?: string | null
          consented_at?: string | null
          basis?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          id: number
          user_id: string
          event_name: string
          properties: Json
          occurred_at: string
          created_at: string
          session_id: string | null
          app_version: string | null
          platform: string | null
          os_version: string | null
        }
        Insert: {
          id?: number
          user_id: string
          event_name: string
          properties?: Json
          occurred_at?: string
          created_at?: string
          session_id?: string | null
          app_version?: string | null
          platform?: string | null
          os_version?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          event_name?: string
          properties?: Json
          occurred_at?: string
          created_at?: string
          session_id?: string | null
          app_version?: string | null
          platform?: string | null
          os_version?: string | null
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          id: string
          privacy_version: string
          source: "email" | "apple"
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          privacy_version: string
          source: "email" | "apple"
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          privacy_version?: string
          source?: "email" | "apple"
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          user_id: string
          push_token: string | null
          push_permission_status: "not_asked" | "granted" | "denied"
          push_prompt_shown_at: string | null
          timezone: string
          push_enabled: boolean
          gym_reminders_enabled: boolean
          daily_nudge_time: string
          taunts_enabled: boolean
          friend_checkins_scope: "my_gym" | "all_friends" | "off"
          messages_enabled: boolean
          friend_requests_enabled: boolean
          reactions_enabled: boolean
          post_views_enabled: boolean
          follows_enabled: boolean
          tags_enabled: boolean
          communities_enabled: boolean
          friend_activity_enabled: boolean
          achievements_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_start: string
          quiet_hours_end: string
          updated_at: string
        }
        Insert: {
          user_id: string
          push_token?: string | null
          push_permission_status?: "not_asked" | "granted" | "denied"
          push_prompt_shown_at?: string | null
          timezone?: string
          push_enabled?: boolean
          gym_reminders_enabled?: boolean
          daily_nudge_time?: string
          taunts_enabled?: boolean
          friend_checkins_scope?: "my_gym" | "all_friends" | "off"
          messages_enabled?: boolean
          friend_requests_enabled?: boolean
          reactions_enabled?: boolean
          post_views_enabled?: boolean
          follows_enabled?: boolean
          tags_enabled?: boolean
          communities_enabled?: boolean
          friend_activity_enabled?: boolean
          achievements_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          push_token?: string | null
          push_permission_status?: "not_asked" | "granted" | "denied"
          push_prompt_shown_at?: string | null
          timezone?: string
          push_enabled?: boolean
          gym_reminders_enabled?: boolean
          daily_nudge_time?: string
          taunts_enabled?: boolean
          friend_checkins_scope?: "my_gym" | "all_friends" | "off"
          messages_enabled?: boolean
          friend_requests_enabled?: boolean
          reactions_enabled?: boolean
          post_views_enabled?: boolean
          follows_enabled?: boolean
          tags_enabled?: boolean
          communities_enabled?: boolean
          friend_activity_enabled?: boolean
          achievements_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
          updated_at?: string
        }
        Relationships: []
      }
      restrictions: {
        Row: { id: string; restrictor_id: string; restricted_id: string; created_at: string }
        Insert: { id?: string; restrictor_id: string; restricted_id: string; created_at?: string }
        Update: { id?: string; restrictor_id?: string; restricted_id?: string; created_at?: string }
        Relationships: []
      }
      close_friends: {
        Row: { user_id: string; friend_id: string; created_at: string }
        Insert: { user_id: string; friend_id: string; created_at?: string }
        Update: { user_id?: string; friend_id?: string; created_at?: string }
        Relationships: []
      }
      data_export_requests: {
        Row: { id: string; user_id: string; requested_at: string; fulfilled_at: string | null; download_expires_at: string | null }
        Insert: { id?: string; user_id: string; requested_at?: string; fulfilled_at?: string | null; download_expires_at?: string | null }
        Update: { id?: string; user_id?: string; requested_at?: string; fulfilled_at?: string | null; download_expires_at?: string | null }
        Relationships: []
      }
      taunt_mutes: {
        Row: { user_id: string; muted_id: string; created_at: string }
        Insert: { user_id: string; muted_id: string; created_at?: string }
        Update: { user_id?: string; muted_id?: string; created_at?: string }
        Relationships: []
      }
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
          role_id: string | null
          last_read_at: string
          muted: boolean
        }
        Insert: {
          community_id: string
          user_id: string
          joined_at?: string
          role?: string
          role_id?: string | null
          last_read_at?: string
          muted?: boolean
        }
        Update: {
          community_id?: string
          user_id?: string
          joined_at?: string
          role?: string
          role_id?: string | null
          last_read_at?: string
          muted?: boolean
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
          {
            foreignKeyName: "community_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "community_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      trophy_definitions: {
        Row: {
          id: string
          key: string
          category: string
          tier: string | null
          name: string
          description: string
          icon: string
          rule_type: string
          rule_params: Json
          family: string | null
          sort: number
          repeatable: boolean
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          category: string
          tier?: string | null
          name: string
          description?: string
          icon?: string
          rule_type: string
          rule_params?: Json
          family?: string | null
          sort?: number
          repeatable?: boolean
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          category?: string
          tier?: string | null
          name?: string
          description?: string
          icon?: string
          rule_type?: string
          rule_params?: Json
          family?: string | null
          sort?: number
          repeatable?: boolean
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      trophy_rarity_stats: {
        Row: { key: string; earned_users: number; total_users: number; pct: number; computed_at: string }
        Insert: { key: string; earned_users?: number; total_users?: number; pct?: number; computed_at?: string }
        Update: { key?: string; earned_users?: number; total_users?: number; pct?: number; computed_at?: string }
        Relationships: []
      }
      user_trophies: {
        Row: {
          user_id: string
          trophy_id: string
          tier: number | null
          earned_at: string
          family_id: string | null
          metric_value: number | null
          definition_id: string | null
          instance_key: string
          context: Json
          celebrated_at: string | null
        }
        Insert: {
          user_id: string
          trophy_id: string
          tier?: number | null
          earned_at?: string
          family_id?: string | null
          metric_value?: number | null
          definition_id?: string | null
          instance_key?: string
          context?: Json
          celebrated_at?: string | null
        }
        Update: {
          user_id?: string
          trophy_id?: string
          tier?: number | null
          earned_at?: string
          family_id?: string | null
          metric_value?: number | null
          definition_id?: string | null
          instance_key?: string
          context?: Json
          celebrated_at?: string | null
        }
        Relationships: []
      }
      community_roles: {
        Row: {
          id: string
          community_id: string
          name: string
          color: string | null
          position: number
          is_default: boolean
          is_admin: boolean
          can_view_chat: boolean
          can_send_messages: boolean
          can_view_posts: boolean
          can_post: boolean
          can_invite: boolean
          can_manage_members: boolean
          can_manage_roles: boolean
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          color?: string | null
          position?: number
          is_default?: boolean
          is_admin?: boolean
          can_view_chat?: boolean
          can_send_messages?: boolean
          can_view_posts?: boolean
          can_post?: boolean
          can_invite?: boolean
          can_manage_members?: boolean
          can_manage_roles?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          color?: string | null
          position?: number
          is_default?: boolean
          is_admin?: boolean
          can_view_chat?: boolean
          can_send_messages?: boolean
          can_view_posts?: boolean
          can_post?: boolean
          can_invite?: boolean
          can_manage_members?: boolean
          can_manage_roles?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      taunts: {
        Row: {
          id: string
          sender_id: string
          target_id: string
          line_id: string
          sent_at: string
          answered_post_id: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          target_id: string
          line_id: string
          sent_at?: string
          answered_post_id?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          target_id?: string
          line_id?: string
          sent_at?: string
          answered_post_id?: string | null
        }
        Relationships: []
      }
      trophy_events: {
        Row: {
          id: string
          user_id: string
          icon: string
          name: string
          family_name: string | null
          rarity_pct: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          icon: string
          name: string
          family_name?: string | null
          rarity_pct?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          icon?: string
          name?: string
          family_name?: string | null
          rarity_pct?: number | null
          created_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: { user_id: string }
        Insert: { user_id: string }
        Update: { user_id?: string }
        Relationships: []
      }
      community_nudges: {
        Row: {
          id: string
          community_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_nudges_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_nudges_user_id_fkey"
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
          kind: string
        }
        Insert: {
          id?: string
          community_id: string
          sender_id: string
          content: string
          sent_at?: string
          kind?: string
        }
        Update: {
          id?: string
          community_id?: string
          sender_id?: string
          content?: string
          sent_at?: string
          kind?: string
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
          // Nullable since group chats (group rows have no pair).
          participant_a: string | null
          participant_b: string | null
          updated_at: string
          status: string
          requester_id: string | null
          is_group: boolean
          title: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          last_message_at?: string | null
          participant_a?: string | null
          participant_b?: string | null
          updated_at?: string
          status?: string
          requester_id?: string | null
          is_group?: boolean
          title?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          last_message_at?: string | null
          participant_a?: string | null
          participant_b?: string | null
          updated_at?: string
          status?: string
          requester_id?: string | null
          is_group?: boolean
          title?: string | null
          created_by?: string | null
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
          created_at: string
          device_token: string
          platform: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          platform: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          platform?: string
          provider?: string
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
          category: string | null
          created_at: string
          external_id: string | null
          chain: string | null
          institution: string | null
          geofence_radius_meters: number
          id: string
          latitude: number
          longitude: number
          name: string
          pin_locked: boolean
          source: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          external_id?: string | null
          chain?: string | null
          institution?: string | null
          geofence_radius_meters?: number
          id?: string
          latitude: number
          longitude: number
          name: string
          pin_locked?: boolean
          source?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          external_id?: string | null
          chain?: string | null
          institution?: string | null
          geofence_radius_meters?: number
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          pin_locked?: boolean
          source?: string | null
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
          view_once: boolean
          viewed_at: string | null
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
          view_once?: boolean
          viewed_at?: string | null
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
          view_once?: boolean
          viewed_at?: string | null
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
          opened_at: string | null
          payload: Json
          push_attempts: number
          push_last_error: string | null
          push_next_attempt_at: string | null
          push_processed_at: string | null
          push_status: string
          read: boolean
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          payload?: Json
          push_attempts?: number
          push_last_error?: string | null
          push_next_attempt_at?: string | null
          push_processed_at?: string | null
          push_status?: string
          read?: boolean
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          payload?: Json
          push_attempts?: number
          push_last_error?: string | null
          push_next_attempt_at?: string | null
          push_processed_at?: string | null
          push_status?: string
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
      push_deliveries: {
        Row: {
          attempts: number
          created_at: string
          device_token: string
          id: string
          last_error: string | null
          notification_id: string
          receipt_checked_at: string | null
          sent_at: string | null
          status: string
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          device_token: string
          id?: string
          last_error?: string | null
          notification_id: string
          receipt_checked_at?: string | null
          sent_at?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          device_token?: string
          id?: string
          last_error?: string | null
          notification_id?: string
          receipt_checked_at?: string | null
          sent_at?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_user_id_fkey"
            columns: ["user_id"]
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
          parent_id: string | null
          content: string
          created_at: string
          expires_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          parent_id?: string | null
          content: string
          created_at?: string
          expires_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          parent_id?: string | null
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
        Row: { conversation_id: string; user_id: string; joined_at: string; muted: boolean; folder_id: string | null; last_read_at: string | null; cleared_at: string | null }
        Insert: { conversation_id: string; user_id: string; joined_at?: string; muted?: boolean; folder_id?: string | null; last_read_at?: string | null; cleared_at?: string | null }
        Update: { conversation_id?: string; user_id?: string; joined_at?: string; muted?: boolean; folder_id?: string | null; last_read_at?: string | null; cleared_at?: string | null }
        Relationships: []
      }
      music_picks: {
        Row: {
          id: string
          user_id: string
          track_id: string
          track_name: string | null
          artist_id: string | null
          artist_name: string | null
          genre_id: string | null
          genre_name: string | null
          picked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          track_id: string
          track_name?: string | null
          artist_id?: string | null
          artist_name?: string | null
          genre_id?: string | null
          genre_name?: string | null
          picked_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          track_id?: string
          track_name?: string | null
          artist_id?: string | null
          artist_name?: string | null
          genre_id?: string | null
          genre_name?: string | null
          picked_at?: string
        }
        Relationships: []
      }
      music_chart_daily: {
        Row: {
          day: string
          rank: number
          track_id: string
          title: string
          artist: string
          artist_id: string | null
          genre_id: string | null
          genre_name: string | null
          artwork_url: string | null
          preview_url: string | null
          explicit: boolean
          source: string
          release_year: number | null
        }
        Insert: {
          day: string
          rank: number
          track_id: string
          title: string
          artist: string
          artist_id?: string | null
          genre_id?: string | null
          genre_name?: string | null
          artwork_url?: string | null
          preview_url?: string | null
          explicit?: boolean
          source?: string
          release_year?: number | null
        }
        Update: {
          day?: string
          rank?: number
          track_id?: string
          title?: string
          artist?: string
          artist_id?: string | null
          genre_id?: string | null
          genre_name?: string | null
          artwork_url?: string | null
          preview_url?: string | null
          explicit?: boolean
          source?: string
          release_year?: number | null
        }
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
      photo_tags: {
        Row: { id: string; post_id: string; photo_index: number; user_id: string; x: number; y: number; created_at: string }
        Insert: { id?: string; post_id: string; photo_index?: number; user_id: string; x: number; y: number; created_at?: string }
        Update: { id?: string; post_id?: string; photo_index?: number; user_id?: string; x?: number; y?: number; created_at?: string }
        Relationships: []
      }
      story_likes: {
        Row: { story_id: string; user_id: string; created_at: string }
        Insert: { story_id: string; user_id: string; created_at?: string }
        Update: { story_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      workout_routines: {
        Row: {
          id: string
          user_id: string
          name: string
          exercises: Json
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          exercises?: Json
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          exercises?: Json
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          hidden_at: string | null
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
          hidden_at?: string | null
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
          hidden_at?: string | null
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
          moderation_status: string
          moderation_score: Json | null
          moderated_at: string | null
          inset_url: string | null
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
          moderation_status?: string
          moderation_score?: Json | null
          moderated_at?: string | null
          inset_url?: string | null
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
          moderation_status?: string
          moderation_score?: Json | null
          moderated_at?: string | null
          inset_url?: string | null
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
          is_private: boolean
          posts_private: boolean
          active_conversation_id: string | null
          active_conversation_at: string | null
          friends_list_hidden: boolean
          location_audience: string
          quiet_checkin_default: boolean
          account_status: string
          deletion_requested_at: string | null
          purge_scheduled_at: string | null
          arrival_notifs_enabled: boolean
          last_seen_at: string | null
          show_activity: boolean
          dm_preview_enabled: boolean
          split_public: boolean
          featured_trophies: Json
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
          username_changed_at: string | null
        }
        Insert: {
          is_private?: boolean
          posts_private?: boolean
          active_conversation_id?: string | null
          active_conversation_at?: string | null
          friends_list_hidden?: boolean
          location_audience?: string
          quiet_checkin_default?: boolean
          account_status?: string
          deletion_requested_at?: string | null
          purge_scheduled_at?: string | null
          arrival_notifs_enabled?: boolean
          last_seen_at?: string | null
          show_activity?: boolean
          dm_preview_enabled?: boolean
          split_public?: boolean
          featured_trophies?: Json
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
          username_changed_at?: string | null
        }
        Update: {
          is_private?: boolean
          posts_private?: boolean
          active_conversation_id?: string | null
          active_conversation_at?: string | null
          friends_list_hidden?: boolean
          location_audience?: string
          quiet_checkin_default?: boolean
          account_status?: string
          deletion_requested_at?: string | null
          purge_scheduled_at?: string | null
          arrival_notifs_enabled?: boolean
          last_seen_at?: string | null
          show_activity?: boolean
          dm_preview_enabled?: boolean
          split_public?: boolean
          featured_trophies?: Json
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
          username_changed_at?: string | null
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
      gym_days: {
        Row: {
          user_id: string
          day: string
          post_id: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          day: string
          post_id?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          day?: string
          post_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_days_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_dismissals: {
        Row: {
          user_id: string
          dismissed_id: string
          dismissed_at: string
        }
        Insert: {
          user_id: string
          dismissed_id: string
          dismissed_at?: string
        }
        Update: {
          user_id?: string
          dismissed_id?: string
          dismissed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_dismissals_dismissed_id_fkey"
            columns: ["dismissed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_exercises: {
        Row: {
          user_id: string
          name: string
          muscle: string
          def_w: number | null
          def_r: number | null
          def_min: number | null
          def_mi: number | null
          def_inc: number | null
          created_at: string
        }
        Insert: {
          user_id: string
          name: string
          muscle?: string
          def_w?: number | null
          def_r?: number | null
          def_min?: number | null
          def_mi?: number | null
          def_inc?: number | null
          created_at?: string
        }
        Update: {
          user_id?: string
          name?: string
          muscle?: string
          def_w?: number | null
          def_r?: number | null
          def_min?: number | null
          def_mi?: number | null
          def_inc?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_favorites: {
        Row: {
          user_id: string
          exercise_name: string
          created_at: string
        }
        Insert: {
          user_id: string
          exercise_name: string
          created_at?: string
        }
        Update: {
          user_id?: string
          exercise_name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_stories: {
        Row: {
          id: string
          owner_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_stories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_story_members: {
        Row: {
          story_id: string
          user_id: string
          added_at: string
        }
        Insert: {
          story_id: string
          user_id: string
          added_at?: string
        }
        Update: {
          story_id?: string
          user_id?: string
          added_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_story_members_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "private_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_story_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          overlay_text: string | null
          id: string
          user_id: string
          media_url: string
          created_at: string
          expires_at: string
          private_story_id: string | null
          music_title: string | null
          music_artist: string | null
          music_preview_url: string | null
          music_artwork_url: string | null
          music_clip_start: number
        }
        Insert: {
          overlay_text?: string | null
          id?: string
          user_id: string
          media_url: string
          created_at?: string
          expires_at?: string
          private_story_id?: string | null
          music_title?: string | null
          music_artist?: string | null
          music_preview_url?: string | null
          music_artwork_url?: string | null
          music_clip_start?: number
        }
        Update: {
          overlay_text?: string | null
          id?: string
          user_id?: string
          media_url?: string
          created_at?: string
          expires_at?: string
          private_story_id?: string | null
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
          {
            foreignKeyName: "stories_private_story_id_fkey"
            columns: ["private_story_id"]
            isOneToOne: false
            referencedRelation: "private_stories"
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
      register_push_token: {
        Args: { p_token: string; p_platform: string }
        Returns: undefined
      }
      unregister_push_token: {
        Args: { p_token: string }
        Returns: undefined
      }
      mark_notification_opened: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      record_legal_acceptance: {
        Args: {
          p_privacy_version: string
          p_source: string
          p_terms_version: string
        }
        Returns: undefined
      }
      record_post_view: { Args: { p_post_id: string }; Returns: undefined }
      touch_user_activity: { Args: { p_app_version?: string | null; p_platform?: string | null }; Returns: undefined }
      record_profile_view: { Args: { p_profile_id: string }; Returns: undefined }
      respond_message_request: { Args: { p_conversation_id: string; p_accept: boolean }; Returns: undefined }
      trophy_progress: {
        Args: { p_user: string }
        Returns: { key: string; current: number; target: number }[]
      }
      evaluate_user_trophies: {
        Args: { p_user: string }
        Returns: { r_key: string; r_name: string; r_tier: string | null; r_instance: string }[]
      }
      profile_lite: {
        Args: { p_ids: string[] }
        Returns: { id: string; username: string; display_name: string; avatar_url: string | null }[]
      }
      set_active_conversation: { Args: { p_conversation: string | null }; Returns: undefined }
      community_permissions: { Args: { p_community: string; p_user: string }; Returns: Json }
      set_community_member_role: { Args: { p_community: string; p_user: string; p_role: string }; Returns: undefined }
      remove_community_member: { Args: { p_community: string; p_user: string }; Returns: undefined }
      community_invite_code: { Args: { cid: string }; Returns: string | null }
      regenerate_community_invite_code: { Args: { cid: string }; Returns: string }
      join_community_by_code: { Args: { code: string }; Returns: string | null }
      nudge_community: { Args: { cid: string; p_text?: string }; Returns: number }
      notify_second_workout: { Args: { p_post: string; p_name: string }; Returns: number }
      check_age_gate: { Args: { p_email: string; p_device_id: string; p_dob: string }; Returns: string }
      create_group_conversation: { Args: { p_title: string; p_member_ids: string[] }; Returns: string }
      add_group_members: { Args: { p_conversation: string; p_member_ids: string[] }; Returns: undefined }
      group_display_name: { Args: { p_conversation: string; p_viewer: string }; Returns: string }
      block_user: { Args: { p_target: string }; Returns: undefined }
      unblock_user: { Args: { p_target: string }; Returns: undefined }
      restrict_user: { Args: { p_target: string }; Returns: undefined }
      unrestrict_user: { Args: { p_target: string }; Returns: undefined }
      deactivate_account: { Args: Record<string, never>; Returns: undefined }
      reactivate_account: { Args: Record<string, never>; Returns: undefined }
      request_account_deletion: { Args: Record<string, never>; Returns: string }
      restore_account: { Args: Record<string, never>; Returns: undefined }
      flag_post_from_report: { Args: { p_post: string }; Returns: undefined }
      review_queue: { Args: Record<string, never>; Returns: { post_id: string; user_id: string; media_url: string | null; inset_url: string | null; moderation_score: Json | null; created_at: string }[] }
      review_resolve: { Args: { p_post: string; p_approve: boolean }; Returns: undefined }
      is_admin: { Args: { p_user: string }; Returns: boolean }
      mark_message_viewed: { Args: { p_message: string }; Returns: undefined }
      delete_community: { Args: { p_community: string }; Returns: undefined }
      evaluate_trophies: {
        Args: { p_user: string }
        Returns: { out_unlock_id: string; out_family_id: string; out_tier: number; out_name: string; out_metric: number }[]
      }
      send_taunt_line: {
        Args: { p_target: string; p_line_id: string; p_line_text: string; p_since: string }
        Returns: string
      }
      wave_at_friend: { Args: { target: string; gym_name?: string | null }; Returns: undefined }
      search_profiles_fuzzy: {
        Args: { q: string; max_rows?: number }
        Returns: { id: string; username: string; display_name: string; avatar_url: string | null }[]
      }
      search_communities_fuzzy: {
        Args: { q: string; max_rows?: number }
        Returns: Database["public"]["Tables"]["communities"]["Row"][]
      }
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
          p_accuracy_m?: number
        }
        Returns: string
      }
      fix_gym_pin: {
        Args: {
          p_gym_id: string
          p_latitude: number
          p_longitude: number
          p_accuracy_m?: number
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
          reason: string | null
        }[]
      }
      gyms_in_bounds: {
        Args: {
          p_min_lat: number
          p_min_lng: number
          p_max_lat: number
          p_max_lng: number
          p_limit?: number
        }
        Returns: {
          id: string
          name: string
          address: string | null
          latitude: number
          longitude: number
          category: string | null
          chain: string | null
          institution: string | null
        }[]
      }
      mutual_friend_counts: {
        Args: { p_ids: string[] }
        Returns: { user_id: string; mutual_count: number }[]
      }
      match_contacts: {
        Args: { p_emails: string[]; p_phones: string[] }
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
      community_presence_now: { Args: { p_community_id: string }; Returns: Json }
      community_board: { Args: { p_community_id: string }; Returns: Json }
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
      record_trophies: {
        Args: { p_trophy_ids: string[] }
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
      mark_rest_day: {
        Args: {
          p_rest?: boolean
        }
        Returns: Json
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
        | "mention"
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
        | "wave"
        | "community_nudge"
        | "tagged"
        | "taunt_answered"
        | "trophy_unlocked"
        | "claim_approved"
        | "claim_rejected"
        | "second_workout"
        | "daily_nudge"
        | "arrival_buzz"
        | "system_notice"
        | "post_comment"
        | "community_message"
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
        "mention",
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
        "wave",
        "community_nudge",
        "tagged",
        "taunt_answered",
        "trophy_unlocked",
        "claim_approved",
        "claim_rejected",
        "second_workout",
        "daily_nudge",
        "arrival_buzz",
        "system_notice",
        "post_comment",
        "community_message",
      ],
      schedule_visibility: ["public", "friends", "private"],
      subscription_tier: ["free", "plus"],
    },
  },
} as const
