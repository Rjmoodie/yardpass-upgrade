// Comprehensive interaction utilities for buttons and user actions
import { toast } from '@/hooks/use-toast';
import { copyToClipboard, shareContent, openMap, callPhoneNumber, sendEmail } from './platform';
import { supabase } from '@/integrations/supabase/client';

// Enhanced purchase flow with better error handling
export const handlePurchaseFlow = async (eventId: string, ticketSelections: any[]) => {
  try {
    // Validate selections
    if (!ticketSelections.length) {
      toast({
        title: "No tickets selected",
        description: "Please select at least one ticket",
        variant: "destructive",
      });
      return { success: false };
    }

    // Create checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { eventId, ticketSelections }
    });

    if (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout failed",
        description: error.message || "Unable to create checkout session",
        variant: "destructive",
      });
      return { success: false };
    }

    if (data?.url) {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
      return { success: true };
    } else {
      toast({
        title: "Checkout failed",
        description: "No checkout URL received",
        variant: "destructive",
      });
      return { success: false };
    }
  } catch (error) {
    console.error('Purchase flow error:', error);
    toast({
      title: "Purchase failed",
      description: "An unexpected error occurred",
      variant: "destructive",
    });
    return { success: false };
  }
};

// Enhanced post interactions using optimized reactions endpoint
export const handlePostLike = async (postId: string, currentlyLiked: boolean) => {
  try {
    // Use the reactions-toggle function for idempotent operations
    const { data, error } = await supabase.functions.invoke('reactions-toggle', {
      body: { post_id: postId, kind: 'like' }
    });

    if (error) throw error;

    return { 
      success: true, 
      newLikedState: data.liked,
      newLikeCount: data.like_count 
    };
  } catch (error) {
    console.error('Like error:', error);
    toast({
      title: "Like failed",
      description: "Unable to update like status",
      variant: "destructive",
    });
    return { success: false };
  }
};

export const handlePostComment = async (postId: string, comment: string) => {
  try {
    if (!comment.trim()) {
      toast({
        title: "Empty comment",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return { success: false };
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      });
      return { success: false };
    }

    const { error } = await supabase
      .from('events.event_comments')
      .insert({
        post_id: postId,
        author_user_id: userData.user.id,
        text: comment.trim()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Comment error:', error);
    toast({
      title: "Comment failed",
      description: "Unable to post comment",
      variant: "destructive",
    });
    return { success: false };
  }
};

// Enhanced event actions using follows table
export const handleEventFollow = async (eventId: string, currentlyFollowing: boolean) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to follow events",
        variant: "destructive",
      });
      return { success: false };
    }

    if (currentlyFollowing) {
      // Unfollow event
      const { error } = await supabase
        .from('users.follows')
        .delete()
        .eq('follower_user_id', userData.user.id)
        .eq('target_type', 'event')
        .eq('target_id', eventId);

      if (error) throw error;

      toast({
        title: "Unfollowed event",
        description: "You will no longer receive updates",
      });
    } else {
      // Follow event
      const { error } = await supabase
        .from('users.follows')
        .insert({
          follower_user_id: userData.user.id,
          target_type: 'event',
          target_id: eventId
        });

      if (error) throw error;

      toast({
        title: "Following event",
        description: "You'll receive updates about this event",
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Follow error:', error);
    toast({
      title: "Follow action failed",
      description: "Unable to update follow status",
      variant: "destructive",
    });
    return { success: false };
  }
};

// Location and contact interactions
export const handleLocationPress = (address: string, eventName?: string) => {
  try {
    openMap(address, eventName);
    
    // Track analytics
    supabase.functions.invoke('analytics-event-overview', {
      body: { 
        action: 'location_opened',
        address,
        event_name: eventName 
      }
    }).catch(console.error);
    
  } catch (error) {
    console.error('Location open error:', error);
    toast({
      title: "Unable to open map",
      description: "Please check the address manually",
      variant: "destructive",
    });
  }
};

export const handlePhonePress = (phoneNumber: string) => {
  try {
    callPhoneNumber(phoneNumber);
  } catch (error) {
    console.error('Phone call error:', error);
    toast({
      title: "Unable to make call",
      description: "Please dial the number manually",
      variant: "destructive",
    });
  }
};

export const handleEmailPress = (email: string, subject?: string, body?: string) => {
  try {
    sendEmail(email, subject, body);
  } catch (error) {
    console.error('Email error:', error);
    toast({
      title: "Unable to open email",
      description: "Please send email manually",
      variant: "destructive",
    });
  }
};

// Utility to handle async button actions with loading states
export const withLoadingState = <T extends any[]>(
  handler: (...args: T) => Promise<{ success: boolean }>,
  setLoading?: (loading: boolean) => void
) => {
  return async (...args: T) => {
    setLoading?.(true);
    try {
      const result = await handler(...args);
      return result;
    } finally {
      setLoading?.(false);
    }
  };
};