// Shared Event and related types across the application

export interface EventPost {
  id: string;
  authorName: string;
  authorBadge: 'ORGANIZER' | 'ATTENDEE';
  isOrganizer?: boolean;

  // Used for profile deep-linking (Index/PostHero)
  authorId?: string;

  content: string;
  timestamp: string;
  likes: number;

  // Media (hero/rail choose first media)
  mediaType?: 'image' | 'video' | 'none';
  /** May be "mux:<playbackId>" or a direct URL (.m3u8/.mp4/.jpg, etc.) */
  mediaUrl?: string;
  thumbnailUrl?: string;

  commentCount?: number;

  // Ticket deep-links/badging (present in feed mapping)
  ticketTierId?: string;
  ticketBadge?: string;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;

  // Dates
  startAtISO: string;   // raw ISO
  endAtISO?: string;
  dateLabel: string;    // e.g. "Sept 2, 2024"

  // Location / media
  location: string;
  coverImage: string;
  videoUrl?: string;

  // Tickets
  ticketTiers: TicketTier[];
  /** Lowest current price (used by EventCTA) */
  minPrice?: number | null;
  /** Remaining inventory across tiers (used by EventCTA) */
  remaining?: number | null;

  // Social
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
  totalComments?: number;

  // Feed/posts
  posts?: EventPost[];

  // Ranking / routing / trust
  latestActivityAt?: number;
  slug?: string;
  organizerVerified?: boolean;
}

// Database-specific interfaces (for Supabase queries)
export interface DatabaseTicketTier {
  id: string;
  name: string;
  price_cents: number;
  badge_label?: string;
  quantity: number; // map to TicketTier.total; derive available from sales
}

export interface DatabaseEvent {
  id: string;
  title: string;
  description: string;
  organizer_id: string;
  category: string;
  start_at: string;
  city?: string;
  venue?: string;
  cover_image_url?: string;
  ticket_tiers?: DatabaseTicketTier[];
}