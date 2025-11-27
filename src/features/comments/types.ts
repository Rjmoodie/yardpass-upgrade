/**
 * Types for the Comments feature
 * 
 * Re-exports from the shared domain model to provide a feature-specific
 * import path. External code should import from '@/features/comments/types'
 * or use '@/features/comments' (barrel export).
 */

export type {
  Comment,
  Post,
  CommentRow,
  PostRow,
} from '@/domain/posts';

export type { RealtimeComment } from './hooks/useRealtimeComments';

