# 🚀 Migration Plans - Week 2 Focus

> **Created**: January 28, 2025  
> **Updated**: January 28, 2025 (Improved for safety, consistency, and realism)  
> **Status**: Ready for Implementation  
> **Priority**: High

---

## 📋 Overview

This document outlines detailed implementation plans for three high-priority tasks:

1. **Complete Comments Migration** → `features/comments/`
2. **Complete Post Creator Migration** → `features/posts/`
3. **Continue Video/HLS Stability** (Instrumentation + Focused Improvements)

### 🎯 Core Principles

- **Safety First**: Incremental changes, clear rollback points, automated checks
- **Consistency**: Shared patterns across features, unified domain model
- **Realistic Scope**: Focused improvements with measurable outcomes

---

## 🏗️ Shared Domain Model

**Before starting any migration**, we need to establish shared types to avoid circular dependencies.

### Create `src/domain/posts.ts`

This module will own the core domain types shared between comments and posts features.

**File**: `src/domain/posts.ts`
```typescript
// Core domain types - single source of truth
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
```

### Feature Types Re-export Pattern

Both `features/comments/types.ts` and `features/posts/types.ts` will re-export from domain:

```typescript
// features/comments/types.ts
export type {
  Comment,
  CommentRow,
  Post,
  PostRow,
} from '@/domain/posts';

// Feature-specific types only
export type CommentCreationData = {
  text: string;
  post_id: string;
  parent_comment_id?: string | null;
};
```

This ensures:
- ✅ No circular dependencies (features → domain, not features → features)
- ✅ Single source of truth for core types
- ✅ Features can extend types as needed

---

## 1️⃣ Complete Comments Migration

**Priority**: 🟡 High  
**Estimated Time**: 1-2 days  
**Dependencies**: None

### 🎯 Goal

Move all comment-related components, hooks, and types into a feature module (`features/comments/`) to improve code organization and maintainability.

### 📁 Current File Locations

#### Components:
- `src/components/CommentModal.tsx` (374 lines)
- `src/components/post-viewer/CommentsSheet.tsx` (391 lines)
- `src/components/post-viewer/CommentItem.tsx` (exists)

#### Hooks:
- `src/components/post-viewer/useCommentActions.ts` (exists)
- `src/hooks/useRealtimeComments.ts` (exists)

#### Types:
- `src/components/post-viewer/types.ts` (contains Comment, Post types)

### 🎯 Target Structure

```
src/features/comments/
├── index.ts                    # Public API exports
├── components/
│   ├── CommentModal.tsx        # Legacy modal (for feed)
│   ├── CommentsSheet.tsx       # Bottom sheet (for FullscreenPostViewer)
│   └── CommentItem.tsx         # Individual comment component
├── hooks/
│   ├── useCommentActions.ts    # Comment CRUD operations
│   └── useRealtimeComments.ts  # Realtime subscription hook
├── api/
│   └── comments.ts             # API calls (if needed, extract from hooks)
└── types.ts                    # Comment & Post types
```

### 📝 Detailed Migration Steps

**🎯 Two-Step Rollout Strategy**

To minimize risk and make debugging easier:

1. **Step 1: Move files only** (PR 1) - Pure file moves with minimal changes
2. **Step 2: Refactor internals** (PR 2) - Extract APIs, add tests, optimize

---

#### Phase 0: Setup Shared Domain (Do this first!)

**Before any migration**, create the shared domain types:

1. **Create `src/domain/posts.ts`**
   - Copy types from `src/components/post-viewer/types.ts`
   - Export `Post`, `PostRow`, `Comment`, `CommentRow`
   - This is the single source of truth

2. **Update existing files to use domain types**
   - Update `src/components/post-viewer/types.ts` to re-export from domain
   - Or delete it if we fully migrate

---

#### Phase 1: Preparation & Structure Setup (Step 1)

3. **Create directory structure**
   ```bash
   mkdir -p src/features/comments/{components,hooks,api}
   ```

