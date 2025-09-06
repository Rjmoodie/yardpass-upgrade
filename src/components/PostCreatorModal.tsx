import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Video, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Event = {
  id: string;
  title: string;
  cover_image_url?: string | null;
};

type UserTicket = {
  id: string;
  event_id: string;
  tier_id: string | null;
  events: Event;
  ticket_tiers: { badge_label: string | null; name: string | null } | null;
};

interface PostCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedEventId?: string;
}

const MAX_LEN = 280;
const MAX_MEDIA = 8;

export function PostCreatorModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEventId,
}: PostCreatorModalProps) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  // Fetch user's tickets when opened
  useEffect(() => {
    if (!isOpen || !user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            id,
            event_id,
            tier_id,
            events!fk_tickets_event_id ( id, title, cover_image_url ),
            ticket_tiers!fk_tickets_tier_id ( badge_label, name )
          `)
          .eq('owner_user_id', user.id)
          .in('status', ['issued', 'transferred', 'redeemed']);
        if (error) throw error;

        const rows = (data as unknown as UserTicket[]) ?? [];
        setUserTickets(rows);

        if (preselectedEventId) {
          setSelectedEventId(preselectedEventId);
        } else if (rows.length === 1) {
          setSelectedEventId(rows[0].event_id);
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
  }, [isOpen, user, preselectedEventId]);

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = [...mediaFiles, ...files].slice(0, MAX_MEDIA);
    setMediaFiles(next);
    event.currentTarget.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function uploadImages(files: File[]) {
    const urls: string[] = [];
    for (const f of files) {
      const ext = (f.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('event-media').upload(path, f, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('event-media').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function uploadVideos(files: File[]) {
    const urls: string[] = [];
    for (const f of files) {
      const formData = new FormData();
      formData.append('video', f);
      const { data, error } = await supabase.functions.invoke('upload-video-mux', {
        body: formData,
      });
      if (error) throw error;
      if (data?.asset_id) urls.push(`mux:${data.asset_id}`);
    }
    return urls;
  }

  const handleSubmit = async () => {
    if (!selectedEventId || !content.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select an event and add content',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const imageFiles = mediaFiles.filter((f) => f.type.startsWith('image/'));
      const videoFiles = mediaFiles.filter((f) => f.type.startsWith('video/'));

      const [imageUrls, videoUrls] = await Promise.all([
        uploadImages(imageFiles),
        uploadVideos(videoFiles),
      ]);

      const media_urls = [...imageUrls, ...videoUrls];

      const ticket = userTickets.find((t) => t.event_id === selectedEventId);
      const { error } = await supabase.functions.invoke('posts-create', {
        body: {
          event_id: selectedEventId,
          text: content.trim(),
          media_urls,
          ticket_tier_id: ticket?.tier_id ?? null,
        },
      });

      if (error) throw error;

      toast({ title: 'Posted', description: 'Your post has been created!' });
      setContent('');
      setMediaFiles([]);
      if (!preselectedEventId) setSelectedEventId('');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to create post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedTicket = userTickets.find((t) => t.event_id === selectedEventId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background border shadow-xl">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile?.photo_url || ''} />
              <AvatarFallback>{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{profile?.display_name || 'You'}</div>
              {selectedTicket?.ticket_tiers?.badge_label && (
                <Badge variant="secondary" className="text-xs">
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
                  {userTickets.map((t) => (
                    <SelectItem key={t.event_id} value={t.event_id}>
                      <div className="flex items-center gap-2">
                        <span>{t.events.title}</span>
                        {t.ticket_tiers?.badge_label && (
                          <Badge variant="outline" className="text-xs">
                            {t.ticket_tiers.badge_label}
                          </Badge>
                        )}
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
              onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
              className="min-h-[100px] resize-none"
            />
            <div className="mt-1 text-xs text-muted-foreground text-right">{content.length}/{MAX_LEN}</div>
          </div>

          {/* Media Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">Add Media (Optional)</label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input
                type="file"
                accept="video/*,image/*"
                multiple
                onChange={handleMediaUpload}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <Video className="w-8 h-8" />
                <span className="text-sm">Upload video or photos</span>
                <span className="text-xs">{mediaFiles.length}/{MAX_MEDIA} selected</span>
              </label>
            </div>

            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted rounded-lg p-2">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeMedia(index)}>
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
