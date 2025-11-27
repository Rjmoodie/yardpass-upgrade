/**
 * Public API for the Posts feature
 * 
 * This is the single entry point for importing posts functionality.
 * External code should import from '@/features/posts', not from
 * internal subdirectories.
 */

// Components
export { PostCreatorModal } from './components/PostCreatorModal';
// Note: PostCreator.tsx is legacy and used only in App.tsx route /create-post
// TODO: Consider replacing with PostCreatorModal + usePostCreation in future

// Types
export type { PostCreationData, PostCreationResult } from './types';
export type { Post, PostRow } from '@/domain/posts';

