/**
 * Hook for post creation logic
 * 
 * Single entry point for all post creation business logic.
 * Handles media uploads, validation, and post creation.
 */

import { useCallback, useRef, useState } from 'react';
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
import type { PostCreationData, PostCreationResult } from '@/features/posts/types';

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
  onProgress?: UploadProgressCallback;
}

export function usePostCreation({ userId, onProgress }: UsePostCreationOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
   * Create a post with media uploads
   */
  const createPostWithMedia = useCallback(
    async (
      data: PostCreationData,
      queue: QueuedFile[]
    ): Promise<PostCreationResult> => {
      setIsSubmitting(true);
      setError(null);

      try {
        // Upload media files
        const media_urls = await uploadQueue(queue, data.event_id);

        // Create post
        const result = await createPost({
          event_id: data.event_id,
          text: data.text,
          media_urls,
          ticket_tier_id: data.ticket_tier_id,
        });

        // Dispatch custom event for feed refresh
        window.dispatchEvent(
          new CustomEvent('postCreated', {
            detail: {
              eventId: data.event_id,
              postId: result.id,
              eventTitle: result.event_title,
              timestamp: new Date().toISOString(),
            },
          })
        );

        return {
          success: true,
          post_id: result.id,
        };
      } catch (err: any) {
        const errorMessage = err?.message || 'Unable to create post. Please try again.';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [uploadQueue]
  );

  return {
    createPost: createPostWithMedia,
    uploadQueue,
    isSubmitting,
    error,
    reset: () => setError(null),
  };
}

