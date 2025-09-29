import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import {
  ArrowLeft,
  Camera,
  Video as VideoIcon,
  MapPin,
  Tag,
  X,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  Ban,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { RecordingModal } from './RecordingModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface PostCreatorProps {
  user: User | null;
  onBack: () => void;
  onPost: () => void;
}

type UserTicket = {
  id: string;
  event_id: string;
  tier_id: string | null;
  events: {
    id: string;
    title: string;
    cover_image_url?: string | null;
    start_at?: string | null;
  };
  ticket_tiers: {
    badge_label: string | null;
    name: string | null;
  } | null;
  isOrganizer?: boolean;
};

/** ------------ Config ------------ */
const MAX_LEN = 280;
const MAX_MEDIA = 8;
const IMAGE_BUCKET = 'event-media';
const IMG_MAX_DIM = 1920;
const IMG_QUALITY = 0.85;
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 512;

const DRAFT_KEY = (uid?: string) => `post-creator-draft:${uid || 'anon'}`;
const LAST_EVENT_KEY = (uid?: string) => `post-creator-last-event:${uid || 'anon'}`;

type FileKind = 'image' | 'video';
type FileStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';

type QueuedFile = {
  file: File;
  name: string;
  size: number;
  kind: FileKind;
  status: FileStatus;
  previewUrl?: string;
  controller?: AbortController;
  progress?: number;
  errorMsg?: string;
  remoteUrl?: string; // image public URL OR mux:playback_id
};

const bytesToMB = (b: number) => +(b / (1024 * 1024)).toFixed(2);
const isImageFile = (f: File) => f.type.startsWith('image') || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name);
const isVideoFile = (f: File) => f.type.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ------------ Media helpers ------------ */
async function preprocessImage(file: File): Promise<File> {
  try {
    if (!isImageFile(file)) return file;
    if (bytesToMB(file.size) <= MAX_IMAGE_MB / 2) return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    const { width, height } = bitmap;
    const scale = Math.min(1, IMG_MAX_DIM / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const hasAlpha = file.type.includes('png') || file.type.includes('webp') || file.type.includes('avif');
    const mime = hasAlpha ? 'image/webp' : 'image/jpeg';
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), mime, IMG_QUALITY));
    if (!blob) return file;

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