4. **Create `src/features/comments/types.ts`**
   ```typescript
   // Re-export domain types
   export type {
     Comment,
     CommentRow,
     Post,
     PostRow,
   } from '@/domain/posts';

   // Feature-specific types only
   export type CommentCreationData = {
     text: string;
     post_id: string;
     parent_comment_id?: string | null;
   };
   ```

---

#### Phase 2: Move Files Only (Step 1 - Use `git mv`)

**Important**: Use `git mv` to preserve history, not copy+delete!

5. **Move `CommentModal.tsx`** (git mv)
   ```bash
   git mv src/components/CommentModal.tsx src/features/comments/components/CommentModal.tsx
   ```
   - Update internal imports to use relative paths (`./hooks/...`, `./types`)
   - Update `useRealtimeComments` import to `./hooks/useRealtimeComments`
   - **Don't refactor yet** - just fix import paths

6. **Move `CommentsSheet.tsx`** (git mv)
   ```bash
   git mv src/components/post-viewer/CommentsSheet.tsx src/features/comments/components/CommentsSheet.tsx
   ```
   - Update imports to relative paths within feature:
     - `./hooks/useCommentActions`
     - `./components/CommentItem`
     - `./types`
   - **Keep paths relative** within the feature folder

7. **Move `CommentItem.tsx`** (git mv)
   ```bash
   git mv src/components/post-viewer/CommentItem.tsx src/features/comments/components/CommentItem.tsx
   ```
   - Update type imports to `./types` (relative)

8. **Move `useCommentActions.ts`** (git mv)
   ```bash
   git mv src/components/post-viewer/useCommentActions.ts src/features/comments/hooks/useCommentActions.ts
   ```
   - Update type imports to `../types` (relative)

9. **Move `useRealtimeComments.ts`** (git mv)
   ```bash
   git mv src/hooks/useRealtimeComments.ts src/features/comments/hooks/useRealtimeComments.ts
   ```
   - Update type imports to `../types` (relative)

---

#### Phase 3: Create Minimal Public API (Step 1)

10. **Create `src/features/comments/index.ts`**
    ```typescript
    // Public API - only what other features should use
    export { default as CommentModal } from './components/CommentModal';
    export { CommentsSheet } from './components/CommentsSheet';
    export { useCommentActions } from './hooks/useCommentActions';
    export { useRealtimeComments } from './hooks/useRealtimeComments';
    
    // Types re-exported from domain
    export type { Comment, Post, CommentRow, PostRow } from './types';
    ```
    
    **Rule**: Internal-only components (e.g., `CommentItem`) are NOT exported - they're implementation details.

---

#### Phase 4: Update External Imports (Step 1)

11. **Find all files importing comment components**
    - Run: `grep -r "from.*CommentModal\|from.*CommentsSheet\|from.*useCommentActions\|from.*useRealtimeComments" src/`
    - Files to update:
      - `src/features/feed/routes/FeedPageNewDesign.tsx`
      - `src/features/feed/components/UnifiedFeedList.tsx`
      - `src/pages/new-design/EventDetailsPage.tsx`
      - `src/pages/new-design/ProfilePage.tsx`
      - `src/features/profile/routes/ProfilePage.tsx`
      - `src/components/EventFeed.tsx`
      - `src/components/Perf/DeferredImports.tsx`
      - `src/components/post-viewer/FullscreenPostViewer.tsx`

12. **Update imports to use feature barrel export**
    ```typescript
    // OLD
    import CommentModal from '@/components/CommentModal';
    import { CommentsSheet } from '@/components/post-viewer/CommentsSheet';
    import { useRealtimeComments } from '@/hooks/useRealtimeComments';
    
    // NEW (always use barrel export from outside the feature)
    import { CommentModal, CommentsSheet, useRealtimeComments } from '@/features/comments';
    ```

13. **Update lazy imports**
    - `src/components/Perf/DeferredImports.tsx`:
      ```typescript
      import('@/features/comments').catch(() => {});
      ```

**🎯 Commit Point**: Commit Step 1 as "Move comment components to features/comments (file moves only)"

---

#### Phase 5: Internal Refactoring (Step 2 - Separate PR)

