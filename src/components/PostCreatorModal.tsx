import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, X, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

type QueuedFile = {
  file: File;
  kind: 'image' | 'video';
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  remoteUrl?: string;          // image public URL OR mux:playback_id
  errorMsg?: string;
  name: string;
  size: number;
};

const IMAGE_BUCKET = 'event-media';

async function uploadImageToSupabase(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase
    .storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Ask your edge function to create a Mux Direct Upload and return:
 * { upload_id, upload_url }
 */
async function createMuxDirectUpload(eventId: string): Promise<{ upload_id: string; upload_url: string }> {
  const { data, error } = await supabase.functions.invoke('mux-create-direct-upload', {
    body: { event_id: eventId },
  });
  if (error) throw error;
  return data;
}

/**
 * Poll your edge function to resolve a Mux upload into a playback_id.
 * Returns string playback_id when ready, or throws if failed/timeout.
 */
async function resolveMuxUploadToPlaybackId(upload_id: string, maxAttempts = 12, intervalMs = 1500): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
    // wait a bit then try again
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Mux processing timed out');
}

export function PostCreatorModal({ isOpen, onClose, onSuccess, preselectedEventId }: PostCreatorModalProps) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const [queue, setQueue] = useState<QueuedFile[]>([]);

  // Fetch user's tickets
  useEffect(() => {
    if (isOpen && user) {
      fetchUserTickets();
    }
  }, [isOpen, user]);

  const fetchUserTickets = async () => {
    if (!user) return;

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
      setUserTickets(data || []);

      if (preselectedEventId) {
        setSelectedEventId(preselectedEventId);
      } else if (data && data.length === 1) {
        setSelectedEventId(data[0].event_id);
      }
    } catch (err) {
      console.error('Error fetching user tickets:', err);
      toast({
        title: "Error",
        description: "Failed to load your events",
        variant: "destructive",
      });
    }
  };

  const handleFilePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;

    const next: QueuedFile[] = files.map((f) => ({
      file: f,
      kind: f.type.startsWith('video') || /\.(mp4|webm|mov)$/i.test(f.name) ? 'video' : 'image',
      status: 'queued',
      name: f.name,
      size: f.size,
    }));

    setQueue((q) => [...q, ...next]);
    // reset input so selecting the same file again works
    ev.currentTarget.value = '';
  };

  const removeQueued = (name: string) => {
    setQueue((q) => q.filter((f) => f.name !== name));
  };

  const uploadQueue = async (): Promise<string[]> => {
    // returns array of media_urls to include with post
    const urls: string[] = [];
    const updates = [...queue];

    for (let i = 0; i < updates.length; i++) {
      const item = updates[i];
      if (item.status === 'done' && item.remoteUrl) {
        urls.push(item.remoteUrl);
        continue;
      }

      try {
        // mark uploading
        updates[i] = { ...item, status: 'uploading', errorMsg: undefined };
        setQueue([...updates]);

        if (item.kind === 'image') {
          const publicUrl = await uploadImageToSupabase(item.file);
          updates[i] = { ...item, status: 'done', remoteUrl: publicUrl };
          urls.push(publicUrl);
          setQueue([...updates]);
        } else {
          // VIDEO → Mux Direct Upload
          const { upload_id, upload_url } = await createMuxDirectUpload(selectedEventId);

          // PUT binary to Mux upload URL
          await fetch(upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
            body: item.file,
          });

          // now video is processing on Mux
          updates[i] = { ...item, status: 'processing' };
          setQueue([...updates]);

          // Poll until we get a playback_id
          const playback_id = await resolveMuxUploadToPlaybackId(upload_id);

          const muxUrl = `mux:${playback_id}`;
          updates[i] = { ...item, status: 'done', remoteUrl: muxUrl };
          urls.push(muxUrl);
          setQueue([...updates]);
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        updates[i] = { ...item, status: 'error', errorMsg: err?.message || 'Upload failed' };
        setQueue([...updates]);
        throw err; // bubble up to stop submission
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!selectedEventId || !content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an event and add content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const media_urls = await uploadQueue();

      // Find the ticket tier for this event (for badge)
      const userTicket = userTickets.find(t => t.event_id === selectedEventId);

      const { data: result, error } = await supabase.functions.invoke('posts-create', {
        body: {
          event_id: selectedEventId,
          text: content,
          media_urls,
          ticket_tier_id: userTicket?.tier_id,
        },
      });
      if (error) throw error;

      toast({
        title: "Posted!",
        description: `Shared to ${result?.data?.event_title || 'event'}`,
      });

      // Trigger global post refresh event
      window.dispatchEvent(new CustomEvent('postCreated', { 
        detail: { eventId: selectedEventId, postId: result?.data?.id } 
      }));

      // reset
      setContent('');
      setQueue([]);
      if (!preselectedEventId) setSelectedEventId('');

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({
        title: "Post failed",
        description: err?.message || 'Unable to create post',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedTicket = userTickets.find(t => t.event_id === selectedEventId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--modal-bg)] border-[var(--modal-border)] shadow-[var(--shadow-modal)]">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile?.photo_url || ''} />
              <AvatarFallback>
                {profile?.display_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{profile?.display_name}</div>
              {selectedTicket && (
                <Badge variant="secondary" className="text-xs">
                  {selectedTicket.ticket_tiers.badge_label}
                </Badge>
              )}
            </div>
          </div>

          {/* Event Selection */}
          {!preselectedEventId && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Event
              </label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event to post to" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Map(userTickets.map(ticket => [
                    ticket.event_id, 
                    ticket
                  ])).values()).map((ticket) => (
                    <SelectItem key={ticket.event_id} value={ticket.event_id}>
                      <div className="flex items-center gap-2">
                        <span>{ticket.events.title}</span>
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
              placeholder="Share your thoughts about this event..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={2000}
            />
            <div className="text-right text-xs text-muted-foreground mt-1">
              {content.length}/2000
            </div>
          </div>

          {/* Media Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Add Media (Images → Supabase, Videos → Mux)
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input
                type="file"
                accept="video/*,image/*"
                multiple
                onChange={handleFilePick}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <Video className="w-8 h-8" />
                <span className="text-sm">Upload video or photos</span>
              </label>
            </div>

            {/* Queue preview */}
            {queue.length > 0 && (
              <div className="mt-3 space-y-2">
                {queue.map((q) => (
                  <div key={q.name} className="flex items-center justify-between bg-muted rounded-lg p-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{q.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {q.kind.toUpperCase()} • {(q.size / (1024 * 1024)).toFixed(1)} MB • {q.status}
                        {q.errorMsg ? ` — ${q.errorMsg}` : ''}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeQueued(q.name)}
                      disabled={q.status === 'uploading' || q.status === 'processing'}
                    >
                      <X className="w-4 h-4" />
                    </Button>
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
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !selectedEventId || !content.trim()}
              className="flex-1"
            >
              {loading ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
