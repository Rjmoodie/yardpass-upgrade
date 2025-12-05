/**
 * Hook for post creation logic (Refactored for Option A: Post-Creation Instant)
 * 
 * Uses React Query's useMutation for proper lifecycle management.
 * Provides instant cache updates after post creation (no full refetch).
 * 
 * @example
 * ```typescript
 * const { createPost, isCreating } = usePostCreation({
 *   userId: user.id,
 *   filters: { locations: [], categories: [] },
 *   onProgress: (index, progress) => console.log(`File ${index}: ${progress}%`)
 * });
 * 
 * await createPost({
 *   event_id: eventId,
 *   text: 'Hello world',
 *   ticket_tier_id: null,
 *   files: queuedFiles,
 * });
 * ```
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  uploadImageToSupabase,
  createMuxDirectUpload,
  resolveMuxUploadToPlaybackId,
  uploadMuxWithProgress,
  createPost,
  backoff,
  preprocessImage,
  maybeTranscodeHeic,
} from '../api/posts';
import { feedQueryKeys, normalizeParams, type UnifiedFeedParams } from '@/features/feed/utils/queryKeys';
import { prependPostToFeedCache } from '@/features/feed/utils/optimisticUpdates';
import type { PostCreationResponse } from '@/types/api';

export type QueuedFile = {
  file: File;
  kind: 'image' | 'video';
  name: string;
  size: number;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';
  remoteUrl?: string;
  errorMsg?: string;
  controller?: AbortController;
  progress?: number;
};

type UploadProgressCallback = (fileIndex: number, progress: Partial<QueuedFile>) => void;

interface UsePostCreationOptions {
  userId: string;
  filters: UnifiedFeedParams; // For query key generation
  onProgress?: UploadProgressCallback;
}

interface CreatePostInput {
  event_id: string;
  text: string;
  ticket_tier_id?: string | null;
  files: QueuedFile[];
}

export function usePostCreation({ userId, filters, onProgress }: UsePostCreationOptions) {
  const queryClient = useQueryClient();
  const params = normalizeParams(filters);
  const queryKey = feedQueryKeys.list(params);

  /**
   * Upload a queue of files and return their URLs
   */
  const uploadQueue = useCallback(
    async (queue: QueuedFile[], eventId: string): Promise<string[]> => {
      const results: string[] = [];
      const items = [...queue];
      const CONCURRENCY = 2;

      // Helper to update file status via callback
      const updateFile = (i: number, patch: Partial<QueuedFile>) => {
        const updated = { ...items[i], ...patch };
        items[i] = updated;
        onProgress?.(i, patch);
      };

      // Upload worker for one file
      const uploadFile = async (i: number) => {
        const item = items[i];
        if (!item) return;

        // Skip if already done or canceled
        if (item.status === 'done' && item.remoteUrl) {
          results.push(item.remoteUrl);
          return;
        }
        if (item.status === 'canceled') return;

        try {
          const controller = new AbortController();
          updateFile(i, { status: 'uploading', controller, errorMsg: undefined, progress: 0 });

          if (item.kind === 'image') {
            // Preprocess and upload image
            let processedFile = await maybeTranscodeHeic(item.file);
            processedFile = await preprocessImage(processedFile);

            const publicUrl = await backoff(() => uploadImageToSupabase(processedFile, userId));
            updateFile(i, { status: 'done', remoteUrl: publicUrl, controller: undefined, progress: 100 });
            results.push(publicUrl);
          } else {
            // Video upload to Mux
            if (!eventId) throw new Error('Select an event before uploading video');

            // Create direct upload
            const { upload_id, upload_url } = await backoff(() =>
              createMuxDirectUpload(eventId)
            );

            // Upload with progress
            await backoff(
              () =>
                uploadMuxWithProgress(upload_url, item.file, controller, (p) =>
                  updateFile(i, { progress: p })
                ),
              2,
              800
            );

            // Mark as processing
            updateFile(i, { status: 'processing', controller: undefined });

            // Resolve to playback_id
            const playback_id = await backoff(
              () => resolveMuxUploadToPlaybackId(upload_id),
              6,
              1200
            );
            const muxUrl = `mux:${playback_id}`;
            updateFile(i, { status: 'done', remoteUrl: muxUrl, progress: 100 });
            results.push(muxUrl);
          }
        } catch (err: any) {
          const msg = err?.message || 'Upload failed';
          updateFile(i, { status: 'error', controller: undefined, errorMsg: msg });
          toast({
            title: 'Upload Failed',
            description: `Failed to upload ${item.name}: ${msg}`,
            variant: 'destructive',
          });
          // Continue with other files instead of throwing
        }
      };

      // Upload with limited concurrency
      const queueIndices = items.map((_, i) => i);
      const runners: Promise<any>[] = [];

      for (let k = 0; k < CONCURRENCY; k++) {
        runners.push(
          (async () => {
            while (queueIndices.length) {
              const i = queueIndices.shift()!;
              await uploadFile(i);
            }
          })()
        );
      }

      await Promise.all(runners);
      return results;
    },
    [userId, onProgress]
  );

  /**
   * React Query mutation for post creation
   * Handles uploads, post creation, and cache updates
   */
  const mutation = useMutation<PostCreationResponse, Error, CreatePostInput>({
    mutationFn: async ({ event_id, text, ticket_tier_id, files }) => {
      console.log('📤 [usePostCreation] Starting post creation...', { event_id, fileCount: files.length });

      // Step 1: Upload all media files
      const media_urls = await uploadQueue(files, event_id);
      
      console.log('✅ [usePostCreation] Media uploaded:', { count: media_urls.length });

      // Step 2: Create post with uploaded media
      const response = await createPost({
        event_id,
        text,
        media_urls,
        ticket_tier_id,
      });

      console.log('✅ [usePostCreation] Post created:', response.post.item_id);

      return response;
    },

    // ✅ OPTION A: Post-creation instant cache update
    onSuccess: (response) => {
      console.log('🎉 [usePostCreation] Post creation successful, updating cache');

      // Instantly add to cache (no refetch needed)
      prependPostToFeedCache(queryClient, queryKey, response.post);

      // 🎯 Scroll to top to show the new post
      setTimeout(() => {
        const feedContainer = document.querySelector('[data-feed-container]') 
          || document.querySelector('main') 
          || document.querySelector('[role="main"]');
        
        if (feedContainer) {
          feedContainer.scrollTo({ top: 0, behavior: 'smooth' });
          console.log('📜 [usePostCreation] Scrolled to top to show new post');
        } else {
          // Fallback: scroll window
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100); // Small delay to ensure modal has closed

      // Dispatch legacy event for backward compatibility
      // TODO: Remove after EventFeed is deprecated
      window.dispatchEvent(
        new CustomEvent('postCreated', {
          detail: {
            eventId: response.post.event_id,
            postId: response.post.item_id,
            eventTitle: response.event_title,
            timestamp: new Date().toISOString(),
          },
        })
      );

      // Show success toast
      toast({
        title: 'Posted! 🎉',
        description: 'Your post is now live',
        duration: 2000,
      });

      // Optional: Background revalidation after 5s for consistency
      setTimeout(() => {
        console.log('🔄 [usePostCreation] Background revalidation');
        queryClient.invalidateQueries({ queryKey: feedQueryKeys.all });
      }, 5000);
    },

    onError: (error) => {
      console.error('❌ [usePostCreation] Post creation failed:', error);

      // Show error toast
      toast({
        title: 'Failed to create post',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },

    onSettled: () => {
      console.log('✅ [usePostCreation] Mutation settled');
    },
  });

  return {
    createPost: mutation.mutate,
    createPostAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    // Expose upload queue for advanced usage
    uploadQueue,
  };
}

