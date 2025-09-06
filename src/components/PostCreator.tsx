import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ArrowLeft, Camera, Video, MapPin, Tag, X } from 'lucide-react';
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
};

const MAX_LEN = 280;
const MAX_MEDIA = 8;

export function PostCreator({ user, onBack, onPost }: PostCreatorProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data, error } = await supabase
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

        if (error) throw error;

        setUserTickets((data as unknown as UserTicket[]) ?? []);
        if (data && data.length === 1) setSelectedEventId(data[0].event_id);
      } catch (e: any) {
        console.error(e);
        toast({
          title: 'Error',
          description: e.message || 'Failed to load your events',
          variant: 'destructive',
        });
      }
    };

    fetchTickets();
  }, [user.id, toast]);

  const selectedTicket = useMemo(
    () => userTickets.find((t) => t.event_id === selectedEventId) || null,
    [userTickets, selectedEventId]
  );

  const handlePickMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const next = [...mediaFiles, ...files].slice(0, MAX_MEDIA);
    setMediaFiles(next);
    e.currentTarget.value = '';
  };

  const removeMedia = (idx: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
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
    // expects an Edge Function 'upload-video-mux' that returns { asset_id }
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
      const imageFiles = mediaFiles.filter((f) => f.type.startsWith('image/'));
      const videoFiles =
        mediaFiles.filter((f) => f.type.startsWith('video/')) ??
        mediaFiles.filter((f) =>
          ['.mp4', '.webm', '.mov'].some((ext) => f.name.toLowerCase().endsWith(ext))
        );

      const [imageUrls, videoUrls] = await Promise.all([
        uploadImages(imageFiles),
        uploadVideos(videoFiles),
      ]);

      const media_urls = [...imageUrls, ...videoUrls];

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
      setContent('');
      setMediaFiles([]);
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

  const canPost = Boolean(content.trim() && selectedEventId && !uploading);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1>Create Post</h1>
              <p className="text-sm text-muted-foreground">Share your event experience</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={!canPost} className="px-6">
            {uploading ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Post Content */}
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
            />

            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{content.length}/{MAX_LEN} characters</span>
              <span>{mediaFiles.length}/{MAX_MEDIA} media</span>
            </div>

            {/* Media Picker */}
            <div className="flex gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePickMedia}
                  className="hidden"
                />
                <Button asChild variant="outline" size="sm">
                  <span className="cursor-pointer">
                    <Camera className="w-4 h-4 mr-1" />
                    Photos
                  </span>
                </Button>
              </label>

              <label className="inline-flex">
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handlePickMedia}
                  className="hidden"
                />
                <Button asChild variant="outline" size="sm">
                  <span className="cursor-pointer">
                    <Video className="w-4 h-4 mr-1" />
                    Videos
                  </span>
                </Button>
              </label>
            </div>

            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {mediaFiles.map((file, idx) => (
                  <div key={idx} className="relative border rounded-lg p-2 text-xs">
                    <div className="absolute top-1 right-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => removeMedia(idx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="truncate">{file.name}</div>
                    <div className="text-muted-foreground">{Math.round(file.size / 1024)} KB</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tag Event */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tag Event *
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event you're attending" />
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
                      {user.name.split(' ').map((n) => n[0]).join('')}
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
                    <p className="text-sm mb-2">{content}</p>

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
    </div>
  );
}

export default PostCreator;
