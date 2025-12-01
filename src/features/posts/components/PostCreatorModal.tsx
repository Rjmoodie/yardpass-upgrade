import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Upload,
  X,
  Video as VideoIcon,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Ban,
  ChevronUp,
  ChevronDown,
  Sparkles,
  History,
  Camera as CameraIcon,
} from 'lucide-react';
import { VideoRecorder } from '@/components/VideoRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileView } from '@/contexts/ProfileViewContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { capturePhotoAsFile } from '@/lib/camera';
import { Capacitor } from '@capacitor/core';
import { useKeyboardPadding } from '@/hooks/useKeyboard';
import { ProfileCompletionModal } from '@/components/auth/ProfileCompletionModal';
import { usePostCreation } from '@/features/posts/hooks/usePostCreation';
import { logger } from '@/utils/logger';

// Optional: if you have analytics
// import { useAnalytics } from '@/hooks/useAnalytics';

interface Event {
  id: string;
  title: string;
  cover_image_url?: string;
}

interface UserTicket {
  id: string;
  event_id: string;
  tier_id: string | null;
  events: Event;
  ticket_tiers: {
    badge_label: string;
    name: string;
  };
}

interface PostCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedEventId?: string;
}

/** ---------- Config ---------- */
const IMAGE_BUCKET = 'event-media';
const MAX_FILES = 6;
const MAX_IMAGE_MB = 8; // hard cap for images
const MAX_VIDEO_MB = 512; // hard cap for videos (Mux accepts large uploads; tune to your plan)
const DRAFT_KEY = (uid?: string) => `liventix-post-draft:${uid || 'anon'}`;
const LAST_EVENT_KEY = (uid?: string) => `liventix-last-event:${uid || 'anon'}`;

// Image preprocessing
const IMG_MAX_DIM = 1920; // max width/height
const IMG_QUALITY = 0.85; // JPEG/WebP export quality

type FileKind = 'image' | 'video';
type FileStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';

type QueuedFile = {
  file: File;
  kind: FileKind;
  status: FileStatus;
  remoteUrl?: string; // image public URL OR mux:playback_id
  errorMsg?: string;
  name: string;
  size: number;
  previewUrl?: string; // thumbnail image URL for local preview
  videoPreviewUrl?: string; // direct video URL for Safari compatibility (playable preview)
  controller?: AbortController; // can cancel uploads
  progress?: number; // 0-100 (upload only; processing not included)
};

/** ---------- Helper Functions ---------- */
const backoff = async <T,>(fn: () => Promise<T>, tries = 3, base = 400) => {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      await sleep(Math.min(4000, base * Math.pow(2, i)));
    }
  }
  throw lastErr;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// basic HEIC->canvas fallback (lossy): draws into canvas via createImageBitmap if the browser can decode it
const maybeTranscodeHeic = async (file: File): Promise<File> => {
  if (!/\.heic$/i.test(file.name) && file.type !== 'image/heic') return file;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext('2d'); if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file; // leave as-is; storage preview may not show it
  }
};

const bytesToMB = (b: number) => +(b / (1024 * 1024)).toFixed(2);
const isImageFile = (f: File) => f.type.startsWith('image') || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name);
const isVideoFile = (f: File) => f.type.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(f.name);

