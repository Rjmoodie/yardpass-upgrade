/**
 * Types for the Posts feature
 * 
 * Re-exports from the shared domain model and provides feature-specific types.
 */

// Re-export domain types
export type { Post, PostRow } from '@/domain/posts';

// Feature-specific types
export type PostCreationData = {
  text: string;
  media_urls?: string[];
  event_id: string;
  ticket_tier_id?: string | null;
};

export type PostCreationResult = {
  success: boolean;
  post_id?: string;
  error?: string;
};

