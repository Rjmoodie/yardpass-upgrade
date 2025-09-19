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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_type: string
          id: string
          metadata: Json
          path: string | null
          referrer: string | null
          session_id: string | null
          source: string | null
          ticket_id: string | null
          url: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          ticket_id?: string | null
          url?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          ticket_id?: string | null
          url?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      cultural_guides: {
        Row: {
          community: string[] | null
          etiquette_tips: string[] | null
          event_id: string
          history_long: string | null
          roots_summary: string | null
          themes: string[] | null
        }
        Insert: {
          community?: string[] | null
          etiquette_tips?: string[] | null
          event_id: string
          history_long?: string | null
          roots_summary?: string | null
          themes?: string[] | null
        }
        Update: {
          community?: string[] | null
          etiquette_tips?: string[] | null
          event_id?: string
          history_long?: string | null
          roots_summary?: string | null
          themes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "cultural_guides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultural_guides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "event_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          author_user_id: string
          created_at: string | null
          id: string
          post_id: string
          text: string
        }
        Insert: {
          author_user_id: string
          created_at?: string | null
          id?: string
          post_id: string
          text: string
        }
        Update: {
          author_user_id?: string
          created_at?: string | null
          id?: string
          post_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts_with_meta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_recent_posts_top3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_comments_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_comments_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts_with_meta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_comments_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_recent_posts_top3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_comments_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          created_at: string | null
          email: string | null
          event_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          event_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          event_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_posts: {
        Row: {
          author_user_id: string
          comment_count: number
          created_at: string | null
          deleted_at: string | null
          event_id: string
          id: string
          like_count: number
          media_urls: string[] | null
          text: string | null
          ticket_tier_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_user_id: string
          comment_count?: number
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          id?: string
          like_count?: number
          media_urls?: string[] | null
          text?: string | null
          ticket_tier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_user_id?: string
          comment_count?: number
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          like_count?: number
          media_urls?: string[] | null
          text?: string | null
          ticket_tier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_posts_author_user_id_user_profiles_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_ticket_tier_id_fkey"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_ticket_tier_id"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reactions: {
        Row: {
          created_at: string | null
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          kind?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts_with_meta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_recent_posts_top3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_reactions_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_reactions_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_posts_with_meta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_reactions_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_recent_posts_top3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_reactions_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_roles: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          role: Database["public"]["Enums"]["role_type"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          role: Database["public"]["Enums"]["role_type"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          role?: Database["public"]["Enums"]["role_type"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_scanners: {
        Row: {
          created_at: string | null
          event_id: string
          invited_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          invited_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          invited_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_scanners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_scanners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_share_assets: {
        Row: {
          active: boolean
          caption: string | null
          created_at: string
          created_by: string
          duration_seconds: number | null
          event_id: string
          height: number | null
          id: string
          kind: string
          mux_asset_id: string | null
          mux_playback_id: string | null
          mux_upload_id: string | null
          poster_url: string | null
          storage_path: string | null
          title: string | null
          width: number | null
        }
        Insert: {
          active?: boolean
          caption?: string | null
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          event_id: string
          height?: number | null
          id?: string
          kind: string
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          mux_upload_id?: string | null
          poster_url?: string | null
          storage_path?: string | null
          title?: string | null
          width?: number | null
        }
        Update: {
          active?: boolean
          caption?: string | null
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          event_id?: string
          height?: number | null
          id?: string
          kind?: string
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          mux_upload_id?: string | null
          poster_url?: string | null
          storage_path?: string | null
          title?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_share_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_share_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_video_counters: {
        Row: {
          avg_dwell_ms: number | null
          clicks_comment: number | null
          clicks_details: number | null
          clicks_organizer: number | null
          clicks_share: number | null
          clicks_tickets: number | null
          comments: number | null
          completions: number | null
          event_id: string
          likes: number | null
          shares: number | null
          updated_at: string | null
          views_total: number | null
          views_unique: number | null
        }
        Insert: {
          avg_dwell_ms?: number | null
          clicks_comment?: number | null
          clicks_details?: number | null
          clicks_organizer?: number | null
          clicks_share?: number | null
          clicks_tickets?: number | null
          comments?: number | null
          completions?: number | null
          event_id: string
          likes?: number | null
          shares?: number | null
          updated_at?: string | null
          views_total?: number | null
          views_unique?: number | null
        }
        Update: {
          avg_dwell_ms?: number | null
          clicks_comment?: number | null
          clicks_details?: number | null
          clicks_organizer?: number | null
          clicks_share?: number | null
          clicks_tickets?: number | null
          comments?: number | null
          completions?: number | null
          event_id?: string
          likes?: number | null
          shares?: number | null
          updated_at?: string | null
          views_total?: number | null
          views_unique?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_video_counters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_video_counters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          completed_at: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          end_at: string
          hold_payout_until_end: boolean | null
          id: string
          lat: number | null
          link_token: string | null
          lng: number | null
          owner_context_id: string
          owner_context_type: Database["public"]["Enums"]["owner_context"]
          refund_cutoff_days: number | null
          slug: string | null
          start_at: string
          timezone: string | null
          title: string
          venue: string | null
          visibility: Database["public"]["Enums"]["event_visibility"] | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          completed_at?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_at: string
          hold_payout_until_end?: boolean | null
          id?: string
          lat?: number | null
          link_token?: string | null
          lng?: number | null
          owner_context_id: string
          owner_context_type: Database["public"]["Enums"]["owner_context"]
          refund_cutoff_days?: number | null
          slug?: string | null
          start_at: string
          timezone?: string | null
          title: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"] | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          completed_at?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_at?: string
          hold_payout_until_end?: boolean | null
          id?: string
          lat?: number | null
          link_token?: string | null
          lng?: number | null
          owner_context_id?: string
          owner_context_type?: Database["public"]["Enums"]["owner_context"]
          refund_cutoff_days?: number | null
          slug?: string | null
          start_at?: string
          timezone?: string | null
          title?: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "events_owner_context_id_fkey"
            columns: ["owner_context_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_user_id: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["follow_target"]
        }
        Insert: {
          created_at?: string
          follower_user_id: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["follow_target"]
        }
        Update: {
          created_at?: string
          follower_user_id?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["follow_target"]
        }
        Relationships: []
      }
      guest_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          event_id: string
          expires_at: string | null
          id: string
          max_uses: number | null
          notes: string | null
          tier_id: string | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          event_id: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          notes?: string | null
          tier_id?: string | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          notes?: string | null
          tier_id?: string | null
          used_count?: number | null
        }
        Relationships: []
      }
      guest_otp_codes: {
        Row: {
          contact: string
          created_at: string
          event_id: string | null
          expires_at: string
          id: string
          method: string
          otp_hash: string
        }
        Insert: {
          contact: string
          created_at?: string
          event_id?: string | null
          expires_at: string
          id?: string
          method: string
          otp_hash: string
        }
        Update: {
          contact?: string
          created_at?: string
          event_id?: string | null
          expires_at?: string
          id?: string
          method?: string
          otp_hash?: string
        }
        Relationships: []
      }
      guest_ticket_sessions: {
        Row: {
          contact: string
          created_at: string
          expires_at: string
          id: string
          method: string
          scope: Json
          token_hash: string
        }
        Insert: {
          contact: string
          created_at?: string
          expires_at: string
          id?: string
          method: string
          scope: Json
          token_hash: string
        }
        Update: {
          contact?: string
          created_at?: string
          expires_at?: string
          id?: string
          method?: string
          scope?: Json
          token_hash?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          key: string
          response: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          key: string
          response: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          key?: string
          response?: Json
          user_id?: string
        }
        Relationships: []
      }
      kv_store_d42c04e8: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      message_job_recipients: {
        Row: {
          email: string | null
          error: string | null
          id: string
          job_id: string
          phone: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          email?: string | null
          error?: string | null
          id?: string
          job_id: string
          phone?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          email?: string | null
          error?: string | null
          id?: string
          job_id?: string
          phone?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_job_recipients_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "message_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_jobs: {
        Row: {
          batch_size: number
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          created_by: string
          event_id: string
          from_email: string | null
          from_name: string | null
          id: string
          scheduled_at: string | null
          sms_body: string | null
          status: Database["public"]["Enums"]["job_status"]
          subject: string | null
          template_id: string | null
        }
        Insert: {
          batch_size?: number
          body?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by: string
          event_id: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          scheduled_at?: string | null
          sms_body?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          batch_size?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by?: string
          event_id?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          scheduled_at?: string | null
          sms_body?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          created_by: string
          id: string
          name: string
          org_id: string
          sms_body: string | null
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by: string
          id?: string
          name: string
          org_id: string
          sms_body?: string | null
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          org_id?: string
          sms_body?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          quantity: number
          tier_id: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          quantity: number
          tier_id: string
          unit_price_cents: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          quantity?: number
          tier_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_items_order_id"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_items_tier_id"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          currency: string
          event_id: string
          fees_cents: number
          id: string
          paid_at: string | null
          payout_destination_id: string | null
          payout_destination_owner:
            | Database["public"]["Enums"]["owner_context"]
            | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          total_cents: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          event_id: string
          fees_cents?: number
          id?: string
          paid_at?: string | null
          payout_destination_id?: string | null
          payout_destination_owner?:
            | Database["public"]["Enums"]["owner_context"]
            | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          event_id?: string
          fees_cents?: number
          id?: string
          paid_at?: string | null
          payout_destination_id?: string | null
          payout_destination_owner?:
            | Database["public"]["Enums"]["owner_context"]
            | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string | null
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_memberships_org_id"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          handle: string | null
          id: string
          is_verified: boolean | null
          logo_url: string | null
          name: string
          social_links: Json | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          handle?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          name: string
          social_links?: Json | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          handle?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string
          social_links?: Json | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
      payout_accounts: {
        Row: {
          charges_enabled: boolean | null
          context_id: string
          context_type: Database["public"]["Enums"]["owner_context"]
          created_at: string | null
          details_submitted: boolean | null
          id: string
          payouts_enabled: boolean | null
          stripe_connect_id: string | null
        }
        Insert: {
          charges_enabled?: boolean | null
          context_id: string
          context_type: Database["public"]["Enums"]["owner_context"]
          created_at?: string | null
          details_submitted?: boolean | null
          id?: string
          payouts_enabled?: boolean | null
          stripe_connect_id?: string | null
        }
        Update: {
          charges_enabled?: boolean | null
          context_id?: string
          context_type?: Database["public"]["Enums"]["owner_context"]
          created_at?: string | null
          details_submitted?: boolean | null
          id?: string
          payouts_enabled?: boolean | null
          stripe_connect_id?: string | null
        }
        Relationships: []
      }
      post_clicks: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          ip_address: unknown | null
          post_id: string
          session_id: string | null
          source: string | null
          target: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          ip_address?: unknown | null
          post_id: string
          session_id?: string | null
          source?: string | null
          target: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          ip_address?: unknown | null
          post_id?: string
          session_id?: string | null
          source?: string | null
          target?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      post_views: {
        Row: {
          completed: boolean | null
          created_at: string | null
          dwell_ms: number | null
          event_id: string
          id: string
          ip_address: unknown | null
          post_id: string
          qualified: boolean | null
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
          watch_percentage: number | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          dwell_ms?: number | null
          event_id: string
          id?: string
          ip_address?: unknown | null
          post_id: string
          qualified?: boolean | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          watch_percentage?: number | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          dwell_ms?: number | null
          event_id?: string
          id?: string
          ip_address?: unknown | null
          post_id?: string
          qualified?: boolean | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          watch_percentage?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number | null
          minute: string
          user_id: string
        }
        Insert: {
          bucket: string
          count?: number | null
          minute: string
          user_id: string
        }
        Update: {
          bucket?: string
          count?: number | null
          minute?: string
          user_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string | null
          created_by: string | null
          id: string
          order_id: string
          reason: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          order_id: string
          reason?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          order_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reported_by: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reported_by?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reported_by?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      role_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string | null
          event_id: string
          expires_at: string
          id: string
          invited_by: string
          phone: string | null
          role: Database["public"]["Enums"]["role_type"]
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          expires_at: string
          id?: string
          invited_by: string
          phone?: string | null
          role: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          expires_at?: string
          id?: string
          invited_by?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          event_id: string
          id: string
          result: string
          scanner_user_id: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_id: string
          id?: string
          result: string
          scanner_user_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_id?: string
          id?: string
          result?: string
          scanner_user_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          channel: string | null
          clicks: number
          code: string
          content_id: string
          content_type: string
          created_at: string
          created_by: string | null
          last_clicked_at: string | null
          params: Json
        }
        Insert: {
          channel?: string | null
          clicks?: number
          code: string
          content_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          last_clicked_at?: string | null
          params?: Json
        }
        Update: {
          channel?: string | null
          clicks?: number
          code?: string
          content_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          last_clicked_at?: string | null
          params?: Json
        }
        Relationships: []
      }
      ticket_analytics: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_analytics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_analytics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_analytics_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_analytics_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tiers: {
        Row: {
          badge_label: string | null
          created_at: string | null
          currency: string
          event_id: string
          id: string
          max_per_order: number | null
          name: string
          price_cents: number
          quantity: number | null
          sales_end: string | null
          sales_start: string | null
          sold_quantity: number | null
          sort_index: number | null
          status: string | null
          total_quantity: number | null
        }
        Insert: {
          badge_label?: string | null
          created_at?: string | null
          currency?: string
          event_id: string
          id?: string
          max_per_order?: number | null
          name: string
          price_cents?: number
          quantity?: number | null
          sales_end?: string | null
          sales_start?: string | null
          sold_quantity?: number | null
          sort_index?: number | null
          status?: string | null
          total_quantity?: number | null
        }
        Update: {
          badge_label?: string | null
          created_at?: string | null
          currency?: string
          event_id?: string
          id?: string
          max_per_order?: number | null
          name?: string
          price_cents?: number
          quantity?: number | null
          sales_end?: string | null
          sales_start?: string | null
          sold_quantity?: number | null
          sort_index?: number | null
          status?: string | null
          total_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ticket_tiers_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ticket_tiers_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          order_id: string | null
          owner_user_id: string
          qr_code: string
          redeemed_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          tier_id: string
          wallet_pass_url: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          order_id?: string | null
          owner_user_id: string
          qr_code: string
          redeemed_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tier_id: string
          wallet_pass_url?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          order_id?: string | null
          owner_user_id?: string
          qr_code?: string
          redeemed_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tier_id?: string
          wallet_pass_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_tier_id"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_embeddings: {
        Row: {
          embedding: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          embedding?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          embedding?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_event_interactions: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          interaction_type: string
          metadata: Json | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string
          phone: string | null
          photo_url: string | null
          role: string | null
          social_links: Json | null
          updated_at: string | null
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          social_links?: Json | null
          updated_at?: string | null
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          social_links?: Json | null
          updated_at?: string | null
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
    }
    Views: {
      event_covis: {
        Row: {
          covisit_count: number | null
          covisit_ratio: number | null
          event_a: string | null
          event_b: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_a"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_b"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_a"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_b"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_posts_with_meta: {
        Row: {
          author_badge_label: string | null
          author_is_organizer: boolean | null
          author_name: string | null
          author_photo_url: string | null
          author_user_id: string | null
          comment_count: number | null
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          event_title: string | null
          id: string | null
          like_count: number | null
          media_urls: string[] | null
          text: string | null
          ticket_tier_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_posts_author_user_id_user_profiles_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_ticket_tier_id_fkey"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_ticket_tier_id"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_recent_posts_top3: {
        Row: {
          author_name: string | null
          author_photo_url: string | null
          author_user_id: string | null
          comment_count: number | null
          created_at: string | null
          event_id: string | null
          id: string | null
          is_organizer: boolean | null
          like_count: number | null
          media_urls: string[] | null
          rn: number | null
          text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_posts_author_user_id_user_profiles_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      event_video_kpis_daily: {
        Row: {
          avg_dwell_ms: number | null
          clicks_comment: number | null
          clicks_details: number | null
          clicks_organizer: number | null
          clicks_share: number | null
          clicks_tickets: number | null
          comments: number | null
          completions: number | null
          d: string | null
          event_id: string | null
          likes: number | null
          shares: number | null
          views_total: number | null
          views_unique: number | null
        }
        Relationships: []
      }
      events_enhanced: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          completed_at: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_at: string | null
          hold_payout_until_end: boolean | null
          id: string | null
          last_post_at: string | null
          lat: number | null
          link_token: string | null
          lng: number | null
          owner_context_id: string | null
          owner_context_type:
            | Database["public"]["Enums"]["owner_context"]
            | null
          refund_cutoff_days: number | null
          slug: string | null
          start_at: string | null
          timezone: string | null
          title: string | null
          total_comments: number | null
          total_posts: number | null
          venue: string | null
          visibility: Database["public"]["Enums"]["event_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "events_owner_context_id_fkey"
            columns: ["owner_context_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      search_docs: {
        Row: {
          body: string | null
          category: string | null
          item_id: string | null
          kind: string | null
          location: string | null
          organizer_id: string | null
          post_id: string | null
          starts_at: string | null
          title: string | null
        }
        Relationships: []
      }
      search_docs_mv: {
        Row: {
          body: string | null
          category: string | null
          item_id: string | null
          kind: string | null
          location: string | null
          organizer_id: string | null
          post_id: string | null
          starts_at: string | null
          title: string | null
          ts: unknown | null
        }
        Relationships: []
      }
      tickets_enhanced: {
        Row: {
          badge: string | null
          cover_image: string | null
          created_at: string | null
          event_date: string | null
          event_id: string | null
          event_location: string | null
          event_time: string | null
          event_title: string | null
          id: string | null
          order_date: string | null
          order_id: string | null
          organizer_name: string | null
          owner_user_id: string | null
          price: number | null
          qr_code: string | null
          redeemed_at: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          ticket_type: string | null
          tier_id: string | null
          wallet_pass_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_tier_id"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_posts: {
        Row: {
          comment_count: number | null
          created_at: string | null
          event_id: string | null
          id: string | null
          like_count: number | null
          trending_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_posts_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      user_event_affinity: {
        Row: {
          affinity_score: number | null
          event_id: string | null
          interaction_count: number | null
          last_interaction: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_interactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_role_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_current_user_post: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_view_event: {
        Args: { p_event: string; p_user: string }
        Returns: boolean
      }
      cleanup_guest_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_keys: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_organization_with_membership: {
        Args: {
          p_creator_id?: string
          p_handle: string
          p_logo_url?: string
          p_name: string
        }
        Returns: string
      }
      execute_sql: {
        Args: { sql_query: string }
        Returns: Json
      }
      get_current_user_org_role: {
        Args: { p_org_id: string }
        Returns: string
      }
      get_event_kpis_daily: {
        Args: { p_event_ids: string[]; p_from_date: string; p_to_date: string }
        Returns: {
          d: string
          event_id: string
          fees_cents: number
          gmv_cents: number
          orders: number
          units: number
        }[]
      }
      get_event_posts: {
        Args: { p_event_ids: string[]; p_k?: number }
        Returns: {
          author_badge_label: string
          author_display_name: string
          author_is_organizer: boolean
          author_user_id: string
          comment_count: number
          created_at: string
          event_id: string
          id: string
          like_count: number
          media_urls: string[]
          text: string
          ticket_tier_id: string
        }[]
      }
      get_event_scans_daily: {
        Args: { p_event_ids: string[]; p_from_date: string; p_to_date: string }
        Returns: {
          d: string
          dupes: number
          event_id: string
          scans: number
        }[]
      }
      get_feed_item_for_post: {
        Args: { p_post_id: string; p_user: string }
        Returns: {
          author_badge: string
          author_id: string
          author_name: string
          content: string
          event_cover_image: string
          event_description: string
          event_id: string
          event_location: string
          event_organizer: string
          event_organizer_id: string
          event_starts_at: string
          event_title: string
          item_id: string
          item_type: string
          media_urls: string[]
          metrics: Json
          sort_ts: string
        }[]
      }
      get_home_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: Database["public"]["CompositeTypes"]["home_feed_row"][]
      }
      get_home_feed_ids: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          event_id: string
          score: number
        }[]
      }
      get_home_feed_v2: {
        Args: {
          p_cursor_id?: string
          p_cursor_ts?: string
          p_limit?: number
          p_user?: string
        }
        Returns: {
          author_badge: string
          author_id: string
          author_name: string
          author_social_links: Json
          content: string
          event_cover_image: string
          event_description: string
          event_id: string
          event_location: string
          event_organizer: string
          event_organizer_id: string
          event_starts_at: string
          event_title: string
          item_id: string
          item_type: string
          media_urls: string[]
          metrics: Json
          sort_ts: string
        }[]
      }
      get_org_analytics: {
        Args: { p_org_id: string }
        Returns: {
          completed_events: number
          total_attendees: number
          total_events: number
          total_revenue: number
        }[]
      }
      get_post_engagement_daily: {
        Args: { p_event_ids: string[]; p_from_date: string; p_to_date: string }
        Returns: {
          comments: number
          d: string
          event_id: string
          likes: number
          post_id: string
          shares: number
        }[]
      }
      get_recommendations: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          event_id: string
          reason: string
          score: number
        }[]
      }
      get_top_posts_analytics: {
        Args: { p_event_id: string; p_limit?: number; p_metric?: string }
        Returns: {
          clicks_tickets: number
          clicks_total: number
          completions: number
          created_at: string
          ctr_tickets: number
          engagement_total: number
          media_urls: string[]
          post_id: string
          title: string
          views_total: number
          views_unique: number
        }[]
      }
      get_user_analytics: {
        Args: { p_user_id: string }
        Returns: {
          completed_events: number
          total_attendees: number
          total_events: number
          total_revenue: number
        }[]
      }
      get_user_earned_badges: {
        Args: { p_user_id: string }
        Returns: {
          badge_name: string
          description: string
          event_count: number
        }[]
      }
      get_user_event_badge: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: string
      }
      get_user_highest_tier_badge: {
        Args: { event_id_param: string; user_id_param: string }
        Returns: string
      }
      get_user_organizations: {
        Args: { user_uuid: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_current_user_org_admin: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      is_event_individual_owner: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      is_event_manager: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      is_event_org_editor: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      is_org_role: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      normalize_text: {
        Args: { txt: string }
        Returns: string
      }
      refresh_analytics_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_covis: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_search_docs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_trending_posts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_user_affinity: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_user_embedding: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      refresh_video_analytics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_all: {
        Args: {
          p_category?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_only_events?: boolean
          p_q: string
          p_user: string
        }
        Returns: {
          category: string
          item_id: string
          kind: string
          location: string
          post_id: string
          score: number
          snippet: string
          starts_at: string
          title: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      similar_events: {
        Args: { p_event_id: string; p_limit?: number }
        Returns: {
          event_id: string
          similarity_score: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      user_related_event_ids: {
        Args: { p_user_id: string }
        Returns: {
          event_id: string
        }[]
      }
      validate_social_links: {
        Args: { links: Json }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      event_visibility: "public" | "unlisted" | "private"
      follow_target: "organizer" | "event"
      invite_status: "pending" | "accepted" | "expired" | "revoked"
      job_status: "draft" | "queued" | "sending" | "sent" | "failed"
      message_channel: "email" | "sms"
      order_status: "pending" | "paid" | "refunded" | "canceled"
      org_role: "viewer" | "editor" | "admin" | "owner"
      owner_context: "individual" | "organization"
      role_type:
        | "organizer"
        | "scanner"
        | "staff"
        | "volunteer"
        | "vendor"
        | "guest"
      ticket_status: "issued" | "transferred" | "refunded" | "redeemed" | "void"
      verification_status: "none" | "pending" | "verified" | "pro"
    }
    CompositeTypes: {
      home_feed_row: {
        event_id: string | null
        title: string | null
        description: string | null
        category: string | null
        cover_image_url: string | null
        start_at: string | null
        end_at: string | null
        venue: string | null
        city: string | null
        visibility: Database["public"]["Enums"]["event_visibility"] | null
        created_by: string | null
        organizer_display_name: string | null
        organizer_avatar_url: string | null
        recent_posts: Json | null
        ticket_tiers: Json | null
      }
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
      event_visibility: ["public", "unlisted", "private"],
      follow_target: ["organizer", "event"],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      job_status: ["draft", "queued", "sending", "sent", "failed"],
      message_channel: ["email", "sms"],
      order_status: ["pending", "paid", "refunded", "canceled"],
      org_role: ["viewer", "editor", "admin", "owner"],
      owner_context: ["individual", "organization"],
      role_type: [
        "organizer",
        "scanner",
        "staff",
        "volunteer",
        "vendor",
        "guest",
      ],
      ticket_status: ["issued", "transferred", "refunded", "redeemed", "void"],
      verification_status: ["none", "pending", "verified", "pro"],
    },
  },
} as const
