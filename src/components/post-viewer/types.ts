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