14. **Update internal imports to use relative paths**
    - Within `features/comments/`, prefer relative imports:
      - `./hooks/useCommentActions` ✅
      - `@/features/comments/hooks/useCommentActions` ❌ (avoid)
    - Only use absolute imports for things outside the feature

15. **Extract API layer (optional, if needed)**
    - Create `src/features/comments/api/comments.ts`
    - Extract API calls from hooks if they're complex
    - This is optional - keep it simple if hooks are already clean

---

#### Phase 6: Add Minimal Automated Tests (Step 2)

16. **Create `src/features/comments/hooks/__tests__/useCommentActions.test.ts`**
    ```typescript
    import { renderHook, waitFor } from '@testing-library/react';
    import { useCommentActions } from '../useCommentActions';
    
    describe('useCommentActions', () => {
      it('calls API when adding comment', async () => {
        // Minimal test - verify API is called with correct params
      });
      
      it('handles errors gracefully', async () => {
        // Test error states
      });
    });
    ```

17. **Create `src/features/comments/hooks/__tests__/useRealtimeComments.test.ts`**
    ```typescript
    describe('useRealtimeComments', () => {
      it('subscribes to realtime updates', () => {
        // Verify subscription setup
      });
      
      it('cleans up subscription on unmount', () => {
        // Verify cleanup
      });
    });
    ```
    
    **Goal**: Just enough tests to catch regressions during refactors.

#### Phase 3: Move Hooks

7. **Move `useCommentActions.ts`**
   - Copy from `src/components/post-viewer/useCommentActions.ts`
   - Move to `src/features/comments/hooks/useCommentActions.ts`
   - Update type imports

8. **Move `useRealtimeComments.ts`**
   - Copy from `src/hooks/useRealtimeComments.ts`
   - Move to `src/features/comments/hooks/useRealtimeComments.ts`
   - Update any internal imports

#### Phase 4: Create Public API

9. **Create `src/features/comments/index.ts`**
   ```typescript
   // Public API exports
   export { default as CommentModal } from './components/CommentModal';
   export { CommentsSheet } from './components/CommentsSheet';
   export { CommentItem } from './components/CommentItem';
   export { useCommentActions } from './hooks/useCommentActions';
   export { useRealtimeComments } from './hooks/useRealtimeComments';
   export type { Comment, Post, CommentRow, PostRow } from './types';
   ```

#### Phase 5: Update All Imports

10. **Find all files importing comment components**
    - Files to update (found via grep):
      - `src/features/feed/routes/FeedPageNewDesign.tsx`
      - `src/features/feed/components/UnifiedFeedList.tsx`
      - `src/pages/new-design/EventDetailsPage.tsx`
      - `src/pages/new-design/ProfilePage.tsx`
      - `src/features/profile/routes/ProfilePage.tsx`
      - `src/components/EventFeed.tsx`
      - `src/components/Perf/DeferredImports.tsx` (lazy import)
      - `src/components/post-viewer/FullscreenPostViewer.tsx`

11. **Update imports in each file**
    ```typescript
    // OLD
    import CommentModal from '@/components/CommentModal';
    import { CommentsSheet } from '@/components/post-viewer/CommentsSheet';
    import { useRealtimeComments } from '@/hooks/useRealtimeComments';
    
    // NEW
    import { CommentModal, CommentsSheet, useRealtimeComments } from '@/features/comments';
    ```

12. **Update lazy imports**
    - `src/components/Perf/DeferredImports.tsx`:
      ```typescript
      import('@/features/comments').catch(() => {});
      ```

---

#### Phase 7: Manual Testing (After Step 1 & 2)

18. **Test in Feed**
    - Open feed
    - Click comment icon on post
    - Verify `CommentModal` opens correctly
    - Add a comment
    - Verify comment appears immediately
    - Close modal

19. **Test in Event Pages**
    - Navigate to event details page
    - Open comments on a post
    - Verify comments load
    - Add a comment
    - Verify realtime updates work

20. **Test in Profile Pages**
    - Navigate to profile page
    - Open comments on a post
    - Verify `FullscreenPostViewer` uses `CommentsSheet` correctly
    - Add a comment
    - Verify comment appears

