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

export function PostCreatorModal({ isOpen, onClose, onSuccess, preselectedEventId }: PostCreatorModalProps) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  // Fetch user's tickets
  useEffect(() => {
    if (isOpen && user) {
      fetchUserTickets();
    }
  }, [isOpen, user]);

  const fetchUserTickets = async () => {
    if (!user) return;

    try {
      console.log('Fetching user tickets for user:', user.id);
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

      console.log('User tickets query result:', { data, error });

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }
      
      setUserTickets(data || []);

      // Auto-select if only one ticket or preselected event
      if (preselectedEventId) {
        console.log('Auto-selecting preselected event:', preselectedEventId);
        setSelectedEventId(preselectedEventId);
      } else if (data && data.length === 1) {
        console.log('Auto-selecting single event:', data[0].event_id);
        setSelectedEventId(data[0].event_id);
      }
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load your events",
        variant: "destructive",
      });
    }
  };

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles(prev => [...prev, ...files]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
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
    console.log('Creating post with data:', { selectedEventId, content, mediaFiles });

    try {
      // Upload media files if any
      const mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        
        console.log('Uploading file:', fileName);
        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('event-media')
          .getPublicUrl(fileName);

        mediaUrls.push(publicUrl);
      }

      // Find the ticket tier for this event
      const userTicket = userTickets.find(t => t.event_id === selectedEventId);
      console.log('Found user ticket:', userTicket);

      // Create the post
      console.log('Calling posts-create function...');
      const { data: result, error } = await supabase.functions.invoke('posts-create', {
        body: {
          event_id: selectedEventId,
          text: content,
          media_urls: mediaUrls,
          ticket_tier_id: userTicket?.tier_id,
        },
      });

      console.log('Posts-create result:', result, 'Error:', error);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Your post has been created!",
      });

      // Reset form
      setContent('');
      setMediaFiles([]);
      setSelectedEventId('');
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error creating post:', error);
      
      if (error.message?.includes('requiresTicket')) {
        toast({
          title: "Ticket Required",
          description: "You need a ticket to post to this event",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create post",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedTicket = userTickets.find(t => t.event_id === selectedEventId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                  {userTickets.map((ticket) => (
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
            />
          </div>

          {/* Media Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Add Media (Optional)
            </label>
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
              </label>
            </div>

            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted rounded-lg p-2">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMedia(index)}
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