# 🚀 Feed Optimization Plan V2 - Revised & Hardened

**Created:** December 4, 2025  
**Revised:** December 4, 2025 (addressing critical feedback)  
**Status:** Production-Ready with Gaps Addressed  
**Priority:** HIGH - Directly impacts core UX  
**Estimated Effort:** 5-7 hours (slightly increased for proper implementation)

---

## 🔄 What Changed in V2

This revision addresses critical feedback on V1:

1. ✅ **Clarified "optimistic" scope** - Option A (post-creation instant) vs Option B (click-time instant)
2. ✅ **Centralized query keys** - Single source of truth for cache mutations
3. ✅ **Tightened type safety** - Edge function response → FeedItem contract
4. ✅ **React Query mutation pattern** - Proper `useMutation` instead of custom callbacks
5. ✅ **Real-time provider cleanup** - Removed browser APIs, added cache-level de-dupe
6. ✅ **Feature flags** - Safe gradual rollout
7. ✅ **EventFeed deprecation path** - Clear migration strategy
8. ✅ **Practical testing notes** - Mocks, flaky test prevention

---

## 📋 Table of Contents

1. [Scope Decision: What "Optimistic" Means](#scope-decision)
2. [Architecture Improvements](#architecture-improvements)
3. [Implementation Plan (Revised)](#implementation-plan-revised)
4. [Testing Strategy (Hardened)](#testing-strategy-hardened)
5. [Rollout Strategy with Feature Flags](#rollout-strategy)
6. [Migration Path for Legacy Code](#migration-path)

---

## 🎯 Scope Decision: What "Optimistic" Means

### **Decision Point: Two Approaches**

#### **Option A: Post-Creation Instant** ⭐ RECOMMENDED FOR V1

**Timeline:**
```
User clicks "Post"
      ↓
Upload media (5-30s, user sees progress)
      ↓
Call posts-create Edge Function (200-500ms)
      ↓
✨ Post appears in feed INSTANTLY (0ms cache update)
```

**Pros:**
- Simpler implementation
- Post data is complete (has server ID, timestamps, etc.)
- No temporary IDs to manage
- Video processing already complete or in-progress
- Less error-prone

**Cons:**
- User waits for upload before seeing post in feed
- Not as instant as TikTok/Instagram (but honest about upload state)

**Terminology:**
- Rename: `onPostCreatedCacheUpdate` (not "optimistic")
- Docs: "Post appears instantly after creation, without full refetch"
- Goal: 0ms latency **after post-creation succeeds**

---

#### **Option B: True Click-Time Optimistic** (Future Enhancement)

**Timeline:**
```
User clicks "Post"
      ↓
✨ Post appears in feed INSTANTLY with "Uploading..." state
      ↓
Upload media (5-30s, progress bar in post card)
      ↓
Post card updates to "Processing..."
      ↓
Post card updates to "Ready" when Mux finishes
```

**Implementation:**
```typescript
// Generate client ID
const tempId = `temp-${crypto.randomUUID()}`;

// Create optimistic item immediately
const optimisticItem: FeedItem = {
  item_type: 'post',
  item_id: tempId,
  created_at_ts: Date.now(),
  processing: { status: 'uploading', progress: 0 },
  author: currentUser,
  content: { text: formContent, media: [] }, // Empty media initially
  metrics: { likes: 0, comments: 0, shares: 0, views: 0 },
  isOptimistic: true, // Flag for special handling
};

// Add to cache immediately
prependPostToFeedCache(queryClient, queryKey, optimisticItem);

// Start upload in background
const result = await uploadAndCreatePost(data, queue, {
  onProgress: (progress) => {
    updatePostInFeedCache(queryClient, queryKey, tempId, {
      processing: { status: 'uploading', progress },
    });
  },
});

// Replace temp item with real one
replaceOptimisticPost(queryClient, queryKey, tempId, result.post);
```

**Pros:**
- True 0ms perceived latency from user click
- Matches modern social app UX
- User can navigate away while upload continues

**Cons:**
- More complex (temp IDs, replacement logic, error rollback)
- Need to handle user actions on optimistic post (like, comment, delete)
- Potential for confusion if upload fails

**Recommendation:** Implement Option A first, then Option B as Phase 4 after monitoring metrics.

---

## 🏗️ Architecture Improvements

### 1. **Centralized Query Key Management**

**Problem:** Query keys scattered across files, easy to drift.

**Solution:** Single source of truth.

**File:** `src/features/feed/utils/queryKeys.ts` (NEW)

```typescript
import type { FeedFilters } from '../hooks/unifiedFeedTypes';

export interface UnifiedFeedParams {
  limit?: number;
  locations?: string[];
  categories?: string[];
  dates?: string[];
  searchRadius?: number;
}

/**
 * Centralized query key factory for unified feed.
 * USE THIS EVERYWHERE - do not construct keys manually.
 */
export const feedQueryKeys = {
  all: ['unifiedFeed'] as const,
  
  lists: () => [...feedQueryKeys.all, 'list'] as const,
  
  list: (params: UnifiedFeedParams) => 
    [...feedQueryKeys.lists(), params] as const,
  
  post: (postId: string) => 
    [...feedQueryKeys.all, 'post', postId] as const,
  
  // For legacy EventFeed
  eventFeed: (eventId: string) => 
    ['eventFeed', eventId] as const,
};

/**
 * Normalize params to ensure consistent cache keys
 */
export function normalizeParams(params: UnifiedFeedParams): UnifiedFeedParams {
  return {
    limit: params.limit ?? 30,
    locations: params.locations ?? [],
    categories: params.categories ?? [],
    dates: params.dates ?? [],
    searchRadius: params.searchRadius,
  };
}
```

**Usage everywhere:**

```typescript
// In useUnifiedFeedInfinite.ts
import { feedQueryKeys, normalizeParams } from '../utils/queryKeys';

export function useUnifiedFeedInfinite(options: FeedFilters & { limit?: number } = {}) {
  const params = normalizeParams(options);
  
  const query = useInfiniteQuery<FeedPage, Error>({
    queryKey: feedQueryKeys.list(params), // ✅ Single source
    // ...
  });
}

// In PostCreatorModal.tsx
import { feedQueryKeys, normalizeParams } from '@/features/feed/utils/queryKeys';

const params = normalizeParams({ limit: 30, ...filters });
const queryKey = feedQueryKeys.list(params);
prependPostToFeedCache(queryClient, queryKey, newPost);
```

**Benefits:**
- Change key shape once, everywhere updates
- TypeScript autocomplete for all key variants
- Easier to debug cache issues

---

### 2. **Strict Type Contract: Edge Function → Feed**

**Problem:** Edge function response shape doesn't match FeedItem type.

**Solution:** Define explicit contract and validate.

**File:** `supabase/functions/posts-create/types.ts` (NEW)

```typescript
// Shared between Edge Function and client
export interface PostCreationResponse {
  success: true;
  post: FeedItemPost; // Exact shape expected by feed
  event_title: string;
}

export interface FeedItemPost {
  // Core identity
  item_type: 'post';
  item_id: string;
  event_id: string;
  created_at_ts: number;
  
  // Author
  author: {
    id: string;
    display_name: string;
    username: string | null;
    photo_url: string | null;
  };
  
  // Content
  content: {
    text: string;
    media: Array<{
      url: string;
      type: 'image' | 'video';
      thumbnail: string;
      width?: number;
      height?: number;
      duration?: number;
    }>;
  };
  
  // Metrics
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
    viewer_has_liked: boolean;
  };
  
  // Metadata
  event: {
    id: string;
    title: string;
    cover_image_url: string | null;
  } | null;
  
  // Processing state (optional)
  processing?: {
    status: 'ready' | 'processing' | 'failed';
    progress?: number;
  };
}
```

**File:** `supabase/functions/posts-create/index.ts` (UPDATED)

```typescript
import type { PostCreationResponse, FeedItemPost } from './types.ts';

serve(async (req) => {
  // ... existing auth & validation ...

  const { data: post, error: postError } = await supabaseClient
    .from('event_posts')
    .insert(postData)
    .select('id, created_at, author_user_id, text, media_urls, event_id')
    .single();

  if (postError) {
    return createErrorResponse(postError.message, 500);
  }

  // Fetch author details
  const { data: author } = await supabaseClient
    .from('user_profiles')
    .select('display_name, username, photo_url')
    .eq('user_id', post.author_user_id)
    .single();

  // Fetch event details
  const { data: event } = await supabaseClient
    .from('events')
    .select('id, title, cover_image_url')
    .eq('id', post.event_id)
    .single();

  // Transform to FeedItemPost shape
  const feedPost: FeedItemPost = {
    item_type: 'post',
    item_id: post.id,
    event_id: post.event_id,
    created_at_ts: new Date(post.created_at).getTime(),
    
    author: {
      id: post.author_user_id,
      display_name: author?.display_name || 'Anonymous',
      username: author?.username || null,
      photo_url: author?.photo_url || null,
    },
    
    content: {
      text: post.text || '',
      media: (post.media_urls || []).map((url: string) => {
        const isVideo = url.startsWith('mux:');
        const playbackId = isVideo ? url.slice(4) : null;
        
        return {
          url,
          type: isVideo ? 'video' : 'image',
          thumbnail: isVideo 
            ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
            : url,
        };
      }),
    },
    
    metrics: {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      viewer_has_liked: false,
    },
    
    event: event ? {
      id: event.id,
      title: event.title,
      cover_image_url: event.cover_image_url,
    } : null,
    
    processing: {
      status: 'ready', // Or 'processing' if video still encoding
    },
  };

  const response: PostCreationResponse = {
    success: true,
    post: feedPost,
    event_title: event?.title || '',
  };

  return createResponse(response, 201);
});
```

**File:** `src/features/posts/api/posts.ts` (UPDATED)

```typescript
import type { PostCreationResponse } from '@/types/api';

export async function createPost(data: {
  event_id: string;
  text: string;
  media_urls: string[];
  ticket_tier_id?: string | null;
}): Promise<PostCreationResponse> {
  const { data: result, error } = await supabase.functions.invoke<PostCreationResponse>(
    'posts-create',
    { body: data }
  );
  
  if (error) throw error;
  if (!result) throw new Error('No response from posts-create');
  
  // Runtime validation (optional but recommended)
  if (!result.success || !result.post || result.post.item_type !== 'post') {
    throw new Error('Invalid response shape from posts-create');
  }
  
  return result;
}
```

**Benefits:**
- TypeScript catches mismatches at compile time
- Runtime validation catches bugs in production
- Single source of truth for post shape

---

### 3. **React Query Mutation Pattern**

**Problem:** Custom callback system is reinventing React Query's built-in lifecycle.

**Solution:** Use `useMutation` properly.

**File:** `src/features/posts/hooks/usePostCreation.ts` (REFACTORED)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost, uploadImageToSupabase, createMuxDirectUpload, resolveMuxUploadToPlaybackId, uploadMuxWithProgress } from '../api/posts';
import { feedQueryKeys, normalizeParams } from '@/features/feed/utils/queryKeys';
import { prependPostToFeedCache, removePostFromFeedCache } from '@/features/feed/utils/optimisticUpdates';
import type { FeedItemPost, PostCreationResponse } from '@/types/api';
import type { QueuedFile } from './types';

interface CreatePostInput {
  event_id: string;
  text: string;
  ticket_tier_id?: string | null;
  files: QueuedFile[];
}

interface MutationContext {
  queryKey: any[];
  previousData: any;
}

export function usePostCreation({
  filters,
  onProgress,
}: {
  filters: UnifiedFeedParams;
  onProgress?: (progress: UploadProgress) => void;
}) {
  const queryClient = useQueryClient();
  const params = normalizeParams(filters);
  const queryKey = feedQueryKeys.list(params);

  const mutation = useMutation<
    PostCreationResponse,
    Error,
    CreatePostInput,
    MutationContext
  >({
    mutationFn: async ({ event_id, text, ticket_tier_id, files }) => {
      // Upload all media files first
      const media_urls: string[] = [];
      
      for (const file of files) {
        if (file.kind === 'image') {
          const url = await uploadImageToSupabase(file.file, userId);
          media_urls.push(url);
        } else {
          // Video upload
          const { upload_id, upload_url } = await createMuxDirectUpload(event_id);
          
          await uploadMuxWithProgress(
            upload_url,
            file.file,
            new AbortController(),
            (progress) => onProgress?.({ fileIndex: files.indexOf(file), progress })
          );
          
          const playback_id = await resolveMuxUploadToPlaybackId(upload_id);
          media_urls.push(`mux:${playback_id}`);
        }
      }

      // Create post with uploaded media
      return await createPost({
        event_id,
        text,
        media_urls,
        ticket_tier_id,
      });
    },

    // ✅ OPTION A: Post-creation instant cache update
    onSuccess: (response, variables, context) => {
      console.log('✅ Post created, updating cache:', response.post.item_id);
      
      prependPostToFeedCache(queryClient, queryKey, response.post);
      
      // Optional: Also invalidate to ensure consistency
      // (but with 5s delay so we don't trigger immediate refetch)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: feedQueryKeys.all });
      }, 5000);
    },

    onError: (error, variables, context) => {
      console.error('❌ Post creation failed:', error);
      
      // If we had done optimistic update (Option B), we'd rollback here:
      // if (context?.queryKey) {
      //   queryClient.setQueryData(context.queryKey, context.previousData);
      // }
      
      // Show error to user
      toast({
        title: 'Failed to create post',
        description: error.message,
        variant: 'destructive',
      });
    },

    onSettled: () => {
      // Always called after onSuccess or onError
      console.log('Post creation mutation settled');
    },
  });

  return {
    createPost: mutation.mutate,
    createPostAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ✅ Alternative: True optimistic (Option B) - for Phase 4
export function usePostCreationOptimistic({
  filters,
  currentUser,
  onProgress,
}: {
  filters: UnifiedFeedParams;
  currentUser: User;
  onProgress?: (progress: UploadProgress) => void;
}) {
  const queryClient = useQueryClient();
  const params = normalizeParams(filters);
  const queryKey = feedQueryKeys.list(params);

  const mutation = useMutation<
    PostCreationResponse,
    Error,
    CreatePostInput,
    MutationContext
  >({
    mutationFn: async ({ event_id, text, ticket_tier_id, files }) => {
      // Same as above
    },

    // ✅ OPTION B: Instant optimistic update on click
    onMutate: async (variables) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Create optimistic post
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimisticPost: FeedItemPost = {
        item_type: 'post',
        item_id: tempId,
        event_id: variables.event_id,
        created_at_ts: Date.now(),
        author: {
          id: currentUser.id,
          display_name: currentUser.display_name || 'You',
          username: currentUser.username || null,
          photo_url: currentUser.photo_url || null,
        },
        content: {
          text: variables.text,
          media: [], // Will be populated after upload
        },
        metrics: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0,
          viewer_has_liked: false,
        },
        event: null,
        processing: {
          status: 'uploading',
          progress: 0,
        },
        isOptimistic: true, // Flag for special rendering
      };

      // Optimistically add to cache
      prependPostToFeedCache(queryClient, queryKey, optimisticPost);

      // Return context for rollback
      return { queryKey, previousData, tempId };
    },

    onSuccess: (response, variables, context) => {
      // Replace temp post with real one
      if (context?.tempId) {
        removePostFromFeedCache(queryClient, queryKey, context.tempId);
        prependPostToFeedCache(queryClient, queryKey, response.post);
      }
    },

    onError: (error, variables, context) => {
      // Rollback to previous state
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
  });

  return {
    createPost: mutation.mutate,
    createPostAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

**Benefits:**
- Standard React Query pattern
- Automatic context management
- Easier to test
- Less custom code

---

### 4. **Real-time Provider Cleanup**

**Problem:** Provider handles too much (browser APIs, notifications).

**Solution:** Separate concerns.

**File:** `src/features/feed/contexts/FeedRealtimeContext.tsx` (CLEANED UP)

```typescript
import { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimePosts } from '@/hooks/useRealtimePosts';
import { feedQueryKeys } from '../utils/queryKeys';
import { prependPostToFeedCache } from '../utils/optimisticUpdates';
import type { UnifiedFeedParams } from '../utils/queryKeys';

interface FeedRealtimeContextValue {
  isConnected: boolean;
  subscribedEventIds: string[];
}

const FeedRealtimeContext = createContext<FeedRealtimeContextValue | null>(null);

export function FeedRealtimeProvider({ 
  children,
  eventIds,
  filters,
  onNewPost, // NEW: Let parent handle notifications
}: { 
  children: React.ReactNode;
  eventIds: string[];
  filters: UnifiedFeedParams;
  onNewPost?: (post: FeedItemPost) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  
  const queryKey = feedQueryKeys.list(filters);

  useRealtimePosts(eventIds, (rawPost) => {
    // Skip own posts (already handled by mutation)
    if (rawPost.author_user_id === user?.id) {
      return;
    }

    // Transform to FeedItemPost
    const feedPost: FeedItemPost = {
      item_type: 'post',
      item_id: rawPost.id,
      event_id: rawPost.event_id,
      created_at_ts: new Date(rawPost.created_at).getTime(),
      author: {
        id: rawPost.author_user_id,
        display_name: rawPost.author_display_name || 'Anonymous',
        username: null,
        photo_url: null,
      },
      content: {
        text: rawPost.text || '',
        media: (rawPost.media_urls || []).map((url: string) => ({
          url,
          type: url.startsWith('mux:') ? 'video' : 'image',
          thumbnail: url.startsWith('mux:')
            ? `https://image.mux.com/${url.slice(4)}/thumbnail.jpg`
            : url,
        })),
      },
      metrics: {
        likes: rawPost.like_count || 0,
        comments: rawPost.comment_count || 0,
        shares: 0,
        views: 0,
        viewer_has_liked: false,
      },
      event: null,
    };

    // ✅ Cache-level de-dupe (no need for processedPostIds ref)
    const existingData = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
    const alreadyExists = existingData?.pages.some(page =>
      page.items.some(item => item.item_id === feedPost.item_id)
    );

    if (alreadyExists) {
      console.log('⏭️ Skipping duplicate post from real-time:', feedPost.item_id);
      return;
    }

    console.log('⚡ New post from real-time:', feedPost.item_id);

    // Update cache
    prependPostToFeedCache(queryClient, queryKey, feedPost);

    // Notify parent (for notifications, analytics, etc.)
    onNewPost?.(feedPost);
  });

  useEffect(() => {
    setIsConnected(eventIds.length > 0);
  }, [eventIds]);

  return (
    <FeedRealtimeContext.Provider value={{ isConnected, subscribedEventIds: eventIds }}>
      {children}
    </FeedRealtimeContext.Provider>
  );
}

