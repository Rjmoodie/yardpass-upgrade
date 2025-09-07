// Shared Event and related types across the application

export interface EventPost { 
  id: string; 
  authorName: string; 
  authorBadge: 'ORGANIZER' | 'ATTENDEE'; 
  isOrganizer?: boolean; 
  content: string; 
  timestamp: string; 
  likes: number; 
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  thumbnailUrl?: string;
  commentCount?: number;
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
  startAtISO: string; // raw ISO string
  endAtISO?: string;
  dateLabel: string; // "Sept 2, 2024" display string
  location: string; 
  coverImage: string; 
  ticketTiers: TicketTier[]; 
  attendeeCount: number; 
  likes: number; 
  shares: number; 
  isLiked?: boolean; 
  posts?: EventPost[];
  latestActivityAt?: number; // timestamp for activity-based sorting
  slug?: string; // for URL routing
  videoUrl?: string; // for video content
  totalComments?: number; // total comment count for the event
}

// Database-specific interfaces (for Supabase queries)
export interface DatabaseTicketTier { 
  id: string; 
  name: string; 
  price_cents: number; 
  badge_label?: string; 
  quantity: number; 
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
