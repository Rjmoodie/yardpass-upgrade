import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  FileText,
  Check,
} from 'lucide-react';
import { VideoRecorder } from '../VideoRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CreativeUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (creative: any) => void;
  campaignId: string | null;
  organizationId: string;
}

/** ---------- Config ---------- */
const IMAGE_BUCKET = 'event-media';
const MAX_FILES = 6;
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 512;

// Image preprocessing
const IMG_MAX_DIM = 1920;
const IMG_QUALITY = 0.85;

type FileKind = 'image' | 'video';
type FileStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';

type QueuedFile = {
  file: File;
  kind: FileKind;
  status: FileStatus;
  remoteUrl?: string;
  errorMsg?: string;
  name: string;
  size: number;
  previewUrl?: string;
  controller?: AbortController;
  progress?: number;
};

interface ExistingPost {
  id: string;
  text: string;
  media_urls: string[];
  created_at: string;
  author_display_name: string;
  author_photo_url: string | null;
  event_title: string;
  event_id: string;
}

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
    return file;
  }
};

const bytesToMB = (b: number) => +(b / (1024 * 1024)).toFixed(2);
const isImageFile = (f: File) => f.type.startsWith('image') || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name);
const isVideoFile = (f: File) => f.type.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(f.name);

async function uploadImageToSupabase(file: File, userId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `ad-creative-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${userId}/${filename}`;
  
  console.log('📤 Uploading to:', path, 'Size:', bytesToMB(file.size), 'MB');
  
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  
  if (error) {
    console.error('❌ Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  console.log('✅ Upload successful:', data.publicUrl);
  return data.publicUrl;
}

async function createMuxDirectUpload(eventId: string): Promise<{ upload_id: string; upload_url: string }> {
  const { data, error } = await supabase.functions.invoke('mux-create-direct-upload', {
    body: { event_id: eventId },
  });
  if (error) throw error;
  return data;
}

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
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), mime, IMG_QUALITY)
    );

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