export function useFeedRealtime() {
  const context = useContext(FeedRealtimeContext);
  if (!context) {
    throw new Error('useFeedRealtime must be used within FeedRealtimeProvider');
  }
  return context;
}
```

**File:** `src/features/feed/routes/FeedPageNewDesign.tsx` (UPDATED)

```typescript
// Handle notifications at UI level
<FeedRealtimeProvider 
  eventIds={subscribedEventIds} 
  filters={filters}
  onNewPost={(post) => {
    // Optional: Show browser notification
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('New Post', {
        body: `${post.author.display_name} posted`,
        icon: '/logo.png',
      });
    }
    
    // Optional: Show in-app toast
    toast({
      title: 'New post',
      description: `${post.author.display_name} just posted`,
      duration: 3000,
    });
    
    // Analytics
    posthog.capture('feed_realtime_post_received', {
      post_id: post.item_id,
      event_id: post.event_id,
    });
  }}
>
  {/* Feed UI */}
</FeedRealtimeProvider>
```

**Benefits:**
- Provider only manages cache sync
- UI handles user-facing concerns
- Easier to test
- No permission prompts in unexpected places

---

## 🚀 Rollout Strategy with Feature Flags

### Feature Flag Setup

**File:** `src/config/featureFlags.ts` (NEW)

```typescript
import posthog from 'posthog-js';

