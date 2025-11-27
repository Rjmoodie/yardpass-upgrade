/**
 * API layer for post creation
 * 
 * Handles all Supabase and Edge Function calls for posts.
 */

import { supabase } from '@/integrations/supabase/client';

const IMAGE_BUCKET = 'event-media';
const MAX_IMAGE_MB = 8;
const IMG_MAX_DIM = 1920;
const IMG_QUALITY = 0.85;

// Helper functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const bytesToMB = (b: number) => +(b / (1024 * 1024)).toFixed(2);
const isImageFile = (f: File) => f.type.startsWith('image') || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name);

export const backoff = async <T,>(fn: () => Promise<T>, tries = 3, base = 400): Promise<T> => {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(Math.min(4000, base * Math.pow(2, i)));
    }
  }
  throw lastErr;
};

/**
 * Upload image to Supabase Storage
 */
export async function uploadImageToSupabase(file: File, userId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2);
  const path = `${userId}/post-${timestamp}-${random}.${ext}`;
  
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  
  if (error) throw error;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Create Mux direct upload for video
 */
export async function createMuxDirectUpload(eventId: string): Promise<{ upload_id: string; upload_url: string }> {
  const { data, error } = await supabase.functions.invoke('mux-create-direct-upload', {
    body: { event_id: eventId },
  });
  
  if (error) throw error;
  return data;
}

/**
 * Resolve Mux upload to playback ID
 */
export async function resolveMuxUploadToPlaybackId(
  upload_id: string,
  opts: { attempts?: number; baseMs?: number; maxMs?: number } = {}
): Promise<string> {
  const attempts = opts.attempts ?? 15;
  const base = opts.baseMs ?? 1200;
  const max = opts.maxMs ?? 5000;

  let wait = base;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await supabase.functions.invoke('resolve-mux-upload', {
      body: { upload_id },
    });
    
    if (error) throw error;

    if (data?.status === 'ready' && data?.playback_id) {
      return data.playback_id as string;
    }
    
    if (data?.status === 'errored') {
      throw new Error(data?.message || 'Mux processing failed');
    }
    
    await sleep(wait);
    wait = Math.min(max, Math.ceil(wait * 1.4));
  }
  
  throw new Error('Mux processing timed out');
}

/**
 * Upload video to Mux with progress tracking
 */
export function uploadMuxWithProgress(
  url: string,
  file: File,
  controller: AbortController,
  onProgress: (p: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
      onProgress(pct);
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Mux upload failed (${xhr.status})`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Mux upload network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    
    controller.signal.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}

/**
 * Transcode HEIC images to JPEG via canvas
 */
export async function maybeTranscodeHeic(file: File): Promise<File> {
  if (!/\.heic$/i.test(file.name) && file.type !== 'image/heic') return file;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.9)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file; // leave as-is
  }
}

/**
 * Preprocess image: resize and compress if needed
 */
export async function preprocessImage(file: File): Promise<File> {
  try {
    if (!isImageFile(file)) return file;

    // Skip small images
    if (bytesToMB(file.size) <= MAX_IMAGE_MB / 2) return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const { width, height } = bitmap;

    const scale = Math.min(1, IMG_MAX_DIM / Math.max(width, height));
    if (scale >= 1) return file; // no resize needed

    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    const hasAlpha = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const mime = hasAlpha ? 'image/webp' : 'image/jpeg';
    const ext = hasAlpha ? 'webp' : 'jpg';

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), mime, IMG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mime });
  } catch {
    return file;
  }
}

/**
 * Create a post via Edge Function
 */
export async function createPost(data: {
  event_id: string;
  text: string;
  media_urls: string[];
  ticket_tier_id?: string | null;
}): Promise<{ id: string; event_title: string }> {
  const { data: result, error } = await supabase.functions.invoke('posts-create', {
    body: data,
  });
  
  if (error) throw error;
  
  return result?.data;
}

