// Database types for Supabase sponsorship system
// Generated from the complete database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      sponsors: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          website_url: string | null
          contact_email: string | null
          created_by: string
          created_at: string
          industry: string | null
          company_size: string | null
          brand_values: Json | null
          preferred_visibility_options: Json | null
          objectives_embedding: number[] | null
          verification_status: 'none' | 'pending' | 'verified' | 'revoked'
          public_visibility: 'hidden' | 'limited' | 'full'
          case_studies: Json | null
          preferred_formats: string[] | null
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          website_url?: string | null
          contact_email?: string | null
          created_by: string
          created_at?: string
          industry?: string | null
          company_size?: string | null
          brand_values?: Json | null
          preferred_visibility_options?: Json | null
          objectives_embedding?: number[] | null
          verification_status?: 'none' | 'pending' | 'verified' | 'revoked'
          public_visibility?: 'hidden' | 'limited' | 'full'
          case_studies?: Json | null
          preferred_formats?: string[] | null
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          website_url?: string | null
          contact_email?: string | null
          created_by?: string
          created_at?: string
          industry?: string | null
          company_size?: string | null
          brand_values?: Json | null
          preferred_visibility_options?: Json | null
          objectives_embedding?: number[] | null
          verification_status?: 'none' | 'pending' | 'verified' | 'revoked'
          public_visibility?: 'hidden' | 'limited' | 'full'
          case_studies?: Json | null
          preferred_formats?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsor_profiles: {
        Row: {
          id: string
          sponsor_id: string
          industry: string | null
          company_size: string | null
          annual_budget_cents: number | null
          brand_objectives: Json
          target_audience: Json
          preferred_categories: string[]
          regions: string[]
          activation_preferences: Json
          reputation_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sponsor_id: string
          industry?: string | null
          company_size?: string | null
          annual_budget_cents?: number | null
          brand_objectives: Json
          target_audience: Json
          preferred_categories?: string[]
          regions?: string[]
          activation_preferences: Json
          reputation_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sponsor_id?: string
          industry?: string | null
          company_size?: string | null
          annual_budget_cents?: number | null
          brand_objectives?: Json
          target_audience?: Json
          preferred_categories?: string[]
          regions?: string[]
          activation_preferences?: Json
          reputation_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_profiles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: true
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsor_public_profiles: {
        Row: {
          sponsor_id: string
          slug: string
          headline: string | null
          about: string | null
          brand_values: Json
          badges: string[]
          is_verified: boolean
          social_links: Json[]
          created_at: string
          updated_at: string
        }
        Insert: {
          sponsor_id: string
          slug: string
          headline?: string | null
          about?: string | null
          brand_values: Json
          badges?: string[]
          is_verified?: boolean
          social_links?: Json[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          sponsor_id?: string
          slug?: string
          headline?: string | null
          about?: string | null
          brand_values?: Json
          badges?: string[]
          is_verified?: boolean
          social_links?: Json[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_public_profiles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: true
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsor_members: {
        Row: {
          sponsor_id: string
          user_id: string
          role: 'owner' | 'admin' | 'editor' | 'viewer'
          created_at: string
        }
        Insert: {
          sponsor_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'editor' | 'viewer'
          created_at?: string
        }
        Update: {
          sponsor_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'editor' | 'viewer'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_members_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsorship_packages: {
        Row: {
          id: string
          event_id: string
          tier: string
          title: string | null
          description: string | null
          price_cents: number
          currency: string
          inventory: number
          sold: number
          benefits: Json
          visibility: string
          is_active: boolean
          created_at: string
          created_by: string | null
          expected_reach: number | null
          avg_engagement_score: number | null
          package_type: 'digital' | 'onsite' | 'hybrid' | null
          stat_snapshot_id: string | null
          quality_score: number | null
          quality_updated_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          tier: string
          title?: string | null
          description?: string | null
          price_cents: number
          currency?: string
          inventory?: number
          sold?: number
          benefits: Json
          visibility?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          expected_reach?: number | null
          avg_engagement_score?: number | null
          package_type?: 'digital' | 'onsite' | 'hybrid' | null
          stat_snapshot_id?: string | null
          quality_score?: number | null
          quality_updated_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          tier?: string
          title?: string | null
          description?: string | null
          price_cents?: number
          currency?: string
          inventory?: number
          sold?: number
          benefits?: Json
          visibility?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          expected_reach?: number | null
          avg_engagement_score?: number | null
          package_type?: 'digital' | 'onsite' | 'hybrid' | null
          stat_snapshot_id?: string | null
          quality_score?: number | null
          quality_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_packages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsorship_matches: {
        Row: {
          id: string
          event_id: string
          sponsor_id: string
          score: number
          overlap_metrics: Json
          status: 'pending' | 'suggested' | 'accepted' | 'rejected'
          viewed_at: string | null
          contacted_at: string | null
          declined_reason: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          sponsor_id: string
          score: number
          overlap_metrics: Json
          status?: 'pending' | 'suggested' | 'accepted' | 'rejected'
          viewed_at?: string | null
          contacted_at?: string | null
          declined_reason?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          sponsor_id?: string
          score?: number
          overlap_metrics?: Json
          status?: 'pending' | 'suggested' | 'accepted' | 'rejected'
          viewed_at?: string | null
          contacted_at?: string | null
          declined_reason?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_matches_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          }
        ]
      }
      proposal_threads: {
        Row: {
          id: string
          event_id: string
          sponsor_id: string
          status: 'draft' | 'sent' | 'counter' | 'accepted' | 'rejected' | 'expired'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          sponsor_id: string
          status?: 'draft' | 'sent' | 'counter' | 'accepted' | 'rejected' | 'expired'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          sponsor_id?: string
          status?: 'draft' | 'sent' | 'counter' | 'accepted' | 'rejected' | 'expired'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_threads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_threads_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      proposal_messages: {
        Row: {
          id: string
          thread_id: string
          sender_type: 'organizer' | 'sponsor'
          sender_user_id: string
          body: string | null
          offer: Json
          attachments: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          sender_type: 'organizer' | 'sponsor'
          sender_user_id: string
          body?: string | null
          offer: Json
          attachments?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          sender_type?: 'organizer' | 'sponsor'
          sender_user_id?: string
          body?: string | null
          offer?: Json
          attachments?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "proposal_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      deliverables: {
        Row: {
          id: string
          event_id: string
          sponsor_id: string
          type: string
          spec: Json
          due_at: string | null
          status: 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived'
          evidence_required: boolean
          created_at: string
          updated_at: string
          order_id: string | null
          package_id: string | null
          package_variant_id: string | null
        }
        Insert: {
          id?: string
          event_id: string
          sponsor_id: string
          type: string
          spec: Json
          due_at?: string | null
          status?: 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived'
          evidence_required?: boolean
          created_at?: string
          updated_at?: string
          order_id?: string | null
          package_id?: string | null
          package_variant_id?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          sponsor_id?: string
          type?: string
          spec?: Json
          due_at?: string | null
          status?: 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived'
          evidence_required?: boolean
          created_at?: string
          updated_at?: string
          order_id?: string | null
          package_id?: string | null
          package_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          }
        ]
      }
      deliverable_proofs: {
        Row: {
          id: string
          deliverable_id: string
          asset_url: string
          metrics: Json
          submitted_by: string | null
          submitted_at: string
          approved_at: string | null
          rejected_reason: string | null
        }
        Insert: {
          id?: string
          deliverable_id: string
          asset_url: string
          metrics: Json
          submitted_by?: string | null
          submitted_at?: string
          approved_at?: string | null
          rejected_reason?: string | null
        }
        Update: {
          id?: string
          deliverable_id?: string
          asset_url?: string
          metrics?: Json
          submitted_by?: string | null
          submitted_at?: string
          approved_at?: string | null
          rejected_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_proofs_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_proofs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsorship_orders: {
        Row: {
          id: string
          package_id: string
          sponsor_id: string
          event_id: string
          amount_cents: number
          status: 'pending' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string | null
          currency: string
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          stripe_transfer_id: string | null
          transfer_group: string | null
          application_fee_cents: number
          milestone: Json
          proof_assets: Json
          roi_report_id: string | null
          created_by_user_id: string | null
          last_modified_by: string | null
          version_number: number
          review_score: number | null
          organizer_stripe_account_id: string | null
          payout_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          payout_attempts: number
          last_payout_attempt_at: string | null
          payout_failure_reason: string | null
          contract_url: string | null
          escrow_state: 'pending' | 'funded' | 'locked' | 'released' | 'refunded' | null
          cancellation_policy: Json | null
          invoice_id: string | null
        }
        Insert: {
          id?: string
          package_id: string
          sponsor_id: string
          event_id: string
          amount_cents: number
          status?: 'pending' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string | null
          currency?: string
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          stripe_transfer_id?: string | null
          transfer_group?: string | null
          application_fee_cents?: number
          milestone: Json
          proof_assets: Json
          roi_report_id?: string | null
          created_by_user_id?: string | null
          last_modified_by?: string | null
          version_number?: number
          review_score?: number | null
          organizer_stripe_account_id?: string | null
          payout_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          payout_attempts?: number
          last_payout_attempt_at?: string | null
          payout_failure_reason?: string | null
          contract_url?: string | null
          escrow_state?: 'pending' | 'funded' | 'locked' | 'released' | 'refunded' | null
          cancellation_policy?: Json | null
          invoice_id?: string | null
        }
        Update: {
          id?: string
          package_id?: string
          sponsor_id?: string
          event_id?: string
          amount_cents?: number
          status?: 'pending' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string | null
          currency?: string
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          stripe_transfer_id?: string | null
          transfer_group?: string | null
          application_fee_cents?: number
          milestone?: Json
          proof_assets?: Json
          roi_report_id?: string | null
          created_by_user_id?: string | null
          last_modified_by?: string | null
          version_number?: number
          review_score?: number | null
          organizer_stripe_account_id?: string | null
          payout_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          payout_attempts?: number
          last_payout_attempt_at?: string | null
          payout_failure_reason?: string | null
          contract_url?: string | null
          escrow_state?: 'pending' | 'funded' | 'locked' | 'released' | 'refunded' | null
          cancellation_policy?: Json | null
          invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_orders_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          data: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          data: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          data?: Json
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_sponsorship_package_cards: {
        Row: {
          id: string
          event_id: string
          tier: string
          price_cents: number
          title: string | null
          description: string | null
          benefits: Json
          inventory: number
          sold: number
          is_active: boolean
          event_title: string
          start_at: string
          category: string | null
          total_views: number
          avg_dwell_ms: number
          tickets_sold: number
          conversion_rate: number
          engagement_score: number
          social_mentions: number
          sentiment_score: number
          final_quality_score: number
          quality_tier: string
          engagement_rate: number
          volume_score: number
          social_proof_score: number
          normalized_sentiment_score: number
        }
        Relationships: [
          {
            foreignKeyName: "v_sponsorship_package_cards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      v_event_performance_summary: {
        Row: {
          event_id: string
          event_title: string
          start_at: string
          category: string | null
          total_views: number
          avg_dwell_ms: number
          video_completions: number
          orders_count: number
          tickets_sold: number
          unique_visitors: number
          avg_watch_pct: number
          conversion_rate: number
          engagement_score: number
          social_mentions: number
          sentiment_score: number
        }
        Relationships: [
          {
            foreignKeyName: "v_event_performance_summary_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      get_sponsorship_analytics: {
        Args: {
          p_event_id?: string
          p_sponsor_id?: string
          p_from_date?: string
          p_to_date?: string
        }
        Returns: {
          total_matches: number
          accepted_matches: number
          conversion_rate: number
          avg_match_score: number
          total_revenue_cents: number
          avg_deal_size_cents: number
          top_categories: Json
          top_regions: Json
          performance_trends: Json
        }
      }
      search_sponsorships: {
        Args: {
          search_query: string
          category_filter?: string
          min_price?: number
          max_price?: number
          location_filter?: string
          quality_tier_filter?: string
          page_offset?: number
          page_limit?: number
        }
        Returns: {
          packages: Json
          events: Json
          sponsors: Json
          total: number
          facets: Json
        }
      }
      fn_compute_match_score: {
        Args: {
          p_event_id: string
          p_sponsor_id: string
        }
        Returns: number
      }
    }
    Enums: {
      sponsorship_status: 'pending' | 'completed' | 'cancelled'
      escrow_state: 'pending' | 'funded' | 'locked' | 'released' | 'refunded'
      payout_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
      deliverable_status: 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived'
      proposal_status: 'draft' | 'sent' | 'counter' | 'accepted' | 'rejected' | 'expired'
      match_status: 'pending' | 'suggested' | 'accepted' | 'rejected'
      package_type: 'digital' | 'onsite' | 'hybrid'
      activation_status: 'draft' | 'live' | 'completed' | 'evaluated'
      verification_status: 'none' | 'pending' | 'verified' | 'revoked'
      public_visibility: 'hidden' | 'limited' | 'full'
      sponsor_role: 'owner' | 'admin' | 'editor' | 'viewer'
      sender_type: 'organizer' | 'sponsor'
      quality_tier: 'low' | 'medium' | 'high' | 'premium'
      consent_scope: 'aggregated' | 'cohort' | 'pseudonymous'
    }
  }
}