export interface FeatureFlags {
  'feed.optimistic-posting': boolean;
  'feed.realtime-posts': boolean;
  'feed.background-revalidation': boolean;
  'feed.processing-indicators': boolean;
}

/**
 * Check if feature is enabled for current user
 */
export function isFeatureEnabled(
  flag: keyof FeatureFlags,
  userId?: string
): boolean {
  // Development: all features enabled
  if (import.meta.env.DEV) {
    return true;
  }

  // Check PostHog or your feature flag provider
  const enabled = posthog.isFeatureEnabled(flag);
  
  console.log(`[FeatureFlags] ${flag}: ${enabled ? 'ON' : 'OFF'}`, { userId });
  
  return enabled ?? false;
}

/**
 * Get feature flag variant (for A/B testing)
 */
export function getFeatureVariant(
  flag: keyof FeatureFlags
): string | boolean {
  return posthog.getFeatureFlag(flag);
}
```

**Usage in components:**

```typescript
// In usePostCreation.ts
import { isFeatureEnabled } from '@/config/featureFlags';

export function usePostCreation({ filters }: UsePostCreationOptions) {
  const optimisticEnabled = isFeatureEnabled('feed.optimistic-posting');
  
  const mutation = useMutation({
    // ... existing setup ...
    
    onSuccess: (response) => {
      if (optimisticEnabled) {
        // ✅ New optimized path
        prependPostToFeedCache(queryClient, queryKey, response.post);
      } else {
        // ❌ Old path: full refetch
        queryClient.invalidateQueries({ queryKey: feedQueryKeys.all });
      }
    },
  });
  
  return mutation;
}