async function uploadImageToSupabase(file: File, userId: string): Promise<string> {
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

/** Ask your edge function to create a Mux Direct Upload and return: { upload_id, upload_url } */
async function createMuxDirectUpload(eventId: string): Promise<{ upload_id: string; upload_url: string }> {
  const { data, error } = await supabase.functions.invoke('mux-create-direct-upload', {
    body: { event_id: eventId },
  });
  if (error) throw error;
  return data;
}

/** Poll your edge function to resolve a Mux upload into a playback_id with backoff. */
async function resolveMuxUploadToPlaybackId(
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

/** Canvas-based image resize + recompress; preserves alpha by exporting to WebP if needed. */
async function preprocessImage(file: File): Promise<File> {
  try {
    if (!isImageFile(file)) return file;

    // Skip small images
    if (bytesToMB(file.size) <= MAX_IMAGE_MB / 2) return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const { width, height } = bitmap;

    const scale = Math.min(1, IMG_MAX_DIM / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    if (scale === 1) {
      // No resize; consider re-encode to reduce size
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const hasAlpha = file.type.includes('png') || file.type.includes('webp') || file.type.includes('avif');
    const mime = hasAlpha ? 'image/webp' : 'image/jpeg';
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), mime, IMG_QUALITY)
    );

    if (!blob) return file;

    // Prefer resized if smaller
    if (blob.size < file.size * 0.9) {
      const ext = hasAlpha ? 'webp' : 'jpg';
      const newName = file.name.replace(/\.[^.]+$/, '') + `-optimized.${ext}`;
      return new File([blob], newName, { type: mime });
    }
    return file;
  } catch {
    return file;
  }
}

export function PostCreatorModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEventId,
}: PostCreatorModalProps) {
  const { user, profile, updateProfileOptimistic } = useAuth();
  const { activeView } = useProfileView();
  // const { track } = useAnalytics?.() ?? { track: () => {} };

  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [isFlashback, setIsFlashback] = useState(false);
  const [flashbackEndDate, setFlashbackEndDate] = useState<string | null>(null);
  const [orgCreatedAt, setOrgCreatedAt] = useState<string | null>(null);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);

  const dropRef = useRef<HTMLDivElement | null>(null);
  const unmountedRef = useRef(false);
  const submittingRef = useRef(false);
  const imageInputId = useId();
  const videoInputId = useId();

  // Use post creation hook
  const { createPost: createPostWithMedia, isSubmitting } = usePostCreation({
    userId: user?.id || '',
    onProgress: (fileIndex, patch) => {
      setQueue((prev) => {
        const copy = [...prev];
        if (copy[fileIndex]) {
          copy[fileIndex] = { ...copy[fileIndex], ...patch };
        }
        return copy;
      });
    },
  });

  // iOS keyboard handling - add 80px buffer for footer buttons
  const keyboardPadding = useKeyboardPadding(80);

  // Load draft + last-event (if no preselect)
  useEffect(() => {
    if (!isOpen) return;
    const key = DRAFT_KEY(user?.id);
    const last = LAST_EVENT_KEY(user?.id);

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const draft = JSON.parse(saved) as { content?: string; eventId?: string };
        if (draft.content) setContent(draft.content);
        if (!preselectedEventId && draft.eventId) setSelectedEventId(draft.eventId);
      }
      if (!preselectedEventId && !selectedEventId) {
        const lastEventId = localStorage.getItem(last || '');
        if (lastEventId) setSelectedEventId(lastEventId);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Persist draft (debounced)
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      const payload = JSON.stringify({ content, eventId: selectedEventId });
      try {
        localStorage.setItem(DRAFT_KEY(user?.id), payload);
      } catch {}
    }, 250);
    return () => clearTimeout(id);
  }, [content, selectedEventId, isOpen, user?.id]);

  // Fetch user's events - both as attendee (tickets) and organizer (created events)
  useEffect(() => {
    if (!isOpen || !user) return;
    let mounted = true;

    (async () => {
      try {
        // Fetch events where user has tickets (attendee role)
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            id,
            event_id,
            tier_id,
            events!fk_tickets_event_id (
              id,
              title,
              cover_image_url
            ),
            ticket_tiers!fk_tickets_tier_id (
              badge_label,
              name
            )
          `)
          .eq('owner_user_id', user.id)
          .in('status', ['issued', 'transferred', 'redeemed']);

        if (ticketError) throw ticketError;
        if (!mounted) return;

        // Fetch organizations the user manages
        const { data: userOrganizations, error: orgError } = await supabase
          .from('org_memberships')
          .select(`
            org_id,
            role,
            organizations!org_memberships_org_id_fkey (
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .in('role', ['owner', 'admin', 'editor']);

        if (orgError) throw orgError;
        if (!mounted) return;

        const orgIds = userOrganizations?.map(org => org.org_id) || [];

        // Fetch events created by user OR owned by their organizations
        let eventsQuery = supabase
          .from('events')
          .select(`
            id,
            title,
            cover_image_url,
            created_by,
            owner_context_type,
            owner_context_id,
            is_flashback,
            flashback_end_date
          `)
          .eq('created_by', user.id);

        // Include events from managed organizations
        if (orgIds.length > 0) {
          eventsQuery = eventsQuery.or(`created_by.eq.${user.id},owner_context_id.in.(${orgIds.join(',')})`);
        }

        const { data: organizedEvents, error: organizedError } = await eventsQuery
          .order('start_at', { ascending: false });

        if (organizedError) throw organizedError;
        if (!mounted) return;

        // Convert tickets to unified format
        const ticketEvents = (ticketData || []).map((ticket: UserTicket) => ({
          id: ticket.id,
          event_id: ticket.event_id,
          tier_id: ticket.tier_id,
          events: ticket.events,
          ticket_tiers: ticket.ticket_tiers,
          source: 'ticket' as const,
        }));

        // Convert organized events to unified format
        const organizerEvents = (organizedEvents || []).map(event => ({
          id: `org-${event.id}`,
          event_id: event.id,
          tier_id: null, // Organizers don't have a specific tier - let posts-create function handle this
          events: {
            id: event.id,
            title: event.title,
            cover_image_url: event.cover_image_url
          },
          ticket_tiers: {
            badge_label: 'ORGANIZER',
            name: 'Organizer'
          },
          source: 'organizer' as const,
        }));

        // Combine and deduplicate by event_id, prioritizing organizer role
        const eventMap = new Map<string, UserTicket>();
        
        // Add ticket events first
        ticketEvents.forEach(event => {
          eventMap.set(event.event_id, event);
        });

        // Add/override with organizer events (organizer role takes priority)
        organizerEvents.forEach(event => {
          eventMap.set(event.event_id, event);
        });

        const allEvents = Array.from(eventMap.values());

        setUserTickets(allEvents);
        console.log('Available events for user:', allEvents.length, allEvents.map(e => ({ id: e.event_id, title: e.events.title })));

        if (preselectedEventId) {
          setSelectedEventId(preselectedEventId);
          console.log('Set selectedEventId to preselected:', preselectedEventId);
        } else if (!selectedEventId && allEvents.length === 1) {
          setSelectedEventId(allEvents[0].event_id);
          console.log('Auto-selected single event:', allEvents[0].event_id);
        } else if (allEvents.length > 1) {
          console.log('Multiple events available, user needs to select one');
        } else {
          console.log('No events available for user');
        }
      } catch (err) {
        console.error('Error fetching user events:', err);
        toast({
          title: 'Error',
          description: 'Failed to load your events',
          variant: 'destructive',
        });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isOpen, user, preselectedEventId, selectedEventId]);

  // Check if selected event is a flashback
  useEffect(() => {
    if (!selectedEventId || !isOpen) {
      setIsFlashback(false);
      setFlashbackEndDate(null);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            is_flashback, 
            flashback_end_date,
            owner_context_id,
            organizations!events_owner_context_id_fkey (
              created_at
            )
          `)
          .eq('id', selectedEventId)
          .single();

        if (error) throw error;
        if (!mounted) return;

        setIsFlashback(data?.is_flashback || false);
        setFlashbackEndDate(data?.flashback_end_date || null);
        setOrgCreatedAt(data?.organizations?.created_at || null);

        if (data?.is_flashback) {
          console.log('🎬 [PostCreator] Flashback event selected:', {
            eventId: selectedEventId,
            flashbackEndDate: data.flashback_end_date,
            orgCreatedAt: data?.organizations?.created_at,
          });
        }
      } catch (error) {
        console.error('[PostCreator] Error checking flashback status:', error);
        if (mounted) {
          setIsFlashback(false);
          setFlashbackEndDate(null);
          setOrgCreatedAt(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedEventId, isOpen]);

  // Revoke object URLs on unmount + mark unmounted
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      queue.forEach((q) => {
        if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
        if (q.videoPreviewUrl) URL.revokeObjectURL(q.videoPreviewUrl);
      });
    };
  }, [queue]);

  // Warn if leaving mid-upload or with non-empty content
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const uploading = queue.some(q => q.status === 'uploading' || q.status === 'processing');
      if (uploading || content.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [queue, content]);

  const selectedTicket = useMemo(
    () => userTickets.find((t) => t.event_id === selectedEventId),
    [userTickets, selectedEventId]
  );

  /** -------------- File intake -------------- */
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const existingCount = queue.length;
      const allowed = Math.max(0, MAX_FILES - existingCount);
      const slice = files.slice(0, allowed);
      const rejected = files.slice(allowed);

      if (rejected.length) {
        toast({
          title: 'Too many files',
          description: `You can attach up to ${MAX_FILES} items per post.`,
          variant: 'destructive',
        });
      }

      const next: QueuedFile[] = [];

      for (let i = 0; i < slice.length; i++) {
        let f = slice[i];

        // HEIC → JPEG fallback
        f = await maybeTranscodeHeic(f);

        const kind: FileKind = isVideoFile(f)
          ? 'video'
          : isImageFile(f)
          ? 'image'
          : f.type.startsWith('audio')
          ? 'video'
          : 'image';

        const sizeMB = bytesToMB(f.size);

        if (kind === 'image' && sizeMB > MAX_IMAGE_MB) {
          const optimized = await preprocessImage(f);
          if (bytesToMB(optimized.size) > MAX_IMAGE_MB) {
            toast({
              title: 'Image too large',
              description: `${f.name} is ${sizeMB}MB (limit ${MAX_IMAGE_MB}MB).`,
              variant: 'destructive',
            });
            continue;
          }
          f = optimized;
        } else if (kind === 'video' && sizeMB > MAX_VIDEO_MB) {
          toast({
            title: 'Video too large',
            description: `${f.name} is ${sizeMB}MB (limit ${MAX_VIDEO_MB}MB).`,
            variant: 'destructive',
          });
          continue;
        }

        // de-dupe by name+size
        if (queue.some((q) => q.name === f.name && q.size === f.size)) continue;

        // Quick poster for videos (best-effort, no decode = icon fallback)
        // For Safari mobile, also create direct video URL for playback preview
        let previewUrl: string | undefined = undefined;
        let videoPreviewUrl: string | undefined = undefined; // Direct video URL for Safari compatibility
        if (kind === 'image') {
          previewUrl = URL.createObjectURL(f);
        } else if (kind === 'video') {
          // Create direct video URL for Safari mobile compatibility
          videoPreviewUrl = URL.createObjectURL(f);
          
          // Try to generate thumbnail preview (may fail on Safari)
          try {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.crossOrigin = 'anonymous'; // Help with Safari CORS
            v.src = videoPreviewUrl;
            
            // Set a timeout for Safari mobile which can be slow to load metadata
            const timeout = new Promise<void>((_, rej) => 
              setTimeout(() => rej(new Error('timeout')), 3000)
            );
            
            await Promise.race([
              new Promise<void>((res, rej) => {
                v.onloadeddata = () => {
                  // Seek to first frame for better thumbnail
                  v.currentTime = 0.1;
                  res();
                };
                v.onerror = () => rej(new Error('video preview failed'));
                v.onseeked = () => res();
              }),
              timeout
            ]);
            
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = Math.round((v.videoHeight / v.videoWidth) * 320) || 180;
            const ctx = canvas.getContext('2d');
            if (ctx && v.videoWidth > 0 && v.videoHeight > 0) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.7));
              if (blob) previewUrl = URL.createObjectURL(blob);
            }
          } catch (err) {
            logger.debug('Video thumbnail generation failed (this is OK on Safari):', err);
            // On Safari, we'll use the direct video URL as fallback
          }
        }

        next.push({
          file: f,
          kind,
          status: 'queued',
          name: f.name,
          size: f.size,
          previewUrl,
          videoPreviewUrl, // Store direct video URL for Safari preview
          progress: 0,
        });
      }

      if (next.length) setQueue((q) => [...q, ...next]);
    },
    [queue]
  );

  const handleFilePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files || []);
    console.log('Files selected:', files.length, files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    // fire-and-forget async (preprocess can be async)
    addFiles(files);
    ev.currentTarget.value = ''; // allow reselecting same file
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files || []);
      addFiles(files);
    },
    [addFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const files: File[] = [];
      for (const it of items) {
        if (!it.type) continue;
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        addFiles(files);
        e.preventDefault();
      }
    },
    [addFiles]
  );

  const removeQueued = (name: string) => {
    setQueue((q) => {
      const target = q.find((f) => f.name === name);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.videoPreviewUrl) URL.revokeObjectURL(target.videoPreviewUrl);
      return q.filter((f) => f.name !== name);
    });
  };

  const cancelUpload = (name: string) => {
    setQueue((q) => {
      const idx = q.findIndex((f) => f.name === name);
      if (idx === -1) return q;
      try {
        q[idx].controller?.abort();
      } catch {}
      return q.map((f, i) => (i === idx ? { ...f, status: 'canceled', controller: undefined } : f));
    });
  };

  const retryUpload = (name: string) => {
    setQueue((q) =>
      q.map((f) =>
        f.name === name
          ? { ...f, status: 'queued', errorMsg: undefined, remoteUrl: undefined, progress: 0 }
          : f
      )
    );
  };

  const moveQueued = (name: string, dir: -1 | 1) => {
    setQueue((q) => {
      const idx = q.findIndex((f) => f.name === name);
      if (idx === -1) return q;
      const next = [...q];
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= next.length) return q;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const clearAll = () => {
    setQueue((q) => {
      q.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        if (f.videoPreviewUrl) URL.revokeObjectURL(f.videoPreviewUrl);
      });
      return [];
    });
  };

  /** -------------- Upload pipeline -------------- */
  const uploadMuxWithProgress = (url: string, file: File, controller: AbortController, onProgress: (p: number) => void) =>
    new Promise<void>((resolve, reject) => {
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

  const uploadQueue = async (): Promise<string[]> => {
    const results: string[] = [];
    const items = [...queue];

    // Helper to update one item in state by name
    const updateByIndex = (i: number, patch: Partial<QueuedFile>) => {
      items[i] = { ...items[i], ...patch };
      setQueue((prev) => {
        const copy = [...prev];
        const key = items[i].name + items[i].size;
        const idx = copy.findIndex((f) => f.name === items[i].name && f.size === items[i].size);
        if (idx !== -1) copy[idx] = { ...copy[idx], ...patch };
        return copy;
      });
    };

    // Upload worker for one item
    const work = async (i: number) => {
      const item = items[i];
      if (!item) return;
      if (item.status === 'done' && item.remoteUrl) { results.push(item.remoteUrl); return; }
      if (item.status === 'canceled') return;

      try {
        const controller = new AbortController();
        updateByIndex(i, { status: 'uploading', controller, errorMsg: undefined, progress: 0 });

        if (item.kind === 'image') {
          const publicUrl = await backoff(() => uploadImageToSupabase(item.file, user.id));
          updateByIndex(i, { status: 'done', remoteUrl: publicUrl, controller: undefined, progress: 100 });
          results.push(publicUrl);
        } else {
          if (!selectedEventId) throw new Error('Select an event before uploading video');

          // Create direct upload
          const { upload_id, upload_url } = await backoff(() => createMuxDirectUpload(selectedEventId));

          // PUT to Mux with progress
          await backoff(() => uploadMuxWithProgress(
            upload_url,
            item.file,
            controller,
            (p) => updateByIndex(i, { progress: p })
          ), 2, 800);

          // Mark processing
          updateByIndex(i, { status: 'processing', controller: undefined });

          // Resolve to playback_id
          const playback_id = await backoff(() => resolveMuxUploadToPlaybackId(upload_id), 6, 1200);
          const muxUrl = `mux:${playback_id}`;
          updateByIndex(i, { status: 'done', remoteUrl: muxUrl, progress: 100 });
          results.push(muxUrl);
        }
      } catch (err: any) {
        const msg = err?.message || 'Upload failed';
        updateByIndex(i, { status: 'error', controller: undefined, errorMsg: msg });
        toast({ title: 'Upload Failed', description: `Failed to upload ${items[i].name}: ${msg}`, variant: 'destructive' });
        // NOTE: Unlike before, do not throw here → other files keep going.
        // If you prefer to cancel all on first error, rethrow.
      }
    };

    // Limited concurrency (e.g., 2 at a time)
    const CONCURRENCY = 2;
    const queueIdxs = items.map((_, i) => i);
    const runners: Promise<any>[] = [];
    for (let k = 0; k < CONCURRENCY; k++) {
      runners.push((async () => {
        while (queueIdxs.length) {
          const i = queueIdxs.shift()!;
          await work(i);
        }
      })());
    }
    await Promise.all(runners);

    return results;
  };

  /** -------------- Submit -------------- */
  const canPost = !!selectedEventId && content.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    
    // ✅ USERNAME REQUIREMENT: Check if user has username before allowing posts
    if (!profile?.username) {
      setShowProfileCompletion(true);
      return;
    }
    
    if (!selectedEventId || !content.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select an event and add content',
        variant: 'destructive',
      });
      return;
    }

    // FLASHBACK VALIDATION
    if (isFlashback) {
      // 1. Media required (queued files are valid - they'll upload on submit)
      const hasMedia = queue.some(q => 
        q.status === 'queued' || 
        q.status === 'uploading' || 
        q.status === 'processing' || 
        q.status === 'done'
      );
      if (!hasMedia) {
        toast({
          title: 'Media Required',
          description: 'Flashback posts must include at least one photo or video',
          variant: 'destructive',
        });
        return;
      }

      // 2. 300 character limit
      if (content.trim().length > 300) {
        toast({
          title: 'Caption Too Long',
          description: `Flashback captions are limited to 300 characters (currently ${content.trim().length})`,
          variant: 'destructive',
        });
        return;
      }

      // 3. Check if posting window is still open (based on org onboarding + 90 days)
      if (orgCreatedAt) {
        const windowEnd = new Date(new Date(orgCreatedAt).getTime() + 90 * 24 * 60 * 60 * 1000);
        if (new Date() > windowEnd) {
          toast({
            title: 'Posting Window Closed',
            description: `The posting period for Flashback events ended on ${windowEnd.toLocaleDateString()} (90 days after organization onboarding)`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    submittingRef.current = true;
    try {
      // Remember user's last used event
      try {
        localStorage.setItem(LAST_EVENT_KEY(user?.id), selectedEventId);
      } catch {}

      const userTicket = userTickets.find((t) => t.event_id === selectedEventId);

      // Use hook to create post
      const result = await createPostWithMedia(
        {
          event_id: selectedEventId,
          text: content.trim(),
          ticket_tier_id: userTicket?.tier_id,
        },
        queue
      );

      if (result.success) {
        toast({
          title: 'Posted Successfully!',
          description: `Your post has been shared!`,
        });

        // reset
        setContent('');
        clearAll();
        if (!preselectedEventId) setSelectedEventId('');

        // clear draft
        try {
          localStorage.removeItem(DRAFT_KEY(user?.id));
        } catch {}

        onSuccess?.();
        onClose();
      } else {
        toast({
          title: 'Post Failed',
          description: result.error || 'Unable to create post. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('Post creation failed:', err);
      toast({
        title: 'Post Failed',
        description: err?.message || 'Unable to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      submittingRef.current = false;
    }
  };

  // keyboard: Ctrl/Cmd + Enter
  const onKeyDownComposer = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canPost) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="w-full max-w-3xl p-0 overflow-hidden border-none bg-transparent shadow-none max-h-[92dvh] [&>button]:!hidden" 
          aria-busy={isSubmitting}
        >
          <div 
            className="flex h-[92dvh] flex-col rounded-2xl border border-border/40 bg-background shadow-[0_20px_48px_rgba(0,0,0,0.15)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="border-b border-border/30">
              <DialogHeader className="px-6 pt-4 pb-3.5 sm:px-8 sm:pt-5 sm:pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground/80">
                    Composer
                  </span>
                  <DialogTitle
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-medium tracking-tight text-foreground"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary/60" />
                    <span>Create post</span>
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Create a new event post by adding media and a caption.
                  </DialogDescription>
                </div>
              </DialogHeader>
            </div>

            <div 
              className="flex-1 overflow-y-auto px-4 sm:px-6 pb-nav" 
              style={keyboardPadding}
              onPaste={onPaste}
            >
              <div className="space-y-4">
                {/* User Profile + Event Context */}
                <div className="flex items-center gap-3 px-1 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.photo_url || ''} />
                    <AvatarFallback className="text-xs font-medium bg-muted">{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate text-foreground">
                      {profile?.display_name || 'You'}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      {selectedTicket?.events?.title && (
                        <>
                          <span className="truncate max-w-[180px] text-foreground/70">
                            {selectedTicket.events.title}
                          </span>
                          <span className="text-muted-foreground/30">•</span>
                        </>
                      )}
                      <span>{isFlashback ? 'Flashback post' : 'Event post'}</span>
                    </div>
                  </div>
                  {selectedTicket && (
                    <Badge
                      variant="neutral"
                      className="shrink-0 rounded-full text-[10px] px-2 py-0.5 font-medium bg-primary/10 text-primary border-primary/20"
                    >
                      {selectedTicket.ticket_tiers.badge_label}
                    </Badge>
                  )}
                </div>

                {/* Event Selection */}
                {!preselectedEventId && (
                  <div className="px-2">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2 block">
                      Event
                    </label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="rounded-xl border-border/60 bg-background h-10 text-sm">
                        <SelectValue
                          placeholder={
                            selectedEventId
                              ? 'Select an event'
                              : 'Select an event to start posting…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {userTickets.map((ticket) => (
                          <SelectItem key={ticket.event_id} value={ticket.event_id}>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[240px]">{ticket.events.title}</span>
                              <Badge variant="neutral" className="text-xs">
                                {ticket.ticket_tiers.badge_label}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Flashback Notice */}
                {isFlashback && (
                  <Alert className="mx-2 rounded-xl border-purple-500/20 bg-purple-500/5 px-3 py-2.5">
                    <History className="h-3.5 w-3.5 text-purple-400/80" />
                    <AlertDescription className="text-[11px] text-foreground/70 space-y-1">
                      <span>
                        <span className="font-semibold text-purple-300/90">Flashback Post:</span>{' '}
                        At least one photo or video required. Caption limited to 300 characters.
                      </span>
                      {orgCreatedAt && (() => {
                        const windowEnd = new Date(new Date(orgCreatedAt).getTime() + 90 * 24 * 60 * 60 * 1000);
                        const today = new Date();
                        const daysLeft = Math.max(0, Math.ceil((windowEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
                        
                        return daysLeft === 0 ? (
                          <span className="block text-[10px] text-amber-400/90 font-medium">
                              ⚠️ Posting window has closed ({windowEnd.toLocaleDateString()})
                            </span>
                        ) : (
                          <span className="block text-[10px] text-green-400/90 font-medium">
                              ✓ {daysLeft} days left to post (until {windowEnd.toLocaleDateString()})
                            </span>
                          );
                      })()}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Composer + Media in responsive layout */}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
                  {/* LEFT: Composer + actions */}
                  <div className="space-y-4 min-h-0 order-last lg:order-first">
                    {/* Composer */}
                    <div
                      className={`rounded-xl border border-border/40 bg-background p-4 sm:p-5 transition-all ${
                        isDragging ? 'border-primary/40 bg-primary/5' : ''
                      }`}
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                    >
                      {/* Inline media strip - More visible on mobile */}
                      {queue.length > 0 && (
                        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                          {queue.map((q) => (
                            <div
                              key={q.name + q.size}
                              className="relative h-16 w-24 sm:h-14 sm:w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted"
                            >
                              {q.kind === 'image' && q.previewUrl ? (
                                <img src={q.previewUrl} alt={q.name} className="h-full w-full object-cover" />
                              ) : q.kind === 'video' && (q.previewUrl || q.videoPreviewUrl) ? (
                                <>
                                  {q.previewUrl ? (
                                    <img 
                                      src={q.previewUrl} 
                                      alt={`${q.name} preview`} 
                                      className="h-full w-full object-cover" 
                                    />
                                  ) : (
                                    <video
                                      src={q.videoPreviewUrl}
                                      className="h-full w-full object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />
                                  )}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <VideoIcon className="h-3 w-3 text-white drop-shadow-lg" />
                                  </div>
                                </>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  {q.kind === 'video' ? <VideoIcon className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                                </div>
                              )}
                              {(q.status === 'uploading' || q.status === 'processing') && (
                                <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-full bg-black/40">
                                  <div
                                    className="h-full rounded-full bg-primary transition-[width]"
                                    style={{ width: `${Math.max(5, Math.min(100, q.progress || 5))}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Textarea */}
                      <Textarea
                        placeholder={
                          isFlashback
                            ? 'Share your favorite moment from this event... 📸'
                            : "Share updates and highlight moments"
                        }
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="
                          min-h-[120px] max-h-[200px]
                          sm:min-h-[160px] sm:max-h-[260px]
                          resize-none border-none bg-transparent p-0
                          text-base leading-relaxed
                          focus-visible:ring-0
                          placeholder:text-muted-foreground/60
                        "
                        maxLength={isFlashback ? 300 : 2000}
                        enterKeyHint="done"
                        style={{ fontSize: '16px' }}
                        onKeyDown={onKeyDownComposer}
                        aria-label="Post content"
                      />

                      {/* Composer footer */}
                      <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {/* Add Files Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`flex items-center gap-1.5 h-8 px-3 rounded-full hover:bg-primary/10 transition-colors text-xs ${
                              isFlashback && queue.length === 0 ? 'text-purple-300' : ''
                            }`}
                            title={isFlashback ? 'Media required for flashback' : 'Add photos or videos'}
                            onClick={() => {
                              document.getElementById(imageInputId)?.click();
                            }}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Media</span>
                            {isFlashback && queue.length === 0 && <span className="flex h-2 w-2 rounded-full bg-purple-400" />}
                          </Button>
                          <input
                            id={imageInputId}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleFilePick}
                            className="hidden"
                          />

                          {/* Camera (native only) */}
                          {Capacitor.isNativePlatform() && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="flex items-center gap-2 h-8 px-3 rounded-full hover:bg-primary/10 transition-colors text-xs disabled:opacity-40"
                              onClick={async () => {
                                try {
                                  const file = await capturePhotoAsFile();
                                  if (!file) return;
                                  await addFiles([file]);
                                } catch (err: any) {
                                  console.error('Camera capture failed:', err);
                                  toast({
                                    title: 'Camera Error',
                                    description:
                                      err?.message ||
                                      'Unable to capture photo.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                              title="Take photo or choose from library"
                            >
                              <CameraIcon className="h-4 w-4" />
                              <span className="hidden sm:inline">Camera</span>
                            </Button>
                          )}

                          {/* Record */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-2 h-8 px-3 rounded-full hover:bg-red-500/10 transition-colors text-xs disabled:opacity-40"
                            onClick={() => {
                              if (!selectedEventId) {
                                toast({
                                  title: 'Select an event first',
                                  description:
                                    'Please choose an event before recording a video.',
                                  variant: 'destructive',
                                });
                                return;
                              }
                              setShowVideoRecorder(true);
                            }}
                            title={
                              !selectedEventId
                                ? 'Select an event first'
                                : 'Record video'
                            }
                            disabled={!selectedEventId}
                          >
                            <VideoIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Record</span>
                          </Button>
                        </div>

                        {/* Counters */}
                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <span
                            className={`
                              text-[11px] font-medium
                              ${
                                isFlashback && content.trim().length > 300
                                  ? 'text-destructive'
                                  : isFlashback &&
                                    content.trim().length > 250
                                  ? 'text-amber-500'
                                  : 'text-muted-foreground'
                              }
                            `}
                          >
                            {isFlashback
                              ? `${content.trim().length} / 300`
                              : `${content.length} / 2000`}
                          </span>

                          {queue.length > 0 && (
                            <span className="text-[11px] font-medium text-primary">
                              {queue.filter((q) => q.status === 'done').length > 0
                                ? `${queue.filter((q) => q.status === 'done').length}/${queue.length} uploaded`
                                : `${queue.length} ${
                                    queue.length === 1 ? 'file' : 'files'
                                  } attached`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end pt-3">
                        <Button
                          variant="ghost"
                          onClick={onClose}
                          className="rounded-full h-9 sm:h-10 sm:w-auto text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSubmit}
                          disabled={!canPost}
                          className="rounded-full h-9 sm:h-10 bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:shadow-md px-4 sm:px-6 sm:min-w-[140px] transition-all"
                          aria-busy={isSubmitting}
                        >
                          {isSubmitting ? (
                            <div className="flex items-center gap-2">
                              <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                              <span className="text-xs sm:text-sm">Posting…</span>
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm">Post update</span>
                          )}
                        </Button>
                      </div>
                  </div>

                  {/* RIGHT: media preview gallery */}
                  {queue.length > 0 && (
                    <div className="space-y-4 order-first lg:order-last">
                      <div
                        className="
                          space-y-3 rounded-xl border border-border/40 bg-background
                          p-3 sm:p-4
                          max-h-[340px] sm:max-h-[380px] lg:max-h-[420px]
                          lg:sticky lg:top-4
                          overflow-y-auto
                        "
                        aria-label="Preview uploaded media"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Attached media</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={clearAll}
                            className="rounded-full text-[11px] h-8 px-3"
                          >
                            <X className="mr-1 h-3 w-3" />
                            Clear
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          {queue.map((q) => (
                            <div
                              key={q.name + q.size}
                              className="flex flex-col rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm"
                            >
                              {/* Media thumbnail */}
                              <div className="relative aspect-video w-full overflow-hidden rounded-xl border-2 border-border/70 bg-black cursor-pointer group">
                                {q.kind === 'image' && q.previewUrl ? (
                                  <img src={q.previewUrl} className="h-full w-full object-cover" alt={q.name} />
                                ) : q.kind === 'image' ? (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                ) : q.kind === 'video' && q.videoPreviewUrl ? (
                                  // ✅ VIDEO PREVIEW: Always show playable video for Safari compatibility
                                  <video
                                    src={q.videoPreviewUrl}
                                    className="h-full w-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                    controls={false}
                                    onLoadedMetadata={(e) => {
                                      // Set video to first frame for preview thumbnail
                                      const video = e.currentTarget;
                                      video.currentTime = 0.1;
                                    }}
                                    onClick={(e) => {
                                      // Allow clicking to play/pause on mobile Safari
                                      const video = e.currentTarget;
                                      if (video.paused) {
                                        video.play().catch(() => {});
                                      } else {
                                        video.pause();
                                      }
                                    }}
                                  />
                                ) : q.kind === 'video' && q.previewUrl ? (
                                  // Fallback to thumbnail if video URL not available
                                  <img 
                                    src={q.previewUrl} 
                                    className="h-full w-full object-cover" 
                                    alt={`${q.name} preview`}
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted">
                                    <VideoIcon className="h-8 w-8 text-muted-foreground/50" />
                                    <span className="text-xs text-muted-foreground/70">Loading video...</span>
                                  </div>
                                )}
                                {/* Video play indicator - more visible */}
                                {q.kind === 'video' && q.videoPreviewUrl && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors pointer-events-none">
                                    <div className="rounded-full bg-black/70 p-3 shadow-lg">
                                      <VideoIcon className="h-5 w-5 text-white" />
                                    </div>
                                  </div>
                                )}
                                {/* Video filename overlay on hover - helpful for confirmation */}
                                {q.kind === 'video' && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                                    <p className="text-xs font-medium text-white truncate" title={q.name}>
                                      {q.name}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 flex flex-col gap-2">
                                <div className="flex flex-col gap-1">
                                  <div className="truncate text-xs font-semibold" title={q.name}>
                                    {q.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Badge variant="neutral" className="rounded-full text-[9px] uppercase tracking-wide px-1.5 py-0">
                                      {q.kind === 'image' ? 'IMG' : q.file.type.startsWith('audio') ? 'AUD' : 'VID'}
                                    </Badge>
                                    <span>{bytesToMB(q.size)} MB</span>
                                    {typeof q.progress === 'number' &&
                                      (q.status === 'uploading' || q.status === 'processing') && (
                                        <span className="font-medium">• {q.progress}%</span>
                                      )}
                                    {q.errorMsg && <span className="text-destructive">• {q.errorMsg}</span>}
                                  </div>
                                </div>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeQueued(q.name)}
                                  title="Remove"
                                  disabled={q.status === 'uploading' || q.status === 'processing'}
                                  className="w-full rounded-full text-xs h-7"
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  Remove
                                </Button>

                                {(q.status === 'uploading' || q.status === 'processing') && (
                                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary transition-[width]"
                                      style={{ width: `${Math.max(5, Math.min(100, q.progress || 5))}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showVideoRecorder && selectedEventId && (
        <VideoRecorder
          eventId={selectedEventId}
          onClose={() => setShowVideoRecorder(false)}
          onSave={(videoBlob) => {
            const fileType = videoBlob.type || 'video/webm';
            const fileName = `liventix-recording-${Date.now()}.webm`;
            const recordedFile = new File([videoBlob], fileName, { type: fileType });
            void addFiles([recordedFile]);
            setShowVideoRecorder(false);
          }}
        />
      )}

      {/* Profile Completion Modal - Required for guests to post */}
      <ProfileCompletionModal
        isOpen={showProfileCompletion}
        onClose={() => setShowProfileCompletion(false)}
        onSuccess={(username) => {
          setShowProfileCompletion(false);

          if (user?.id) {
            updateProfileOptimistic({ username });
          }

          toast({
            title: 'Success!',
            description: `Welcome @${username}! You can now create your post.`,
          });
        }}
        userId={user?.id || ''}
        displayName={profile?.display_name}
      />
    </>
  );
}

export default PostCreatorModal;
