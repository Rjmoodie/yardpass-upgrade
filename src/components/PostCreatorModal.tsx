import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
  tier_id: string;
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
const ACCEPT = 'video/*,image/*';
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

const bytesToMB = (b: number) => +(b / (1024 * 1024)).toFixed(2);
const isImageFile = (f: File) => f.type.startsWith('image') || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name);
const isVideoFile = (f: File) => f.type.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  // const { track } = useAnalytics?.() ?? { track: () => {} };

  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const dropRef = useRef<HTMLDivElement | null>(null);
  const unmountedRef = useRef(false);
  const submittingRef = useRef(false);

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

  // Fetch user's tickets
  useEffect(() => {
    if (!isOpen || !user) return;
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
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

        if (error) throw error;
        if (!mounted) return;

        const dedupByEvent = Array.from(new Map((data || []).map((t: UserTicket) => [t.event_id, t])).values());
        setUserTickets(dedupByEvent);

        if (preselectedEventId) {
          setSelectedEventId(preselectedEventId);
        } else if (!selectedEventId && dedupByEvent.length === 1) {
          setSelectedEventId(dedupByEvent[0].event_id);
        }
      } catch (err) {
        console.error('Error fetching user tickets:', err);
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
        const kind: FileKind = isVideoFile(f) ? 'video' : isImageFile(f) ? 'image' : 'image';
        const sizeMB = bytesToMB(f.size);

        if (kind === 'image' && sizeMB > MAX_IMAGE_MB) {
          // try preprocessing (resize/compress). If still too large, reject.
          const optimized = await preprocessImage(f);
          if (bytesToMB(optimized.size) > MAX_IMAGE_MB) {
            toast({
              title: 'Image too large',
              description: `${f.name} is ${sizeMB}MB (limit ${MAX_IMAGE_MB}MB).`,
              variant: 'destructive',
            });
            continue;
          }
          // replace file with optimized
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
        if (queue.some((q) => q.name === f.name && q.size === f.size)) {
          continue;
        }

        next.push({
          file: f,
          kind,
          status: 'queued',
          name: f.name,
          size: f.size,
          previewUrl: kind === 'image' ? URL.createObjectURL(f) : undefined,
          progress: 0,
        });
      }

      if (next.length) setQueue((q) => [...q, ...next]);
    },
    [queue]
  );

  const handleFilePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files || []);
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
    const urls: string[] = [];
    const updates = [...queue];

    // sequential keeps it simple; adjust to limited concurrency if desired
    for (let i = 0; i < updates.length; i++) {
      const item = updates[i];

      // skip finished or canceled
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
          const publicUrl = await uploadImageToSupabase(item.file);
          updates[i] = {
            ...updates[i],
            status: 'done',
            remoteUrl: publicUrl,
            controller: undefined,
            progress: 100,
          };
          urls.push(publicUrl);
          setQueue([...updates]);
        } else {
          // VIDEO → Mux Direct Upload
          if (!selectedEventId) throw new Error('Select an event before uploading video');

          const { upload_id, upload_url } = await createMuxDirectUpload(selectedEventId);

          // PUT binary to Mux upload URL with progress
          await uploadMuxWithProgress(
            upload_url,
            item.file,
            controller,
            (p) => {
              updates[i] = { ...updates[i], progress: p };
              if (!unmountedRef.current) setQueue([...updates]);
            }
          );

          // now video is processing on Mux
          updates[i] = { ...updates[i], status: 'processing', controller: undefined };
          setQueue([...updates]);

          // Poll until we get a playback_id
          const playback_id = await resolveMuxUploadToPlaybackId(upload_id);

          const muxUrl = `mux:${playback_id}`;
          updates[i] = { ...updates[i], status: 'done', remoteUrl: muxUrl, progress: 100 };
          urls.push(muxUrl);
          setQueue([...updates]);
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        updates[i] = {
          ...updates[i],
          status: updates[i].status === 'canceled' ? 'canceled' : 'error',
          controller: undefined,
          errorMsg: err?.message || 'Upload failed',
        };
        setQueue([...updates]);

        if (updates[i].status !== 'canceled') {
          toast({
            title: 'Upload Failed',
            description: `Failed to upload ${updates[i].name}: ${updates[i].errorMsg}`,
            variant: 'destructive',
          });
          // stop entire submission pipeline on first failure
          throw err;
        }
      }
    }

    return urls;
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--modal-bg)] border-[var(--modal-border)] shadow-[var(--shadow-modal)]">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4" onPaste={onPaste}>
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile?.photo_url || ''} />
              <AvatarFallback>{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{profile?.display_name || 'You'}</div>
              {selectedTicket && (
                <Badge variant="secondary" className="text-xs" title={selectedTicket.ticket_tiers.name}>
                  {selectedTicket.ticket_tiers.badge_label}
                </Badge>
              )}
            </div>
          </div>

          {/* Event Selection */}
          {!preselectedEventId && (
            <div>
              <label className="text-sm font-medium mb-2 block">Select Event</label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event to post to" />
                </SelectTrigger>
                <SelectContent>
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

          {/* Content */}
          <div>
            <Textarea
              placeholder="Share your thoughts about this event…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[110px] resize-none"
              maxLength={2000}
              onKeyDown={onKeyDownComposer}
              aria-label="Post content"
            />
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span>Press ⌘/Ctrl + Enter to post</span>
              <span>{content.length}/2000</span>
            </div>
          </div>

          {/* Media Upload (drag & drop + click + paste) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Add Media</label>
              {queue.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAll} aria-label="Clear all media">
                  <X className="w-4 h-4 mr-1" />
                  Clear all
                </Button>
              )}
            </div>

            <div
              ref={dropRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={[
                'border-2 border-dashed rounded-lg p-4 transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-border',
              ].join(' ')}
              aria-label="Drop media here"
            >
              <input
                type="file"
                accept={ACCEPT}
                multiple
                onChange={handleFilePick}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm">
                  Drag & drop, paste, or <span className="underline">browse</span> (images • videos)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Up to {MAX_FILES} files · Images ≤ {MAX_IMAGE_MB}MB · Videos ≤ {MAX_VIDEO_MB}MB
                </span>
              </label>
            </div>

            {/* Queue preview */}
            {queue.length > 0 && (
              <div className="mt-3 space-y-2">
                {queue.map((q, idx) => (
                  <div
                    key={q.name + q.size}
                    className="flex items-center justify-between gap-3 bg-muted rounded-lg p-2"
                  >
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
                          {typeof q.progress === 'number' && (q.status === 'uploading' || q.status === 'processing') ? (
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
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => cancelUpload(q.name)}
                          title="Cancel"
                        >
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

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canPost} className="flex-1">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Posting…
                </div>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PostCreatorModal;