// In FeedPageNewDesign.tsx
const realtimeEnabled = isFeatureEnabled('feed.realtime-posts', user?.id);

return (
  <>
    {realtimeEnabled ? (
      <FeedRealtimeProvider eventIds={subscribedEventIds} filters={filters}>
        <FeedContent />
      </FeedRealtimeProvider>
    ) : (
      <FeedContent />
    )}
  </>
);
```

### Gradual Rollout Plan

**Week 1: Internal Testing**
```typescript
posthog.updateEarlyAccessFeatureEnrollment('feed.optimistic-posting', true);
// Enable for internal team only
```

**Week 2: 10% of users**
```typescript
// In PostHog dashboard:
// - Create feature flag: feed.optimistic-posting
// - Rollout: 10% of users
// - Monitor: error rate, latency, user feedback
```

**Week 3: 50% of users** (if metrics look good)

**Week 4: 100% rollout**

**Week 5: Enable real-time** (same gradual process)

**Week 6: Remove feature flags** (after 100% stable)

---

## 🧪 Testing Strategy (Hardened)

### Test Environment Setup

**File:** `vitest.setup.ts` (UPDATED)

```typescript
import { vi } from 'vitest';

// Mock browser APIs that aren't in Node
global.Notification = vi.fn();
global.Notification.permission = 'denied';