21. **Test in FullscreenPostViewer**
    - Open a post in `FullscreenPostViewer`
    - Open comments sheet
    - Verify comments load
    - Add a comment
    - Verify realtime updates work
    - Verify pin/unpin works (if organizer)

---

#### Phase 8: Cleanup (After both steps are merged)

22. **Delete old type file (if fully migrated)**
    - `src/components/post-viewer/types.ts` - only if all types are in domain

23. **Verify no broken imports**
    - Run: `grep -r "from.*CommentModal\|from.*CommentsSheet\|from.*useCommentActions\|from.*useRealtimeComments" src/`
    - All should use `@/features/comments` barrel export

### 🧪 Testing Checklist

#### Automated Tests
- [ ] `useCommentActions` unit tests pass
- [ ] `useRealtimeComments` unit tests pass
- [ ] CI passes (lint, type check, tests)

#### Manual Testing
- [ ] Comments work in feed (`CommentModal`)
- [ ] Comments work in event pages (`CommentModal`)
- [ ] Comments work in profile pages (`FullscreenPostViewer` + `CommentsSheet`)
- [ ] Realtime updates work (comments appear instantly)
- [ ] Comment likes work
- [ ] Comment replies work (if implemented)
- [ ] Comment pinning works (organizer)
- [ ] Comment deletion works (author)
- [ ] No console errors
- [ ] No TypeScript errors

### ⚠️ Potential Issues & Solutions

1. **Circular Dependencies**
   - **Issue**: `usePostWithComments` imports comment types
   - **Solution**: ✅ Already solved - shared types live in `@/domain/posts`, not in feature modules

2. **Lazy Imports**
   - **Issue**: `DeferredImports.tsx` uses dynamic import
   - **Solution**: Update to `import('@/features/comments')` - works because we export from index.ts

3. **Type Conflicts**
   - **Issue**: Multiple type definitions for Comment/Post
   - **Solution**: ✅ Already solved - single source of truth in `@/domain/posts`

### 📊 Success Criteria (Definition of Done)

- ✅ All comment components live in `features/comments/`
- ✅ All external imports use `@/features/comments` barrel export
- ✅ Internal imports use relative paths within feature
- ✅ Shared types live in `@/domain/posts`
- ✅ At least 2 automated tests added (hooks)
- ✅ CI passes (lint, type check, tests)
- ✅ Manual testing checklist completed
- ✅ No broken functionality
- ✅ Git history preserved (used `git mv`)

---

## 2️⃣ Complete Post Creator Migration

**Priority**: 🟡 High  
**Estimated Time**: 1 day  
**Dependencies**: Shared domain types should exist first (from Phase 0)

### 🎯 Goal

Move all post creation logic into a feature module (`features/posts/`) with clear separation of UI and business logic.

### 📁 Current File Locations

#### Components:
- `src/components/PostCreatorModal.tsx` (exists - main UI)
- `src/components/PostCreator.tsx` (exists - **needs investigation**)

