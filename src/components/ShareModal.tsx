import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SharePayload } from "@/lib/share";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
}

export const ShareModal = ({ isOpen, onClose, payload }: ShareModalProps) => {
  const { toast } = useToast();

  if (!payload) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      toast({ title: "Link copied to clipboard" });
      onClose();
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = payload.url;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast({ title: "Link copied to clipboard" });
      } catch {
        toast({ title: "Failed to copy link", variant: "destructive" });
      }
      document.body.removeChild(textArea);
      onClose();
    }
  };

  const handleWebShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await handleCopyLink();
      }
      onClose();
    } catch {
      await handleCopyLink();
    }
  };

  const handleSocialShare = (platform: string) => {
    const text = payload.text || payload.title;
    let url = '';
    
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + payload.url)}`;
        break;
      case 'sms':
        url = `sms:?&body=${encodeURIComponent(text + ' ' + payload.url)}`;
        break;
      case 'messenger':
        // Facebook Messenger fallback to copy on web
        if ((window as any).Capacitor?.isNativePlatform) {
          url = `fb-messenger://share?link=${encodeURIComponent(payload.url)}`;
        } else {
          handleCopyLink();
          return;
        }
        break;
    }
    
    if (url) {
      window.open(url, '_blank');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium">{payload.title}</p>
            <p className="text-sm text-muted-foreground break-all">{payload.url}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleCopyLink} variant="outline" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
            
            <Button onClick={handleWebShare} variant="outline" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share via...
            </Button>
            
            <Button 
              onClick={() => handleSocialShare('whatsapp')} 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            
            <Button 
              onClick={() => handleSocialShare('sms')} 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};