// Mock performance.now()
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Mock window.dispatchEvent
global.dispatchEvent = vi.fn();

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => Math.random().toString(36).slice(2),
  } as any;
}

// Setup QueryClient with consistent config
import { QueryClient } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}, // Silence errors in tests
    },
  });
}
```

### Deterministic E2E Tests

**File:** `e2e/fixtures/users.ts` (NEW)

```typescript
// Seed deterministic test users
export const TEST_USERS = {
  alice: {
    email: 'alice@test.liventix.com',
    password: 'Test123456!',
    userId: 'alice-uuid-deterministic',
    displayName: 'Alice Test',
  },
  bob: {
    email: 'bob@test.liventix.com',
    password: 'Test123456!',
    userId: 'bob-uuid-deterministic',
    displayName: 'Bob Test',
  },
};

// Setup script: npm run test:seed
export async function seedTestUsers() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (const [key, user] of Object.entries(TEST_USERS)) {
    // Create auth user
    await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });
  }
}
```

**File:** `e2e/helpers/auth.ts` (NEW)

```typescript
import { Page } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

export async function loginAs(page: Page, user: keyof typeof TEST_USERS) {
  const { email, password } = TEST_USERS[user];
  
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for redirect to feed
  await page.waitForURL('/feed', { timeout: 5000 });
}
```

**File:** `e2e/feed-realtime.spec.ts` (UPDATED)

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Feed Real-time', () => {
  test.beforeEach(async ({ }) => {
    // Ensure test users exist
    await fetch(`${process.env.TEST_API_URL}/seed-test-users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.TEST_SERVICE_KEY}` },
    });
  });

  test('should show posts from other users in real-time', async ({ browser }) => {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Alice logs in
    await loginAs(page1, 'alice');
    
    // Bob logs in
    await loginAs(page2, 'bob');
    
    // Bob creates a post
    await page2.click('[aria-label="Create Post"]');
    await page2.fill('[placeholder*="What\'s happening"]', 'Real-time test post');
    await page2.click('button:has-text("Post")');
    
    // Alice should see the post appear
    await page1.waitForSelector('text="Real-time test post"', { timeout: 3000 });
    
    // Verify no duplicates
    const postCount = await page1.locator('text="Real-time test post"').count();
    expect(postCount).toBe(1);
    
    // Verify it's from Bob
    const authorName = await page1.locator('text="Real-time test post"')
      .locator('..')
      .locator('[data-author-name]')
      .getAttribute('data-author-name');
    expect(authorName).toBe('Bob Test');
    
    await context1.close();
    await context2.close();
  });

  test('should not duplicate own posts', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await loginAs(page, 'alice');
    
    // Create post
    await page.click('[aria-label="Create Post"]');
    await page.fill('[placeholder*="What\'s happening"]', 'Self post test');
    await page.click('button:has-text("Post")');
    
    // Wait a bit for any real-time updates
    await page.waitForTimeout(2000);
    
    // Should only appear once (from optimistic update, not real-time)
    const postCount = await page.locator('text="Self post test"').count();
    expect(postCount).toBe(1);
    
    await context.close();
  });
});
```

