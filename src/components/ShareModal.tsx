import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Share, Copy, Facebook, Twitter, MessageCircle } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  eventId: string;
  eventDescription: string;
}

export const ShareModal = ({ isOpen, onClose, eventTitle, eventId, eventDescription }: ShareModalProps) => {
  const eventUrl = `https://yardpass.com/events/${eventId}`;
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventTitle,
          text: eventDescription,
          url: eventUrl
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSocialShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(eventUrl);
    const encodedTitle = encodeURIComponent(eventTitle);
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="w-5 h-5" />
            Share Event
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="font-medium mb-2">{eventTitle}</p>
            <div className="flex gap-2">
              <Input 
                value={eventUrl} 
                readOnly 
                className="text-sm"
              />
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Share via</p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleNativeShare}
                variant="outline" 
                className="justify-start gap-2"
              >
                <Share className="w-4 h-4" />
                Native Share
              </Button>
              
              <Button 
                onClick={() => handleSocialShare('twitter')}
                variant="outline" 
                className="justify-start gap-2"
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </Button>
              
              <Button 
                onClick={() => handleSocialShare('facebook')}
                variant="outline" 
                className="justify-start gap-2"
              >
                <Facebook className="w-4 h-4" />
                Facebook
              </Button>
              
              <Button 
                onClick={() => handleSocialShare('whatsapp')}
                variant="outline" 
                className="justify-start gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};