async function uploadImageToSupabase(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Create Mux Direct Upload via Edge Function → { upload_id, upload_url } */
async function createMuxDirectUpload(eventId: string): Promise<{ upload_id: string; upload_url: string }> {
  const { data, error } = await supabase.functions.invoke('mux-create-direct-upload', {
    body: { event_id: eventId },
  });
  if (error) throw error;
  return data;
}

/** Resolve Mux upload to playback_id with backoff */
async function resolveMuxUploadToPlaybackId(
  upload_id: string,
  opts: { attempts?: number; baseMs?: number; maxMs?: number } = {}
): Promise<string> {
  const attempts = opts.attempts ?? 15;
  const base = opts.baseMs ?? 1200;
  const max = opts.maxMs ?? 5000;

  let wait = base;
  for (let i = 1; i <= attempts; i++) {
    const { data, error } = await supabase.functions.invoke('resolve-mux-upload', { body: { upload_id } });
    if (error) throw error;
    if (data?.status === 'ready' && data?.playback_id) return data.playback_id as string;
    if (data?.status === 'errored') throw new Error(data?.message || 'Mux processing failed');
    await sleep(wait);
    wait = Math.min(max, Math.ceil(wait * 1.4));
  }
  throw new Error('Mux processing timed out');
}

/** Upload to Mux with XHR for progress */
function uploadMuxWithProgress(
  url: string,
  file: File,
  controller: AbortController,
  onProgress: (p: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
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

/** ------------ Component ------------ */
export function PostCreator({ user, onBack, onPost }: PostCreatorProps) {
  const { toast } = useToast();

  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);

  const unmountedRef = useRef(false);

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to create posts.</p>
          <Button onClick={onBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  /** Fetch tickets & events user can post to based on their current mode */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Always get events where user has tickets (attendee events)
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            id,
            event_id,
            tier_id,
            events!fk_tickets_event_id ( id, title, cover_image_url, start_at ),
            ticket_tiers!fk_tickets_tier_id ( badge_label, name )
          `)
          .eq('owner_user_id', user.id)
          .in('status', ['issued', 'transferred', 'redeemed']);

        if (ticketsError) throw ticketsError;

        // Format ticket events (attendee events)
        const ticketEvents = (ticketsData || []).map((t: any) => ({
          id: t.id,
          event_id: t.event_id,
          tier_id: t.tier_id,
          events: t.events,
          ticket_tiers: t.ticket_tiers,
          isOrganizer: false
        }));

        let organizerEventsFormatted: any[] = [];

        // If user is in organizer mode, also get events where they are organizers
        if (user.role === 'organizer') {
          // Get events where user is organizer
          const { data: organizerEvents, error: orgError } = await supabase
            .from('events')
            .select(`
              id,
              title,
              cover_image_url,
              start_at,
              owner_context_type,
              owner_context_id,
              created_by
            `)
            .or(`created_by.eq.${user.id},owner_context_id.eq.${user.id}`);

          if (orgError) throw orgError;

          // Also get events where user is an organization member with posting rights
          const { data: orgMemberships, error: memberError } = await supabase
            .from('org_memberships')
            .select('org_id')
            .eq('user_id', user.id)
            .in('role', ['owner', 'admin', 'editor']);

          if (memberError) throw memberError;

          const orgIds = (orgMemberships || []).map(m => m.org_id);
          let orgEvents: any[] = [];
          
          if (orgIds.length > 0) {
            const { data: orgEventsData, error: orgEventsError } = await supabase
              .from('events')
              .select(`
                id,
                title,
                cover_image_url,
                start_at
              `)
              .eq('owner_context_type', 'organization')
              .in('owner_context_id', orgIds);

            if (orgEventsError) throw orgEventsError;
            orgEvents = orgEventsData || [];
          }

          // Combine direct organizer events and organization events
          const allOrganizerEvents = [...(organizerEvents || []), ...orgEvents];

          organizerEventsFormatted = allOrganizerEvents.map((e: any) => ({
            id: `organizer-${e.id}`,
            event_id: e.id,
            tier_id: null,
            events: e,
            ticket_tiers: { badge_label: 'ORGANIZER', name: 'Organizer' },
            isOrganizer: true
          }));
        }

        if (!mounted) return;

        // Combine events based on user role
        let allEvents: any[];
        if (user.role === 'organizer') {
          // Organizer mode: show both attendee and organizer events
          allEvents = [...organizerEventsFormatted, ...ticketEvents];
        } else {
          // Attendee mode: only show attendee events
          allEvents = ticketEvents;
        }

        // Dedupe by event_id, prioritizing organizer status
        const eventMap = new Map();
        allEvents.forEach((item) => {
          const existing = eventMap.get(item.event_id);
          if (!existing || item.isOrganizer) {
            eventMap.set(item.event_id, item);
          }
        });
        
        const dedup = Array.from(eventMap.values()) as UserTicket[];
        setUserTickets(dedup);

        // Load last selected event
        const last = localStorage.getItem(LAST_EVENT_KEY(user.id));
        if (last && dedup.some((t) => t.event_id === last)) {
          setSelectedEventId(last);
        } else if (!selectedEventId && dedup.length === 1) {
          setSelectedEventId(dedup[0].event_id);
        }
      } catch (e: any) {
        console.error(e);
        toast({
          title: 'Error',
          description: e.message || 'Failed to load your events',
          variant: 'destructive',
        });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user.id, user.role, toast]); // Added user.role to dependencies

  /** Draft: load on mount, save on changes (debounced) */
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY(user.id));
    if (saved) {
      try {
        const d = JSON.parse(saved) as { content?: string; eventId?: string };
        if (d.content) setContent(d.content);
        if (d.eventId && !selectedEventId) setSelectedEventId(d.eventId);
      } catch {}
    }
    return () => {
      unmountedRef.current = true;
      // revoke previews
      setQueue((q) => {
        q.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
        return q;
      });
    };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY(user.id), JSON.stringify({ content, eventId: selectedEventId }));
      } catch {}
    }, 250);
    return () => clearTimeout(id);
  }, [content, selectedEventId, user.id]);

  /** Selections & computed */
  const selectedTicket = useMemo(
    () => userTickets.find((t) => t.event_id === selectedEventId) || null,
    [userTickets, selectedEventId]
  );

  /** --------- File intake (browse, drag/drop, paste) --------- */
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const allowed = Math.max(0, MAX_MEDIA - queue.length);
      const slice = files.slice(0, allowed);
      const rejected = files.slice(allowed);
      if (rejected.length) {
        toast({
          title: 'Too many files',
          description: `You can attach up to ${MAX_MEDIA} items per post.`,
          variant: 'destructive',
        });
      }

      const next: QueuedFile[] = [];
      for (let f of slice) {
        const kind: FileKind = isVideoFile(f) ? 'video' : isImageFile(f) ? 'image' : 'image';

        // compress/resize large images
        if (kind === 'image' && bytesToMB(f.size) > MAX_IMAGE_MB) {
          const optimized = await preprocessImage(f);
          if (bytesToMB(optimized.size) > MAX_IMAGE_MB) {
            toast({
              title: 'Image too large',
              description: `${f.name} exceeds ${MAX_IMAGE_MB}MB after optimization.`,
              variant: 'destructive',
            });
            continue;
          }
          f = optimized;
        }
        if (kind === 'video' && bytesToMB(f.size) > MAX_VIDEO_MB) {
          toast({
            title: 'Video too large',
            description: `${f.name} exceeds ${MAX_VIDEO_MB}MB.`,
            variant: 'destructive',
          });
          continue;
        }

        // de-dupe by name + size
        if (queue.some((q) => q.name === f.name && q.size === f.size)) continue;

        next.push({
          file: f,
          name: f.name,
          size: f.size,
          kind,
          status: 'queued',
          previewUrl: kind === 'image' ? URL.createObjectURL(f) : undefined,
          progress: 0,
        });
      }
      if (next.length) setQueue((q) => [...q, ...next]);
    },
    [queue, toast]
  );

  const handlePickMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.currentTarget.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      addFiles(files);
      e.preventDefault();
    }
  };

  const handleRecordingComplete = (file: File) => {
    addFiles([file]);
  };

  const removeQueued = (name: string) => {
    setQueue((q) => {
      const t = q.find((f) => f.name === name);
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
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
      q.map((f) => (f.name === name ? { ...f, status: 'queued', errorMsg: undefined, progress: 0 } : f))
    );
  };

  const moveQueued = (name: string, dir: -1 | 1) => {
    setQueue((q) => {
      const idx = q.findIndex((f) => f.name === name);
      if (idx === -1) return q;
      const swap = idx + dir;
      if (swap < 0 || swap >= q.length) return q;
      const next = [...q];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  /** --------- Upload pipeline --------- */
  const uploadQueue = async (): Promise<string[]> => {
    const urls: string[] = [];
    const updates = [...queue];

    for (let i = 0; i < updates.length; i++) {
      const item = updates[i];

      if (item.status === 'done' && item.remoteUrl) {
        urls.push(item.remoteUrl);
        continue;
      }
      if (item.status === 'canceled') continue;

      try {
        const controller = new AbortController();
        updates[i] = { ...item, status: 'uploading', controller, errorMsg: undefined, progress: 0 };
        setQueue([...updates]);

        if (item.kind === 'image') {
          const url = await uploadImageToSupabase(item.file);
          updates[i] = { ...updates[i], status: 'done', controller: undefined, progress: 100, remoteUrl: url };
          urls.push(url);
          setQueue([...updates]);
        } else {
          if (!selectedEventId) throw new Error('Select an event before uploading video');

          const { upload_id, upload_url } = await createMuxDirectUpload(selectedEventId);

          await uploadMuxWithProgress(upload_url, item.file, controller, (p) => {
            updates[i] = { ...updates[i], progress: p };
            if (!unmountedRef.current) setQueue([...updates]);
          });

          updates[i] = { ...updates[i], status: 'processing', controller: undefined };
          setQueue([...updates]);

          const playback_id = await resolveMuxUploadToPlaybackId(upload_id);
          const muxUrl = `mux:${playback_id}`;
          updates[i] = { ...updates[i], status: 'done', progress: 100, remoteUrl: muxUrl };
          urls.push(muxUrl);
          setQueue([...updates]);
        }
      } catch (e: any) {
        console.error('Upload error:', e);
        updates[i] = {
          ...updates[i],
          status: updates[i].status === 'canceled' ? 'canceled' : 'error',
          controller: undefined,
          errorMsg: e?.message || 'Upload failed',
        };
        setQueue([...updates]);

        if (updates[i].status !== 'canceled') {
          toast({
            title: 'Upload Failed',
            description: `Failed to upload ${updates[i].name}: ${updates[i].errorMsg}`,
            variant: 'destructive',
          });
          throw e; // stop pipeline
        }
      }
    }

    return urls;
  };

  /** --------- Submit --------- */
  const canPost = Boolean(content.trim() && selectedEventId && !uploading);

  const handleSubmit = async () => {
    if (!content.trim() || !selectedEventId) {
      toast({
        title: 'Missing info',
        description: 'Select an event and add some text',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // persist last selected event
      try {
        localStorage.setItem(LAST_EVENT_KEY(user.id), selectedEventId);
      } catch {}

      const media_urls = await uploadQueue();

      const { data, error } = await supabase.functions.invoke('posts-create', {
        body: {
          event_id: selectedEventId,
          text: content.trim(),
          media_urls,
          ticket_tier_id: selectedTicket?.tier_id ?? null,
        },
      });
      if (error) throw error;

      toast({ title: 'Posted', description: 'Your post has been created!' });

      // notify app
      window.dispatchEvent(
        new CustomEvent('postCreated', { detail: { eventId: selectedEventId, postId: data?.id } })
      );

      // reset
      setContent('');
      setQueue((q) => {
        q.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
        return [];
      });
      try {
        localStorage.removeItem(DRAFT_KEY(user.id));
      } catch {}
      onPost();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Post failed',
        description: e.message || 'Unable to create post',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  /** --------- UI --------- */
  return (
    <div className="h-full bg-background flex flex-col" onPaste={onPaste}>
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold">Create Post</h1>
              <p className="text-sm text-muted-foreground">Share your event experience</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={!canPost} className="px-6">
            {uploading ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's happening?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share your thoughts about the event..."
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
              className="min-h-32 resize-none"
              maxLength={MAX_LEN}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canPost) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />

            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{content.length}/{MAX_LEN} characters · ⌘/Ctrl + Enter</span>
              <span>{queue.length}/{MAX_MEDIA} media</span>
            </div>

            {/* Media area */}
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={[
                'border-2 border-dashed rounded-lg p-4 transition-colors',
                dragging ? 'border-primary bg-primary/5' : 'border-border',
              ].join(' ')}
              aria-label="Drop media here"
            >
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex">
                  <input type="file" accept="image/*" multiple onChange={handlePickMedia} className="hidden" />
                  <Button asChild variant="outline" size="sm">
                    <span className="cursor-pointer">
                      <Camera className="w-4 h-4 mr-1" />
                      Photos
                    </span>
                  </Button>
                </label>

                <label className="inline-flex">
                  <input type="file" accept="video/*" multiple onChange={handlePickMedia} className="hidden" />
                  <Button asChild variant="outline" size="sm">
                    <span className="cursor-pointer">
                      <VideoIcon className="w-4 h-4 mr-1" />
                      Videos
                    </span>
                  </Button>
                </label>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowRecordingModal(true)}
                >
                  <VideoIcon className="w-4 h-4 mr-1" />
                  Record
                </Button>

                <div className="text-xs text-muted-foreground self-center">
                  Drag & drop or paste media (images ≤ {MAX_IMAGE_MB}MB, videos ≤ {MAX_VIDEO_MB}MB)
                </div>
              </div>

              {/* Queue preview */}
              {queue.length > 0 && (
                <div className="mt-3 space-y-2">
                  {queue.map((q, idx) => (
                    <div key={q.name + q.size} className="flex items-center justify-between gap-3 bg-muted rounded-lg p-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded overflow-hidden flex items-center justify-center bg-background border">
                          {q.kind === 'image' ? (
                            q.previewUrl ? (
                              <img src={q.previewUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            )
                          ) : (
                            <VideoIcon className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate" title={q.name}>
                            {q.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {q.kind.toUpperCase()} • {bytesToMB(q.size)} MB • {q.status}
                            {typeof q.progress === 'number' &&
                            (q.status === 'uploading' || q.status === 'processing') ? (
                              <> • {q.progress}%</>
                            ) : null}
                            {q.errorMsg ? ` — ${q.errorMsg}` : ''}
                          </div>
                          {q.status === 'uploading' || q.status === 'processing' ? (
                            <div className="h-1 w-full bg-background/60 rounded mt-1 overflow-hidden">
                              <div
                                className="h-full bg-primary transition-[width]"
                                style={{ width: `${Math.max(5, Math.min(100, q.progress || 5))}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="flex flex-col">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveQueued(q.name, -1)}
                            title="Move up"
                            disabled={idx === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveQueued(q.name, +1)}
                            title="Move down"
                            disabled={idx === queue.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>

                        {q.status === 'error' && (
                          <Button size="icon" variant="ghost" onClick={() => retryUpload(q.name)} title="Retry">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        {(q.status === 'uploading' || q.status === 'processing') && (
                          <Button size="icon" variant="ghost" onClick={() => cancelUpload(q.name)} title="Cancel">
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeQueued(q.name)}
                          title="Remove"
                          disabled={q.status === 'uploading' || q.status === 'processing'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tag Event */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tag Event *
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {user.role === 'organizer' 
                ? "Post to events you're attending or organizing" 
                : "Post to events you're attending"
              }
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedEventId}
              onValueChange={(v) => {
                setSelectedEventId(v);
                try {
                  localStorage.setItem(LAST_EVENT_KEY(user.id), v);
                } catch {}
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  user.role === 'organizer' 
                    ? "Select an event to post to" 
                    : "Select an event you're attending"
                } />
              </SelectTrigger>
              <SelectContent>
                {userTickets.map((ticket) => (
                  <SelectItem key={ticket.event_id} value={ticket.event_id}>
                    <div className="flex items-center gap-2 py-1">
                      <ImageWithFallback
                        src={ticket.events.cover_image_url || ''}
                        alt={ticket.events.title}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <div>
                        <div className="text-sm">{ticket.events.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {ticket.ticket_tiers?.badge_label || 'ATTENDEE'}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTicket && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <ImageWithFallback
                      src={selectedTicket.events.cover_image_url || ''}
                      alt={selectedTicket.events.title}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{selectedTicket.events.title}</span>
                        {selectedTicket.ticket_tiers?.badge_label && (
                          <Badge variant="outline" className="text-xs">
                            {selectedTicket.ticket_tiers.badge_label}
                          </Badge>
                        )}
                      </div>
                      {selectedTicket.events.start_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(selectedTicket.events.start_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        {content && selectedTicket && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">
                      {user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{user.name}</span>
                      {selectedTicket.ticket_tiers?.badge_label && (
                        <Badge variant="outline" className="text-xs">
                          {selectedTicket.ticket_tiers.badge_label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mb-2 whitespace-pre-wrap">{content}</p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>at {selectedTicket.events.title}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <RecordingModal
        isOpen={showRecordingModal}
        onClose={() => setShowRecordingModal(false)}
        onRecordingComplete={handleRecordingComplete}
      />
    </div>
  );
}

export default PostCreator;