### Network Spy Test

**File:** `e2e/feed-performance.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test('should not refetch feed after post creation', async ({ page }) => {
  await loginAs(page, 'alice');
  
  // Track network requests
  const feedRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('home-feed') || url.includes('get_home_feed')) {
      feedRequests.push(url);
    }
  });
  
  const initialRequestCount = feedRequests.length;
  
  // Create post
  await page.click('[aria-label="Create Post"]');
  await page.fill('[placeholder*="What\'s happening"]', 'Network spy test');
  await page.click('button:has-text("Post")');
  
  // Wait for post to appear
  await page.waitForSelector('text="Network spy test"');
  
  // Wait a bit more to ensure no delayed requests
  await page.waitForTimeout(2000);
  
  // Should not have made additional feed requests
  const finalRequestCount = feedRequests.length;
  expect(finalRequestCount).toBe(initialRequestCount);
  
  console.log(`Feed requests: ${initialRequestCount} → ${finalRequestCount}`);
});
```

---

## 🔄 Migration Path for Legacy Code

### EventFeed Deprecation Strategy

**Phase 1: Mark as deprecated** (Week 1)

```typescript
// In EventFeed.tsx
/**
 * @deprecated Use UnifiedFeedList instead
 * This component will be removed in Q2 2025
 * 
 * Migration guide: /docs/feed-migration.md
 */
export function EventFeed({ eventId, userId, onEventClick, refreshTrigger }: EventFeedProps) {
  // Add deprecation warning in dev
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn(
        '[EventFeed] This component is deprecated. Use UnifiedFeedList with event filter instead.',
        { eventId }
      );
    }
  }, [eventId]);
  
  // ... existing code ...
}
```

