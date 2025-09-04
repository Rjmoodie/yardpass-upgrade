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
        ]
      }
      event_posts: {
        Row: {
          author_user_id: string
          created_at: string | null
          event_id: string
          id: string
          media_urls: string[] | null
          text: string | null
          ticket_tier_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_user_id: string
          created_at?: string | null
          event_id: string
          id?: string
          media_urls?: string[] | null
          text?: string | null
          ticket_tier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_user_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          media_urls?: string[] | null
          text?: string | null
          ticket_tier_id?: string | null
          updated_at?: string | null
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
            foreignKeyName: "event_posts_ticket_tier_id_fkey"
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
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          handle: string | null
          id: string
          logo_url: string | null
          name: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          handle?: string | null
          id?: string
          logo_url?: string | null
          name: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          handle?: string | null
          id?: string
          logo_url?: string | null
          name?: string
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
            foreignKeyName: "scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
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
          sort_index: number | null
          status: string | null
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
          sort_index?: number | null
          status?: string | null
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
          sort_index?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string
          phone: string | null
          photo_url: string | null
          role: string | null
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
      [_ in never]: never
    }
    Functions: {
      can_current_user_post: {
        Args: { p_event_id: string }
        Returns: boolean
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
      get_event_scans_daily: {
        Args: { p_event_ids: string[]; p_from_date: string; p_to_date: string }
        Returns: {
          d: string
          dupes: number
          event_id: string
          scans: number
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
      refresh_analytics_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      event_visibility: "public" | "unlisted" | "private"
      order_status: "pending" | "paid" | "refunded" | "canceled"
      org_role: "viewer" | "editor" | "admin" | "owner"
      owner_context: "individual" | "organization"
      ticket_status: "issued" | "transferred" | "refunded" | "redeemed" | "void"
      verification_status: "none" | "pending" | "verified" | "pro"
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
      event_visibility: ["public", "unlisted", "private"],
      order_status: ["pending", "paid", "refunded", "canceled"],
      org_role: ["viewer", "editor", "admin", "owner"],
      owner_context: ["individual", "organization"],
      ticket_status: ["issued", "transferred", "refunded", "redeemed", "void"],
      verification_status: ["none", "pending", "verified", "pro"],
    },
  },
} as const
