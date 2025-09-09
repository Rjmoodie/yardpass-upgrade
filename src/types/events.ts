// src/types/events.ts
export type AuthorBadge = 'ORGANIZER' | 'ATTENDEE';

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

export interface EventPost {
  id: string;
  authorName: string;
  authorBadge: AuthorBadge;
  isOrganizer?: boolean;
  content: string;
  timestamp: string;
  likes: number;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;       // mux:playbackId or direct URL
  thumbnailUrl?: string;
  commentCount?: number;
  authorId?: string;
  ticketTierId?: string;
  ticketBadge?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;
  startAtISO: string;
  endAtISO?: string;
  dateLabel: string;
  location: string;
  coverImage: string;
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
  posts?: EventPost[];
  organizerVerified?: boolean;
  minPrice?: number | null;
  remaining?: number | null;
}