**Phase 2: Migrate existing usages** (Weeks 2-4)

```typescript
// BEFORE: EventFeed usage
<EventFeed 
  eventId={eventId}
  userId={user?.id}
  onEventClick={handleEventClick}
  refreshTrigger={refreshTrigger}
/>

// AFTER: UnifiedFeedList with event filter
<UnifiedFeedList
  filters={{
    events: [eventId], // NEW: event filter
    locations: [],
    categories: [],
    dates: [],
  }}
  onEventClick={handleEventClick}
/>
```

**Phase 3: Remove EventFeed** (Week 5)

- Delete `src/components/EventFeed.tsx`
- Remove imports across codebase
- Update documentation

### Shared Components

**File:** `src/features/feed/components/FeedList.tsx` (NEW)

```typescript
/**
 * Unified feed list component
 * Replaces both EventFeed and legacy feed implementations
 */
export function FeedList({
  items,
  filters,
  onLike,
  onComment,
  onShare,
  onDelete,
}: FeedListProps) {
  // ... single implementation for all feed contexts
}
```

---

## 📊 Success Metrics (Revised)

### Performance KPIs

| Metric | Before | V2 Target | Measurement |
|--------|--------|-----------|-------------|
| **Time to See Own Post** | 1-3s | < 50ms after upload | performance.mark() |
| **Cache Update Latency** | N/A | < 5ms | React Query DevTools |
| **Network Requests After Post** | 1 | 0 | Network tab |
| **Data Transferred After Post** | 150-300 KB | 0 KB | Network tab |
| **Real-time Latency** | Manual | < 1s | Timestamp diff |
| **Duplicate Post Rate** | N/A | 0% | Error logs |