#### Related Files:
- `src/components/post-viewer/usePostWithComments.ts` (stays in post-viewer - it's about viewing, not creating)

### 🎯 Target Structure

```
src/features/posts/
├── index.ts                    # Public API exports (barrel)
├── components/
│   └── PostCreatorModal.tsx    # UI only - delegates to usePostCreation
├── hooks/
│   └── usePostCreation.ts      # Single entry point for all post creation logic
├── api/
│   └── posts.ts                # API calls (called by hook)
└── types.ts                    # Re-exports from @/domain/posts + feature-specific types
```

**Key Principle**: `usePostCreation` is the single source of truth for post creation logic. The modal is just UI.

### 📝 Detailed Migration Steps

**🎯 Two-Step Rollout Strategy** (same as comments)

1. **Step 1: Move files only** - Pure file moves
2. **Step 2: Extract business logic** - Create `usePostCreation` hook, extract API

---

#### Phase 0: Shared Domain Types (Done in Comments Migration)

- Types already exist in `@/domain/posts` ✅

---

#### Phase 1: Investigation & Legacy Decision

1. **Audit existing files**
   - Check `src/components/PostCreatorModal.tsx` - inspect current implementation
   - Check `src/components/PostCreator.tsx` - determine if it's actively used
   - Run: `grep -r "PostCreator[^M]" src/` to find all usages

2. **Make explicit decision about `PostCreator.tsx`**
   
   **Option A: It's unused → Delete it now**
   - Document in PR: "PostCreator.tsx was unused legacy code, removed"
   - Don't migrate it

   **Option B: It's used in one place → Replace usage**
   - Replace that usage with `PostCreatorModal + usePostCreation`
   - Delete `PostCreator.tsx`

   **Option C: It's actively used → Migrate it**
   - Move to `features/posts/components/PostCreator.tsx`
   - Add `// TODO: Consider removing in favor of PostCreatorModal` comment
   - Document in PR why we're keeping it

3. **Find all imports**
   - Files importing `PostCreatorModal`:
     - `src/features/feed/routes/FeedPageNewDesign.tsx`
     - `src/features/feed/components/UnifiedFeedList.tsx`
     - `src/components/MainFeed.tsx`
     - `src/components/nav/BottomTabs.tsx`
     - `src/App.tsx` (lazy import)

4. **Document Edge Functions / API calls**
   - Find which Edge Functions are called for post creation
   - Document in migration notes for later extraction

---

#### Phase 2: Create Directory Structure (Step 1)

5. **Create directories**
   ```bash
   mkdir -p src/features/posts/{components,hooks,api}
   ```

6. **Create `src/features/posts/types.ts`**
   ```typescript
   // Re-export domain types
   export type { Post, PostRow } from '@/domain/posts';

   // Feature-specific types
   export type PostCreationData = {
     text: string;
     media_urls?: string[];
     event_id?: string;
     ticket_tier_id?: string | null;
   };

   export type PostCreationResult = {
     success: boolean;
     post_id?: string;
     error?: string;
   };
   ```

---

#### Phase 3: Move Files Only (Step 1 - Use `git mv`)

7. **Move `PostCreatorModal.tsx`** (git mv)
   ```bash
   git mv src/components/PostCreatorModal.tsx src/features/posts/components/PostCreatorModal.tsx
   ```
   - Update internal imports (use relative paths)
   - **Don't refactor yet** - just fix import paths
   - Keep all business logic inside the component for now

8. **Move `PostCreator.tsx`** (only if decided to migrate)
   ```bash
   git mv src/components/PostCreator.tsx src/features/posts/components/PostCreator.tsx
   ```
   - Or delete it if it's unused (see Phase 1 decision)

---

#### Phase 4: Create Minimal Public API (Step 1)

9. **Create `src/features/posts/index.ts`**
   ```typescript
   // Public API - only what other features should use
   export { PostCreatorModal } from './components/PostCreatorModal';
   // Only export PostCreator if we migrated it
   // export { PostCreator } from './components/PostCreator';
   
   // Types
   export type { PostCreationData, PostCreationResult } from './types';
   ```

---

#### Phase 5: Update External Imports (Step 1)

10. **Update imports in all files**
    - `src/features/feed/routes/FeedPageNewDesign.tsx`
    - `src/features/feed/components/UnifiedFeedList.tsx`
    - `src/components/MainFeed.tsx`
    - `src/components/nav/BottomTabs.tsx`
    - `src/App.tsx` (lazy import)

    ```typescript
    // OLD
    import { PostCreatorModal } from '@/components/PostCreatorModal';
    
    // NEW (always use barrel export)
    import { PostCreatorModal } from '@/features/posts';
    ```

**🎯 Commit Point**: Commit Step 1 as "Move post creator components to features/posts (file moves only)"

---

#### Phase 6: Extract Business Logic (Step 2 - Separate PR)

11. **Create `src/features/posts/api/posts.ts`**
    ```typescript
    import { supabase } from '@/integrations/supabase/client';

    export async function createPost(data: PostCreationData): Promise<PostCreationResult> {
      // Extract all API/Edge Function calls here
      // Handle media uploads
      // Handle errors
    }
    ```

12. **Create `src/features/posts/hooks/usePostCreation.ts`**
    ```typescript
    // Single entry point for all post creation logic
    export function usePostCreation() {
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [error, setError] = useState<string | null>(null);
      
      const createPost = useCallback(async (data: PostCreationData) => {
        // Validation
        // Media upload orchestration
        // Call API
        // Error handling
        // Return result
      }, []);
      
      return {
        createPost,
        isSubmitting,
        error,
        reset: () => setError(null),
      };
    }
    ```

13. **Refactor `PostCreatorModal.tsx`**
    - Remove all business logic
    - Use `usePostCreation` hook for everything
    - Modal becomes pure UI/presentation layer
    - Example:
      ```typescript
      const { createPost, isSubmitting, error } = usePostCreation();
      
      const handleSubmit = async (data) => {
        const result = await createPost(data);
        if (result.success) {
          onClose();
          onSuccess?.(result.post_id);
        }
      };
      ```

**Benefits**:
- ✅ Post creation logic is testable without UI
- ✅ Reusable if we need different UI later
- ✅ Clear separation of concerns

---

#### Phase 7: Add Tests (Step 2)

14. **Create `src/features/posts/hooks/__tests__/usePostCreation.test.ts`**
    ```typescript
    describe('usePostCreation', () => {
      it('validates post data before submission', () => {
        // Test validation logic
      });
      
      it('calls API with correct data', async () => {
        // Test API integration
      });
      
      it('handles media uploads', async () => {
        // Test media upload flow
      });
      
      it('handles errors gracefully', async () => {
        // Test error states
      });
    });
    ```

---

#### Phase 8: Manual Testing (After Step 1 & 2)

15. **Test post creation from feed**
    - Open feed
    - Click "Create Post" button
    - Verify modal opens
    - Create a text post
    - Verify post appears in feed

16. **Test post creation with media**
    - Create a post with an image
    - Create a post with a video
    - Verify media uploads correctly
    - Verify post appears with media

17. **Test post creation from event page**
    - Navigate to event details
    - Create a post from event context
    - Verify post is associated with event
    - Verify post appears in event feed

---

#### Phase 9: Cleanup (After both steps are merged)

18. **Verify no broken imports**
    - Run: `grep -r "from.*PostCreator" src/`
    - All should use `@/features/posts` barrel export

### 🧪 Testing Checklist

#### Automated Tests
- [ ] `usePostCreation` unit tests pass
- [ ] CI passes (lint, type check, tests)

#### Manual Testing
- [ ] Post creation modal opens correctly
- [ ] Text posts can be created
- [ ] Image posts can be created
- [ ] Video posts can be created (if supported)
- [ ] Posts appear in feed after creation
- [ ] Posts appear in event feed after creation
- [ ] Media uploads work correctly
- [ ] Error handling works (network errors, etc.)
- [ ] Form validation works
- [ ] No console errors

### ⚠️ Potential Issues & Solutions

1. **Legacy `PostCreator.tsx`**
   - **Issue**: May be old/unused component
   - **Solution**: ✅ Explicitly decide in Phase 1 - delete if unused, migrate if needed

2. **Media Upload Logic**
   - **Issue**: Complex media upload handling
   - **Solution**: ✅ Extract to `api/posts.ts` - clean separation

3. **Edge Function Integration**
   - **Issue**: Post creation may call Edge Functions
   - **Solution**: ✅ Document in `api/posts.ts` - clear API boundary

### 📊 Success Criteria (Definition of Done)

- ✅ All post creation components live in `features/posts/`
- ✅ All external imports use `@/features/posts` barrel export
- ✅ Business logic extracted to `usePostCreation` hook
- ✅ API calls extracted to `api/posts.ts`
- ✅ Modal is pure UI (delegates to hook)
- ✅ At least 1 automated test added (`usePostCreation`)
- ✅ CI passes (lint, type check, tests)
- ✅ Manual testing checklist completed
- ✅ Legacy code explicitly handled (deleted or documented)
- ✅ Git history preserved (used `git mv`)

---

## 3️⃣ Continue Video/HLS Stability - Week 2 Focus

**Priority**: 🟡 High  
**Estimated Time**: 2 days (realistic scope)  
**Dependencies**: None

### 🎯 Goal (Week 2 Focus)

**Realistic scope for 2 days**: Add production observability, fix 1-2 highest-impact issues, validate on primary device targets.

**Not doing this week**: Full cross-browser testing, network simulation, comprehensive performance optimization (those come later).

### 📊 Current State

**Known video components**:
- `src/components/feed/VideoMedia.tsx` - Feed videos (uses MuxPlayer)
- `src/components/post-viewer/FullscreenPostViewer.tsx` - Fullscreen viewer
- `src/hooks/useHlsVideo.ts`, `useSmartHlsVideo.ts` - HLS hooks

**Suspected issues** (to confirm with instrumentation):
- Playback failures not being logged
- HLS.js errors happening silently
- Memory leaks from unmounted videos
- Slow playback start times

---

### 🎯 Week 2 Focus: Production Observability + 1-2 Fixes

#### Phase 1: Add Production Observability (Day 1)

**Goal**: Instrument video components to understand what's actually failing in production.

1. **Add logging/metrics around playback failures**
   - Log when videos fail to start
   - Log HLS.js fatal errors
   - Track time to first frame
   - Send to Sentry/logging service

2. **Instrument key failure points**:
   ```typescript
   // In VideoMedia.tsx, FullscreenPostViewer.tsx, etc.
   - Video element load errors
   - HLS.js initialization failures
   - Playback start failures
   - Network errors during streaming
   ```

3. **Add debug page** (`/dev/video-lab`):
   - Grid of representative videos
   - Show current quality, errors, HLS state
   - Button to simulate error or reload
   - Makes manual testing easier

4. **Baseline metrics**:
   - Document current error rate (from Sentry if available)
   - Document average playback start time
   - Document HLS.js fatal error rate

---

#### Phase 2: Fix 1-2 Highest Impact Issues (Day 2)

**Choose based on instrumentation findings**, but likely candidates:

5. **Fix: Robust HLS cleanup on unmount**
   - Ensure HLS.js instances are destroyed when components unmount
   - Fix memory leaks
   - **Impact**: Prevents memory issues, especially in feed scrolling

6. **Fix: IntersectionObserver-based preloading (feed only)**
   - Only preload videos that are about to be visible
   - Don't block scrolling with off-screen video loads
   - **Impact**: Better feed scroll performance

**OR** (if instrumentation shows different priority):

7. **Fix: Better error handling & user feedback**
   - Show user-friendly error messages
   - Implement retry logic with exponential backoff
   - **Impact**: Better UX when videos fail

---

#### Phase 3: Primary Device Validation (Day 2)

8. **Test on iOS Safari** (primary target):
   - Feed scroll performance
   - Fullscreen viewer
   - Autoplay behavior
   - Verify no regressions

9. **Test on Android Chrome** (primary target):
   - Feed scroll performance
   - Fullscreen viewer
   - HLS.js playback
   - Verify no regressions

10. **Slow 3G simulation** (DevTools):
    - Test feed scrolling
    - Test video loading behavior
    - Verify preloading changes work as expected

### 🧪 Testing Checklist

#### Instrumentation
- [ ] Video playback failure logging added
- [ ] HLS.js error tracking added
- [ ] Time to first frame tracking added
- [ ] Baseline metrics documented
- [ ] Debug page (`/dev/video-lab`) created

#### Primary Device Validation
- [ ] iOS Safari: Feed scroll performance works
- [ ] iOS Safari: Fullscreen viewer works
- [ ] Android Chrome: Feed scroll performance works
- [ ] Android Chrome: Fullscreen viewer works
- [ ] Slow 3G simulation: Videos load appropriately

#### Fixes Applied
- [ ] Fix 1 implemented (based on instrumentation findings)
- [ ] Fix 2 implemented (based on instrumentation findings)
- [ ] No regressions on primary devices

### 📊 Success Criteria (Definition of Done)

**Measurable outcomes**:
- ✅ Instrumentation in place (can see video errors in logs)
- ✅ Baseline metrics documented
- ✅ 1-2 high-impact fixes implemented
- ✅ No regressions on iOS Safari & Android Chrome
- ✅ Debug page available for future testing

**Future work** (not this week):
- Full cross-browser testing
- Comprehensive network simulation
- Performance profiling across all devices

---

## 🔧 Cross-Cutting Improvements

These apply to all three migration tasks and ensure consistency, safety, and quality.

### A. Feature Branches & PR Structure

**One PR per feature**:
- `feature/comments-migration` (Step 1: moves only)
- `feature/comments-migration-refactor` (Step 2: refactoring)
- `feature/posts-creator-migration` (Step 1: moves only)
- `feature/posts-creator-refactor` (Step 2: business logic extraction)
- `feature/video-hls-week2` (instrumentation + fixes)

**Within each PR**:
- Commit 1: "Move files only" (pure file moves with `git mv`)
- Commit 2+: "Refactor / new hooks / API extraction" (if Step 2)

**Benefits**:
- ✅ Easier code review (review moves separately from refactors)
- ✅ Easier rollback (can revert just the refactor if needed)
- ✅ Clear git history

---

### B. Path Aliases & Import Consistency

**Rule**: New imports for comment/post stuff must go through the feature barrel export:

✅ **Correct** (outside feature):
```typescript
import { CommentModal } from '@/features/comments';
import { PostCreatorModal } from '@/features/posts';
```

❌ **Incorrect** (outside feature):
```typescript
import CommentModal from '@/features/comments/components/CommentModal';
```

✅ **Correct** (inside feature):
```typescript
// Inside features/comments/hooks/useCommentActions.ts
import { CommentItem } from '../components/CommentItem';
```

**Benefits**:
- ✅ Clean feature boundaries
- ✅ Easier to refactor internals later
- ✅ Clear public API

---

### C. Definition of Done per Task

Each task is **not done** until:

1. ✅ **Code complete**
   - All files moved/created
   - All imports updated
   - No TypeScript errors
   - No linting errors

2. ✅ **Tests added**
   - At least 1-2 automated tests per feature
   - Tests pass in CI

3. ✅ **Manual testing complete**
   - All checklist items ticked
   - Checklist pasted into PR description

4. ✅ **CI passing**
   - Lint passes
   - Type check passes
   - Tests pass

5. ✅ **Documentation updated**
   - PR description includes what changed
   - Any breaking changes documented
   - Migration notes added if needed

**PR Template**:
```markdown
## Changes
- [ ] Files moved (git mv)
- [ ] Imports updated
- [ ] Tests added
- [ ] Manual testing completed

## Testing Checklist
[Paste checklist from plan]

## CI Status
- [ ] Lint passes
- [ ] Type check passes
- [ ] Tests pass
```

---

### D. Shared Domain Types (Already Covered)

See "🏗️ Shared Domain Model" section at the top of this document.

**Key principle**: Core types live in `src/domain/posts.ts`. Features re-export, don't redefine.

---

## 📅 Suggested Timeline

### Week 2 - Days 1-2: Comments Migration
- **Day 1**: Phase 0 (domain types) + Step 1 (move files only)
- **Day 2**: Step 2 (refactor) + testing

### Week 2 - Day 3: Post Creator Migration
- **Day 3**: Step 1 (move files) + Step 2 (extract business logic) + testing

### Week 2 - Days 4-5: Video/HLS Stability
- **Day 4**: Phase 1 (instrumentation)
- **Day 5**: Phase 2 (1-2 fixes) + Phase 3 (validation)

---

## ✅ Next Steps

1. ✅ **Review these plans** - Plans updated with improvements
2. **Create shared domain** - Start with Phase 0 (domain types)
3. **Choose starting point** - Comments Migration is recommended (most straightforward)
4. **Create feature branch** - `feature/comments-migration`
5. **Start Step 1** - Pure file moves with `git mv`
6. **Test & commit Step 1** - Ensure everything still works
7. **Start Step 2** - Refactoring and improvements

---

*This document is a living plan - update as we progress!*

