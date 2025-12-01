// src/components/post-viewer/types.ts
// NOTE: This file temporarily re-exports from domain during migration.
// TODO: Remove this file once migration is complete - use @/domain/posts directly.

// Re-export from domain (single source of truth)
export type {
  Comment,
  CommentRow,
  Post,
  PostRow,
} from '@/domain/posts';

import type { Post } from '@/domain/posts';

/** Reference to a post with its event context - enables mixed-event sequences (e.g. profile page) */
export type PostRef = { id: string; eventId: string };

/** Post with required event_id for the viewer shell */
export type ViewerPost = Post & { event_id: string };