### Quality KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Type Safety Coverage** | 100% | TypeScript strict mode |
| **Test Coverage** | > 80% | Vitest coverage |
| **Feature Flag Adoption** | 100% rollout | PostHog dashboard |
| **Rollback Count** | 0 | Deploy logs |

---

## 🎯 Decision: Recommended Approach

**For Production Deployment:**

1. **Start with Option A** (post-creation instant)
   - Simpler, less risky
   - Clear user expectation (upload → post appears)
   - Easier to debug

2. **Implement Phase 1-3** (3 days)
   - Centralized query keys
   - Strict type contracts
   - React Query mutation pattern
   - Real-time subscriptions
   - Feature flags

3. **Monitor for 2 weeks**
   - Error rates
   - Performance metrics
   - User feedback

4. **(Optional) Upgrade to Option B** (true optimistic)
   - Only if metrics show upload time is a major pain point
   - Phase 4 enhancement
   - More complex but matches modern social app UX

---

## 📝 Implementation Checklist

### Before Starting
- [ ] Review this plan with team
- [ ] Decide: Option A or Option B
- [ ] Set up feature flags in PostHog
- [ ] Prepare test user accounts
- [ ] Create monitoring dashboards

### Phase 1: Foundation (Day 1)
- [ ] Create `queryKeys.ts`
- [ ] Create type contracts (`types.ts`)
- [ ] Update `posts-create` Edge Function
- [ ] Update `posts.ts` API client
- [ ] Write unit tests for query keys

### Phase 2: Mutation Pattern (Day 2)
- [ ] Refactor `usePostCreation` to `useMutation`
- [ ] Update `PostCreatorModal`
- [ ] Update `FeedPageNewDesign`
- [ ] Remove old refetch calls
- [ ] Write mutation tests

### Phase 3: Real-time (Day 3)
- [ ] Clean up `FeedRealtimeProvider`
- [ ] Add cache-level de-dupe
- [ ] Move notifications to UI level
- [ ] Connect to feed components
- [ ] Write real-time E2E tests

### Phase 4: Feature Flags & Rollout (Day 4)
- [ ] Add feature flag checks
- [ ] Deploy to staging
- [ ] Test with flags ON/OFF
- [ ] Gradual rollout plan
- [ ] Monitor dashboards

### Phase 5: Cleanup (Day 5)
- [ ] Deprecate EventFeed
- [ ] Migrate existing usages
- [ ] Update documentation
- [ ] Remove dead code

---

**Total Timeline:** 5 days (revised from 3 days)  
**Status:** ✅ Production-Ready with Gaps Addressed  
**Next Steps:** Get team approval, then implement Phase 1

