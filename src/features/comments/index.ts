/**
 * Public API for the Comments feature
 * 
 * This is the single entry point for importing comments functionality.
 * External code should import from '@/features/comments', not from
 * internal subdirectories.
 */

// Components
export { default as CommentModal } from './components/CommentModal';
export { CommentsSheet } from './components/CommentsSheet';
export { CommentItem } from './components/CommentItem';

// Hooks
export { useCommentActions } from './hooks/useCommentActions';
export { useRealtimeComments } from './hooks/useRealtimeComments';

// Types (re-export from domain)
export type { Comment, Post, CommentRow, PostRow } from '@/domain/posts';
export type { RealtimeComment } from './hooks/useRealtimeComments';

