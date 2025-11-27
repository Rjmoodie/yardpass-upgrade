/**
 * Core domain types for Posts and Comments
 * 
 * This is the single source of truth for Post/Comment types shared across
 * features/comments and features/posts. Features should re-export these
 * types rather than redefining them to avoid circular dependencies.
 */

// Database row types (raw database structure)
export type PostRow = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;
  ticket_tier_id: string | null;
};

export type CommentRow = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  post_id: string;
};

// Domain model types (enriched with UI data)
export type Comment = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
  likes_count: number;
  is_liked: boolean;
  pending?: boolean;
  client_id?: string;
  is_pinned?: boolean;
  parent_comment_id?: string | null;
  mentions?: string[];
  reply_count?: number;
  replies?: Comment[];
  post_id?: string;
};

export type Post = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[];
  author_name?: string | null;
  author_avatar?: string | null;
  author_badge?: string | null;
  author_is_organizer?: boolean;
  comments: Comment[];
  likes_count: number;
  is_liked: boolean;
  comment_count: number;
};


