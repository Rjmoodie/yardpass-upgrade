import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Share, Copy, MessageCircle, Smartphone, MoreHorizontal } from 'lucide-react';
import { copyToClipboard } from '@/utils/platform';
import { capture } from '@/lib/analytics';
import { SharePayload } from '@/lib/share';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
}

export const ShareModal = ({ isOpen, onClose, payload }: ShareModalProps) => {
  if (!payload) return null;

  const handleCopyLink = async () => {
    try {
      const success = await copyToClipboard(payload.url);
      if (success) {
        toast({
          title: "Link copied! 👍",
          description: "Link copied to clipboard",
        });
        capture('share_completed', { channel: 'copy', ...payload } as Record<string, unknown>);
      } else {
        toast({
          title: "Copy failed",
          description: "Unable to copy link",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "Copy failed",
        description: "Unable to copy link",
        variant: "destructive",
      });
    }
  };

  const handleWebShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share(payload);
        capture('share_completed', { channel: 'web_api_retry', ...payload } as Record<string, unknown>);
        onClose();
      } else {
        await handleCopyLink();
      }
    } catch (error) {
      console.log('Web share retry failed:', error);
      await handleCopyLink();
    }
  };

  const handleSocialShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(payload.url);
    const encodedText = encodeURIComponent(`${payload.text || ''} ${payload.url}`.trim());
    const encodedTitle = encodeURIComponent(payload.title);
    
    let shareUrl = '';
    
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedText}`;
        break;
      case 'sms':
        shareUrl = `sms:?&body=${encodedText}`;
        break;
      case 'messenger':
        // Try app first, fallback to web
        shareUrl = `fb-messenger://share?link=${encodedUrl}`;
        setTimeout(() => {
          window.location.href = `https://www.messenger.com/new?message=${encodedText}`;
        }, 1000);
        break;
    }
    
    if (shareUrl) {
      try {
        window.location.href = shareUrl;
        capture('share_completed', { channel: platform, ...payload } as Record<string, unknown>);
      } catch (error) {
        console.error(`${platform} share failed:`, error);
        handleCopyLink();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="w-5 h-5" />
            Share
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="font-medium mb-2 line-clamp-2">{payload.title}</p>
            <div className="flex gap-2">
              <Input 
                value={payload.url} 
                readOnly 
                className="text-sm"
              />
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm font-medium">Share via</p>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleCopyLink}
                variant="outline" 
                className="justify-start gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </Button>
              
              <Button 
                onClick={() => handleSocialShare('whatsapp')}
                variant="outline" 
                className="justify-start gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
              
              <Button 
                onClick={() => handleSocialShare('sms')}
                variant="outline" 
                className="justify-start gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Messages
              </Button>
              
              <Button 
                onClick={handleWebShare}
                variant="outline" 
                className="justify-start gap-2"
              >
                <MoreHorizontal className="w-4 h-4" />
                Share via...
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};