export function CreativeUploaderModal({
  isOpen,
  onClose,
  onSuccess,
  campaignId,
  organizationId,
}: CreativeUploaderModalProps) {
  const { user, profile } = useAuth();

  // Common fields
  const [headline, setHeadline] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Learn More');
  const [ctaUrl, setCtaUrl] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaignId);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  // Upload tab state
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [loading, setLoading] = useState(false);

  // Import tab state
  const [organizerEvents, setOrganizerEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [availablePosts, setAvailablePosts] = useState<ExistingPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Mode
  const [activeTab, setActiveTab] = useState<'upload' | 'import'>('upload');

  const dropRef = useRef<HTMLDivElement | null>(null);
  const unmountedRef = useRef(false);
  const submittingRef = useRef(false);
  const imageInputId = useId();

  // Fetch campaigns if no campaignId is provided
  useEffect(() => {
    if (!isOpen || campaignId || !organizationId) return;
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('id, name, status')
          .eq('org_id', organizationId)
          .in('status', ['active', 'scheduled'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!mounted) return;

        setCampaigns(data || []);
        if (data && data.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(data[0].id); // Auto-select first campaign
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isOpen, campaignId, organizationId, selectedCampaignId]);

  // Fetch organizer events for import
  useEffect(() => {
    if (!isOpen || !user || activeTab !== 'import') return;
    let mounted = true;

    (async () => {
      try {
        // Get org memberships
        const { data: orgMemberships, error: memberError } = await supabase
          .from('org_memberships')
          .select('org_id, role')
          .eq('user_id', user.id)
          .in('role', ['owner', 'admin', 'editor']);

        if (memberError) throw memberError;
        if (!mounted) return;

        const orgIds = orgMemberships?.map(m => m.org_id) || [];

        // Fetch events created by user OR owned by their organizations
        let eventsQuery = supabase
          .from('events')
          .select('id, title, cover_image_url, start_at, created_by, owner_context_type, owner_context_id')
          .eq('created_by', user.id);

        if (orgIds.length > 0) {
          eventsQuery = eventsQuery.or(`created_by.eq.${user.id},owner_context_id.in.(${orgIds.join(',')})`);
        }

        const { data: events, error: eventsError} = await eventsQuery
          .order('start_at', { ascending: false })
          .limit(50);

        if (eventsError) throw eventsError;
        if (!mounted) return;

        setOrganizerEvents(events || []);
      } catch (err) {
        console.error('Error fetching organizer events:', err);
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
  }, [isOpen, user, activeTab]);

  // Fetch posts when event is selected
  useEffect(() => {
    if (!selectedEventId || activeTab !== 'import') return;
    let mounted = true;

    (async () => {
      setLoadingPosts(true);
      try {
        // Fetch posts from the selected event that were posted by organizers and have media
        const { data, error } = await supabase.functions.invoke('posts-list', {
          body: {
            event_id: selectedEventId,
            filter_type: 'organizer_only',
            limit: 50,
          },
        });

        if (error) throw error;
        if (!mounted) return;

        // Filter to only posts with media
        const postsWithMedia = (data?.posts || []).filter((post: any) => 
          post.media_urls && post.media_urls.length > 0
        );

        setAvailablePosts(postsWithMedia.map((post: any) => ({
          id: post.id,
          text: post.text || '',
          media_urls: post.media_urls || [],
          created_at: post.created_at,
          author_display_name: post.author_display_name || 'Unknown',
          author_photo_url: post.author_photo_url,
          event_title: post.event_title,
          event_id: post.event_id,
        })));
      } catch (err) {
        console.error('Error fetching posts:', err);
        toast({
          title: 'Error',
          description: 'Failed to load posts from this event',
          variant: 'destructive',
        });
      } finally {
        setLoadingPosts(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedEventId, activeTab]);

  // Cleanup
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      queue.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl));
    };
  }, [queue]);

  /** -------------- File intake (Upload mode) -------------- */
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
          description: `You can attach up to ${MAX_FILES} items per creative.`,
          variant: 'destructive',
        });
      }

      const next: QueuedFile[] = [];

      for (let i = 0; i < slice.length; i++) {
        let f = slice[i];
        f = await maybeTranscodeHeic(f);

        const kind: FileKind = isVideoFile(f) ? 'video' : 'image';
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

        if (queue.some((q) => q.name === f.name && q.size === f.size)) continue;

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
    if (files.length === 0) return;
    addFiles(files);
    ev.currentTarget.value = '';
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

    const updateByIndex = (i: number, patch: Partial<QueuedFile>) => {
      items[i] = { ...items[i], ...patch };
      setQueue((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((f) => f.name === items[i].name && f.size === items[i].size);
        if (idx !== -1) copy[idx] = { ...copy[idx], ...patch };
        return copy;
      });
    };

    const work = async (i: number) => {
      const item = items[i];
      if (!item) return;
      if (item.status === 'done' && item.remoteUrl) { results.push(item.remoteUrl); return; }
      if (item.status === 'canceled') return;

      try {
        const controller = new AbortController();
        updateByIndex(i, { status: 'uploading', controller, errorMsg: undefined, progress: 0 });

        if (item.kind === 'image') {
          if (!user?.id) throw new Error('User not authenticated');
          const publicUrl = await backoff(() => uploadImageToSupabase(item.file, user.id));
          updateByIndex(i, { status: 'done', remoteUrl: publicUrl, controller: undefined, progress: 100 });
          results.push(publicUrl);
        } else {
          // For video, we need an event_id. Use the first event from organizerEvents or a placeholder
          const eventId = organizerEvents[0]?.id;
          if (!eventId) throw new Error('No event available for video upload');

          const { upload_id, upload_url } = await backoff(() => createMuxDirectUpload(eventId));

          await backoff(() => uploadMuxWithProgress(
            upload_url,
            item.file,
            controller,
            (p) => updateByIndex(i, { progress: p })
          ), 2, 800);

          updateByIndex(i, { status: 'processing', controller: undefined });

          const playback_id = await backoff(() => resolveMuxUploadToPlaybackId(upload_id), 6, 1200);
          const muxUrl = `mux:${playback_id}`;
          updateByIndex(i, { status: 'done', remoteUrl: muxUrl, progress: 100 });
          results.push(muxUrl);
        }
      } catch (err: any) {
        const msg = err?.message || 'Upload failed';
        updateByIndex(i, { status: 'error', controller: undefined, errorMsg: msg });
        toast({ title: 'Upload Failed', description: `Failed to upload ${items[i].name}: ${msg}`, variant: 'destructive' });
      }
    };

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
  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!headline.trim()) return false;
    
    if (activeTab === 'upload') {
      return queue.length > 0;
    } else {
      return !!selectedPostId;
    }
  }, [loading, headline, activeTab, queue.length, selectedPostId]);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!headline.trim()) {
      toast({
        title: 'Missing headline',
        description: 'Please add a headline for your creative',
        variant: 'destructive',
      });
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      let media_url: string | null = null;
      let poster_url: string | null = null;
      let media_type: 'image' | 'video' | 'existing_post' = 'image';
      let post_id: string | null = null;

      if (activeTab === 'upload') {
        if (queue.length === 0) {
          throw new Error('Please upload at least one file');
        }

        const media_urls = await uploadQueue();
        if (media_urls.length === 0) {
          throw new Error('Failed to upload media');
        }

        // Use first media as primary
        media_url = media_urls[0];
        media_type = media_url.startsWith('mux:') ? 'video' : 'image';
        
        // For images, use the URL directly; for videos, we'll need to generate a poster
        if (media_type === 'image') {
          poster_url = media_url;
        } else {
          // For Mux videos, construct poster URL
          const playbackId = media_url.replace('mux:', '');
          poster_url = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
        }
      } else {
        // Import mode
        if (!selectedPostId) {
          throw new Error('Please select a post to import');
        }

        const selectedPost = availablePosts.find(p => p.id === selectedPostId);
        if (!selectedPost) {
          throw new Error('Selected post not found');
        }

        post_id = selectedPost.id;
        media_type = 'existing_post';
        
        // Use the post's first media as preview
        if (selectedPost.media_urls.length > 0) {
          const firstMedia = selectedPost.media_urls[0];
          media_url = firstMedia;
          
          if (firstMedia.startsWith('mux:')) {
            const playbackId = firstMedia.replace('mux:', '');
            poster_url = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
          } else {
            poster_url = firstMedia;
          }
        }
      }

      // If campaignId is provided, save immediately; otherwise return draft data
      const finalCampaignId = selectedCampaignId || campaignId;
      console.log('Creating creative with campaign_id:', finalCampaignId);
      
      if (finalCampaignId) {
        // Save to database immediately (existing campaign)
        const { data, error } = await supabase.functions.invoke('creatives-create', {
          body: {
            campaign_id: finalCampaignId,
            headline: headline.trim(),
            body_text: bodyText.trim() || null,
            cta_label: ctaLabel.trim() || 'Learn More',
            cta_url: ctaUrl.trim() || null,
            media_type,
            media_url,
            post_id,
            poster_url,
            active: true,
          },
        });

        if (error) throw error;

        toast({
          title: 'Creative created!',
          description: 'Your ad creative has been added to the campaign',
        });

        // Pass the saved creative object back
        onSuccess?.({
          id: data?.id,
          type: activeTab === 'import' ? 'existing_post' : media_type,
          headline: headline.trim(),
          bodyText: bodyText.trim(),
          ctaLabel: ctaLabel.trim(),
          ctaUrl: ctaUrl.trim(),
          mediaUrls: activeTab === 'upload' ? files.map(f => f.uploaded?.url).filter(Boolean) : [],
          postId: activeTab === 'import' ? selectedPostId : undefined,
        });
      } else {
        // Draft mode - just return the data without saving
        toast({
          title: 'Creative added!',
          description: 'Your ad creative will be created when you launch the campaign',
        });

        // Pass draft creative data back
        onSuccess?.({
          type: activeTab === 'import' ? 'existing_post' : media_type,
          headline: headline.trim(),
          body_text: bodyText.trim() || null,
          cta_label: ctaLabel.trim() || 'Learn More',
          cta_url: ctaUrl.trim() || null,
          media_url,
          post_id,
          poster_url,
          media_type,
          active: true,
        });
      }

      // Reset
      setHeadline('');
      setBodyText('');
      setCtaLabel('Learn More');
      setCtaUrl('');
      clearAll();
      setSelectedEventId('');
      setSelectedPostId('');
      onClose();
    } catch (err: any) {
      console.error('Creative creation failed:', err);
      toast({
        title: 'Creation Failed',
        description: err?.message || 'Unable to create creative. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const selectedPost = availablePosts.find(p => p.id === selectedPostId);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-3xl lg:max-w-4xl p-0 overflow-hidden border-none bg-transparent shadow-none max-h-[90vh] h-[90vh]">
          <div className="flex flex-col rounded-2xl sm:rounded-3xl border border-border/60 bg-background/95 shadow-2xl h-full">
            <div className="relative overflow-hidden flex-shrink-0">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/20 via-background/60 to-background" />
              <DialogHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Create Ad Creative
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Upload new content or import existing posts from your events
                </p>
              </DialogHeader>
            </div>

            <ScrollArea className="flex-1 overflow-auto min-h-0">
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 sm:space-y-6">
                {/* Creative Details */}
                <div className="rounded-xl sm:rounded-2xl border border-border/60 bg-background/80 p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {/* Campaign Selector (when no campaignId provided) */}
                  {!campaignId && campaigns.length > 0 && (
                    <div>
                      <Label htmlFor="campaign">Campaign *</Label>
                      <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                        <SelectTrigger id="campaign" className="mt-1">
                          <SelectValue placeholder="Select a campaign" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaigns.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name} ({campaign.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select which campaign this creative will belong to
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="headline">Headline *</Label>
                    <Input
                      id="headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="Catch attention with a compelling headline"
                      maxLength={100}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{headline.length}/100</p>
                  </div>

                  <div>
                    <Label htmlFor="bodyText">Description (optional)</Label>
                    <Textarea
                      id="bodyText"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Add more details about your ad..."
                      maxLength={500}
                      className="mt-1 min-h-[80px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{bodyText.length}/500</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ctaLabel">Call-to-Action</Label>
                      <Input
                        id="ctaLabel"
                        value={ctaLabel}
                        onChange={(e) => setCtaLabel(e.target.value)}
                        placeholder="Learn More"
                        maxLength={24}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ctaUrl">CTA URL (optional)</Label>
                      <Input
                        id="ctaUrl"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Content Source Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New
                    </TabsTrigger>
                    <TabsTrigger value="import">
                      <FileText className="h-4 w-4 mr-2" />
                      Import Post
                    </TabsTrigger>
                  </TabsList>

                  {/* Upload Tab */}
                  <TabsContent value="upload" className="space-y-4 mt-4">
                    <div 
                      className={`rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                        isDragging ? 'border-primary bg-primary/5' : 'border-border/60 bg-background/80'
                      }`}
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                    >
                      <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Upload media</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Drag and drop files here, or click to browse
                      </p>
                      <Button 
                        type="button"
                        onClick={() => document.getElementById(imageInputId)?.click()}
                        variant="outline"
                      >
                        Choose Files
                      </Button>
                      <input
                        id={imageInputId}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleFilePick}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground mt-4">
                        Supported: Images up to {MAX_IMAGE_MB}MB, Videos up to {MAX_VIDEO_MB}MB
                      </p>
                    </div>

                    {/* Media Queue */}
                    {queue.length > 0 && (
                      <div className="space-y-3 rounded-3xl border border-border/60 bg-background/80 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Uploaded media ({queue.length})</div>
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
                                        {q.kind}
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
                                      className="rounded-full h-8 w-8"
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => moveQueued(q.name, +1)}
                                      title="Move down"
                                      disabled={idx === queue.length - 1}
                                      className="rounded-full h-8 w-8"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    {q.status === 'error' && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => retryUpload(q.name)}
                                        title="Retry"
                                        className="rounded-full h-8 w-8"
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
                                        className="rounded-full h-8 w-8"
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
                                      className="rounded-full h-8 w-8"
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
                  </TabsContent>

                  {/* Import Tab */}
                  <TabsContent value="import" className="space-y-4 mt-4">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 space-y-4">
                      <div>
                        <Label>Select Event</Label>
                        <select
                          value={selectedEventId}
                          onChange={(e) => {
                            setSelectedEventId(e.target.value);
                            setSelectedPostId('');
                          }}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Choose an event...</option>
                          {organizerEvents.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedEventId && (
                        <div>
                          <Label>Select Post</Label>
                          {loadingPosts ? (
                            <div className="mt-2 text-sm text-muted-foreground">Loading posts...</div>
                          ) : availablePosts.length === 0 ? (
                            <div className="mt-2 text-sm text-muted-foreground">
                              No posts with media found from organizers in this event.
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                              {availablePosts.map((post) => (
                                <button
                                  key={post.id}
                                  onClick={() => setSelectedPostId(post.id)}
                                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                                    selectedPostId === post.id
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                                      {post.media_urls[0]?.startsWith('mux:') ? (
                                        <img
                                          src={`https://image.mux.com/${post.media_urls[0].replace('mux:', '')}/thumbnail.jpg`}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <img
                                          src={post.media_urls[0]}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      )}
                                      {selectedPostId === post.id && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                          <div className="rounded-full bg-primary p-1">
                                            <Check className="h-4 w-4 text-primary-foreground" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={post.author_photo_url || ''} />
                                          <AvatarFallback>{post.author_display_name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">{post.author_display_name}</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {post.text || 'No caption'}
                                      </p>
                                      <div className="mt-1 flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                          {post.media_urls.length} {post.media_urls.length === 1 ? 'media' : 'media items'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(post.created_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="ghost" onClick={onClose} className="rounded-full sm:flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={!canSubmit} 
                      className="rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl sm:flex-1"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Creating...
                        </div>
                      ) : (
                        'Create Creative'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {showVideoRecorder && organizerEvents[0] && (
        <VideoRecorder
          eventId={organizerEvents[0].id}
          onClose={() => setShowVideoRecorder(false)}
          onSave={(videoBlob) => {
            const fileType = videoBlob.type || 'video/webm';
            const fileName = `recording-${Date.now()}.webm`;
            const recordedFile = new File([videoBlob], fileName, { type: fileType });
            void addFiles([recordedFile]);
            setShowVideoRecorder(false);
          }}
        />
      )}
    </>
  );
}

export default CreativeUploaderModal;

