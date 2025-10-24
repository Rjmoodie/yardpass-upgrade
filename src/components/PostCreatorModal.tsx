import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { VideoRecorder } from './VideoRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileView } from '@/contexts/ProfileViewContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
const DRAFT_KEY = (uid?: string) => `yardpass-post-draft:${uid || 'anon'}`;
const LAST_EVENT_KEY = (uid?: string) => `yardpass-last-event:${uid || 'anon'}`;

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
  previewUrl?: string; // object URL for local preview
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

async function uploadImageToSupabase(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
  const { user, profile } = useAuth();
  const { activeView } = useProfileView();
  // const { track } = useAnalytics?.() ?? { track: () => {} };

  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);

  const dropRef = useRef<HTMLDivElement | null>(null);
  const unmountedRef = useRef(false);
  const submittingRef = useRef(false);
  const imageInputId = useId();
  const videoInputId = useId();

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
            owner_context_id
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
        console.log('Available events for user:', allEvents.length, allEvents.map(e => ({ id: e.event_id, title: e.events.title, source: e.source })));

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

  // Revoke object URLs on unmount + mark unmounted
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      queue.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl));
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
        let previewUrl: string | undefined = undefined;
        if (kind === 'image') {
          previewUrl = URL.createObjectURL(f);
        } else if (kind === 'video') {
          try {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.src = URL.createObjectURL(f);
            await new Promise<void>((res, rej) => {
              v.onloadeddata = () => res();
              v.onerror = () => rej(new Error('video preview failed'));
            });
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = Math.round((v.videoHeight / v.videoWidth) * 320) || 180;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.7));
              if (blob) previewUrl = URL.createObjectURL(blob);
            }
            // revoke raw video preview if created
            URL.revokeObjectURL(v.src);
          } catch {}
        }

        next.push({
          file: f,
          kind,
          status: 'queued',
          name: f.name,
          size: f.size,
          previewUrl,
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
      q.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
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
          const publicUrl = await backoff(() => uploadImageToSupabase(item.file));
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
  const canPost = !!selectedEventId && content.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!selectedEventId || !content.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select an event and add content',
        variant: 'destructive',
      });
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Remember user’s last used event
      try {
        localStorage.setItem(LAST_EVENT_KEY(user?.id), selectedEventId);
      } catch {}

      const media_urls = await uploadQueue();

      const userTicket = userTickets.find((t) => t.event_id === selectedEventId);

      const { data: result, error } = await supabase.functions.invoke('posts-create', {
        body: {
          event_id: selectedEventId,
          text: content,
          media_urls,
          ticket_tier_id: userTicket?.tier_id,
        },
      });
      if (error) throw error;

      // track?.('post_created', { event_id: selectedEventId, media_count: media_urls.length });

      toast({
        title: 'Posted Successfully!',
        description: `Your post has been shared to ${result?.data?.event_title || 'the event'}`,
      });

      window.dispatchEvent(
        new CustomEvent('postCreated', {
          detail: {
            eventId: selectedEventId,
            postId: result?.data?.id,
            eventTitle: result?.data?.event_title,
            timestamp: new Date().toISOString(),
          },
        })
      );

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
    } catch (err: any) {
      console.error('Post creation failed:', err);
      toast({
        title: 'Post Failed',
        description: err?.message || 'Unable to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden border-none bg-transparent shadow-none">
          <div className="flex max-h-[90vh] flex-col rounded-3xl border border-border/60 bg-background/95 shadow-2xl">
            <div className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/20 via-background/60 to-background" />
              <DialogHeader className="relative px-6 pt-6 pb-5">
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Share a moment
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Capture what's happening and bring your network along.
                </p>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6" onPaste={onPaste}>
              <div className="space-y-6">
                {/* User Profile */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 ring-2 ring-primary/30">
                      <AvatarImage src={profile?.photo_url || ''} />
                      <AvatarFallback>{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold">{profile?.display_name || 'You'}</div>
                      <div className="text-xs text-muted-foreground">{activeView === 'public' ? 'Posting publicly' : 'Network update'}</div>
                    </div>
                  </div>
                  {selectedTicket && (
                    <Badge variant="outline" className="rounded-full text-xs" title={selectedTicket.ticket_tiers.name}>
                      {selectedTicket.ticket_tiers.badge_label}
                    </Badge>
                  )}
                </div>

                {/* Event Selection */}
                {!preselectedEventId && (
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Posting to
                    </label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="mt-2 rounded-xl border-border/70 bg-background/80">
                        <SelectValue placeholder="Choose an event to post to" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {userTickets.map((ticket) => (
                          <SelectItem key={ticket.event_id} value={ticket.event_id}>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[240px]">{ticket.events.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {ticket.ticket_tiers.badge_label}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Composer */}
                <div 
                  className={`rounded-3xl border border-border/60 bg-background/80 p-5 shadow-inner transition-all ${
                    isDragging ? 'border-primary bg-primary/5' : ''
                  }`}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                >
                  <Textarea
                    placeholder="What's the vibe? Share the story, shout out a set, or drop some highlights…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[150px] resize-none border-none bg-transparent p-0 text-base leading-relaxed focus-visible:ring-0"
                    maxLength={2000}
                    onKeyDown={onKeyDownComposer}
                    aria-label="Post content"
                  />

                  {/* Simple Media Controls */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                    <div className="flex items-center gap-2">
                      {/* Add Files Button */}
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-2 h-9 px-3 rounded-full hover:bg-primary/10 transition-colors"
                        title="Add photos or videos"
                        onClick={() => {
                          console.log('Upload button clicked, triggering file input');
                          document.getElementById(imageInputId)?.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        <span className="text-xs font-medium hidden sm:inline">Media</span>
                      </Button>
                      <input
                        id={imageInputId}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleFilePick}
                        className="hidden"
                      />
                      
                      {/* Record Video Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 h-9 px-3 rounded-full hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        onClick={() => {
                          console.log('Record video button clicked, selectedEventId:', selectedEventId);
                          if (!selectedEventId) {
                            toast({
                              title: 'Select an event first',
                              description: 'Please choose an event before recording a video.',
                              variant: 'destructive'
                            });
                            return;
                          }
                          console.log('Opening video recorder');
                          setShowVideoRecorder(true);
                        }}
                        title={!selectedEventId ? 'Select an event first' : 'Record video'}
                        disabled={!selectedEventId}
                      >
                        <VideoIcon className="h-4 w-4" />
                        <span className="text-xs font-medium hidden sm:inline">Record</span>
                      </Button>
                    </div>
                    
                    {/* Character Counter & Upload Status */}
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground">
                        {content.length}/2000
                      </div>
                      {queue.length > 0 && (
                        <div className="text-xs font-medium text-primary">
                          {queue.filter(q => q.status === 'done').length}/{queue.length} ready
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Media Queue */}
                <div className="space-y-4">

                  {queue.length > 0 && (
                    <div className="space-y-3 rounded-3xl border border-border/60 bg-background/80 p-4 shadow-inner">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">Attached media</div>
                        <Button size="sm" variant="ghost" onClick={clearAll} className="rounded-full">
                          <X className="mr-1 h-4 w-4" /> Clear all
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {queue.map((q, idx) => (
                          <div
                            key={q.name + q.size}
                            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm sm:flex-row sm:items-stretch"
                          >
                            <div className="flex items-center justify-center sm:w-32">
                              <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-border/70 bg-muted">
                                {q.kind === 'image' && q.previewUrl ? (
                                  <img src={q.previewUrl} className="h-full w-full object-cover" alt="" />
                                ) : q.kind === 'image' ? (
                                  <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
                                ) : (
                                  <VideoIcon className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            <div className="flex flex-1 flex-col gap-2">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="truncate text-sm font-semibold" title={q.name}>
                                    {q.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
                                      {q.kind === 'image'
                                        ? 'Image'
                                        : q.file.type.startsWith('audio')
                                        ? 'Audio'
                                        : 'Video'}
                                    </Badge>
                                    <span>{bytesToMB(q.size)} MB</span>
                                    <span>• {q.status}</span>
                                    {typeof q.progress === 'number' && (q.status === 'uploading' || q.status === 'processing') && (
                                      <span>• {q.progress}%</span>
                                    )}
                                    {q.errorMsg && <span className="text-destructive">• {q.errorMsg}</span>}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => moveQueued(q.name, -1)}
                                    title="Move up"
                                    disabled={idx === 0}
                                    className="rounded-full"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => moveQueued(q.name, +1)}
                                    title="Move down"
                                    disabled={idx === queue.length - 1}
                                    className="rounded-full"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  {q.status === 'error' && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => retryUpload(q.name)}
                                      title="Retry"
                                      className="rounded-full"
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {(q.status === 'uploading' || q.status === 'processing') && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => cancelUpload(q.name)}
                                      title="Cancel"
                                      className="rounded-full"
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeQueued(q.name)}
                                    title="Remove"
                                    disabled={q.status === 'uploading' || q.status === 'processing'}
                                    className="rounded-full"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {(q.status === 'uploading' || q.status === 'processing') && (
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
                  )}
                </div>

                {/* Action Buttons */}
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-inner">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{content.trim().length > 0 ? `${content.trim().length} characters` : 'No text yet'}</span>
                    <span>•</span>
                    <span>{queue.length ? `${queue.length} media attached` : 'No media yet'}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="ghost" onClick={onClose} className="rounded-full sm:flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!canPost} className="rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl sm:flex-1">
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Posting…
                        </div>
                      ) : (
                        'Post update'
                      )}
                    </Button>
                  </div>
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
            const fileName = `yardpass-recording-${Date.now()}.webm`;
            const recordedFile = new File([videoBlob], fileName, { type: fileType });
            void addFiles([recordedFile]);
            setShowVideoRecorder(false);
          }}
        />
      )}
    </>
  );
}

export default PostCreatorModal;
