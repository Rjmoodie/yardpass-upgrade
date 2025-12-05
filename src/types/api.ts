/**
 * API Type Contracts
 * 
 * These types define the exact shape of data exchanged between:
 * - Edge Functions (Supabase)
 * - Frontend API clients
 * - UI Components
 * 
 * ⚠️ CRITICAL: Keep these in sync with Edge Function responses.
 */

/**
 * Response from posts-create Edge Function
 */
export interface PostCreationResponse {
  success: true;
  post: FeedItemPost;
  event_title: string;
}

/**
 * Post item formatted for feed display
 * This is the canonical shape expected by all feed components.
 */
export interface FeedItemPost {
  // Core identity
  item_type: 'post';
  item_id: string;
  event_id: string;
  created_at_ts: number;
  
  // Author information
  author: {
    id: string;
    display_name: string;
    username: string | null;
    photo_url: string | null;
  };
  
  // Content
  content: {
    text: string;
    media: MediaItem[];
  };
  
  // Engagement metrics
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
    viewer_has_liked: boolean;
  };
  
  // Associated event (optional)
  event: {
    id: string;
    title: string;
    cover_image_url: string | null;
  } | null;
  
  // Processing state (for videos)
  processing?: {
    status: 'ready' | 'processing' | 'uploading' | 'failed';
    progress?: number;
    message?: string;
  };
  
  // Ticket tier badge (if author has ticket)
  ticket_tier?: {
    id: string;
    name: string;
    badge_label: string;
  } | null;
  
  // Flag for optimistic updates (client-side only, not from server)
  isOptimistic?: boolean;
}

/**
 * Media item in a post
 */
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  thumbnail: string;
  width?: number;
  height?: number;
  duration?: number; // For videos, in seconds
}

/**
 * Event item formatted for feed display
 */
export interface FeedItemEvent {
  item_type: 'event';
  item_id: string;
  created_at_ts: number;
  
  event: {
    id: string;
    title: string;
    description: string;
    start_at: string;
    end_at: string | null;
    city: string;
    venue: string | null;
    cover_image_url: string | null;
    category: string;
  };
  
  organizer: {
    id: string;
    display_name: string;
    photo_url: string | null;
  };
  
  metrics: {
    attendees: number;
    posts: number;
    likes: number;
    viewer_has_ticket: boolean;
    viewer_is_following: boolean;
  };
  
  ticket_tiers?: Array<{
    id: string;
    name: string;
    price_cents: number;
    available_quantity: number;
  }>;
  
  // For promoted/boosted events
  promotion?: {
    campaign_id: string;
    boost_score: number;
  };
}

/**
 * Union type for all feed items
 */
export type FeedItem = FeedItemPost | FeedItemEvent;

/**
 * Feed page response from home-feed Edge Function
 */
export interface FeedPage {
  items: FeedItem[];
  nextCursor: {
    cursorTs: number;
    cursorId: string;
    cursorScore?: number;
  } | null;
}

/**
 * Feed cursor for pagination
 */
export interface FeedCursor {
  cursorTs: number;
  cursorId: string;
  cursorScore?: number;
}

/**
 * Upload progress update
 */
export interface UploadProgress {
  fileIndex: number;
  progress: number; // 0-100
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  errorMsg?: string;
}

/**
 * Error response from Edge Functions
 */
export interface ApiErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

