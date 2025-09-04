import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { shareContent, copyToClipboard } from '@/utils/platform';
import { supabase } from '@/integrations/supabase/client';

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

export const useShare = () => {
  const [isSharing, setIsSharing] = useState(false);

  const shareEvent = async (eventId: string, eventTitle: string) => {
    setIsSharing(true);
    try {
      // Get share URL from backend
      const { data, error } = await supabase.functions.invoke('share-event', {
        body: { event_id: eventId, platform: 'copy' }
      });

      if (error) throw error;

      const shareData: ShareData = {
        title: `${eventTitle} on YardPass`,
        text: data.share.text,
        url: data.share.url
      };

      const success = await shareContent(shareData);
      
      if (success) {
        toast({
          title: "Shared successfully!",
          description: "Event link copied to clipboard",
        });
      } else {
        toast({
          title: "Share failed",
          description: "Unable to share the event",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      // Fallback to simple copy
      const fallbackUrl = `${window.location.origin}/event/${eventId}`;
      const success = await copyToClipboard(fallbackUrl);
      
      if (success) {
        toast({
          title: "Link copied!",
          description: "Event link copied to clipboard",
        });
      } else {
        toast({
          title: "Share failed",
          description: "Unable to copy link",
          variant: "destructive",
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const sharePost = async (postId: string, eventTitle: string, postText?: string) => {
    setIsSharing(true);
    try {
      const shareData: ShareData = {
        title: `Check out this post from ${eventTitle}`,
        text: postText || 'Interesting post on YardPass',
        url: `${window.location.origin}/post/${postId}`
      };

      const success = await shareContent(shareData);
      
      if (success) {
        toast({
          title: "Post shared!",
          description: "Post link copied to clipboard",
        });
      } else {
        toast({
          title: "Share failed",
          description: "Unable to share the post",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Share post error:', error);
      toast({
        title: "Share failed",
        description: "Unable to share the post",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const copyLink = async (url: string, successMessage = "Link copied!") => {
    try {
      const success = await copyToClipboard(url);
      
      if (success) {
        toast({
          title: successMessage,
          description: "Link copied to clipboard",
        });
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

  return {
    shareEvent,
    sharePost,
    copyLink,
    isSharing
  };
};