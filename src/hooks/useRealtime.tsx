import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type RealtimeEventType = 
  | 'order_status_changed'
  | 'ticket_issued'
  | 'payment_completed'
  | 'payment_failed'
  | 'refund_processed'
  | 'event_updated'
  | 'post_created'
  | 'post_updated'
  | 'reaction_added'
  | 'reaction_removed'
  | 'comment_added'
  | 'comment_removed'
  | 'follow_updated';

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: any;
  timestamp: string;
  userId?: string;
  eventId?: string;
}

export interface UseRealtimeOptions {
  eventIds?: string[];
  userId?: string;
  onEvent?: (event: RealtimeEvent) => void;
  enableNotifications?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const { eventIds, userId, onEvent, enableNotifications = true } = options;

  // Handle incoming realtime events
  const handleRealtimeEvent = useCallback((payload: any, type: RealtimeEventType) => {
    const event: RealtimeEvent = {
      type,
      data: payload.new || payload.old || payload,
      timestamp: new Date().toISOString(),
      userId: payload.new?.user_id || payload.old?.user_id,
      eventId: payload.new?.event_id || payload.old?.event_id
    };

    setEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events

    // Call custom handler
    if (onEvent) {
      onEvent(event);
    }

    // Show notifications for important events
    if (enableNotifications && user) {
      showNotificationForEvent(event);
    }
  }, [onEvent, enableNotifications, user]);

  const showNotificationForEvent = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'payment_completed':
        toast({
          title: "Payment Successful",
          description: "Your payment has been processed successfully",
        });
        break;
      case 'payment_failed':
        toast({
          title: "Payment Failed",
          description: "There was an issue processing your payment",
          variant: "destructive",
        });
        break;
      case 'ticket_issued':
        toast({
          title: "Ticket Issued",
          description: "Your ticket has been issued successfully",
        });
        break;
      case 'refund_processed':
        toast({
          title: "Refund Processed",
          description: "Your refund has been processed",
        });
        break;
    }
  };

  useEffect(() => {
    if (!user && !userId) return;

    const channels: any[] = [];

    // Subscribe to order updates for the user
    if (user || userId) {
      const orderChannel = supabase
        .channel('user-orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user?.id || userId}`
          },
          (payload) => {
            if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old.status) {
              const statusMap: Record<string, RealtimeEventType> = {
                'paid': 'payment_completed',
                'failed': 'payment_failed',
                'refunded': 'refund_processed'
              };
              const eventType = statusMap[payload.new.status] || 'order_status_changed';
              handleRealtimeEvent(payload, eventType);
            }
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });

      channels.push(orderChannel);
    }

    // Subscribe to ticket updates
    if (user || userId) {
      const ticketChannel = supabase
        .channel('user-tickets')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tickets',
            filter: `owner_user_id=eq.${user?.id || userId}`
          },
          (payload) => handleRealtimeEvent(payload, 'ticket_issued')
        )
        .subscribe();

      channels.push(ticketChannel);
    }

  // Subscribe to event-specific updates
  if (eventIds && eventIds.length > 0) {
    eventIds.forEach(eventId => {
      // Event posts
      const postChannel = supabase
        .channel(`event-posts-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_posts',
            filter: `event_id=eq.${eventId}`
          },
          (payload) => handleRealtimeEvent(payload, 'post_created')
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'event_posts',
            filter: `event_id=eq.${eventId}`
          },
          (payload) => handleRealtimeEvent(payload, 'post_updated')
        )
        .subscribe();

      // Event reactions (likes) - track both INSERT and DELETE
      const reactionChannel = supabase
        .channel(`event-reactions-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_reactions',
            filter: `post_id=in.(select id from event_posts where event_id='${eventId}')`
          },
          (payload) => handleRealtimeEvent(payload, 'reaction_added')
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'event_reactions',
            filter: `post_id=in.(select id from event_posts where event_id='${eventId}')`
          },
          (payload) => handleRealtimeEvent(payload, 'reaction_removed')
        )
        .subscribe();

      // Event comments
      const commentChannel = supabase
        .channel(`event-comments-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_comments',
            filter: `post_id=in.(select id from event_posts where event_id='${eventId}')`
          },
          (payload) => handleRealtimeEvent(payload, 'comment_added')
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'event_comments',
            filter: `post_id=in.(select id from event_posts where event_id='${eventId}')`
          },
          (payload) => handleRealtimeEvent(payload, 'comment_removed')
        )
        .subscribe();

      channels.push(postChannel, reactionChannel, commentChannel);
    });
  }

  // Subscribe to follow updates for the user
  if (user) {
    const followChannel = supabase
      .channel('user-follows')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_user_id=eq.${user.id}`
        },
        (payload) => handleRealtimeEvent(payload, 'follow_updated')
      )
      .subscribe();

    channels.push(followChannel);
  }

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setIsConnected(false);
    };
  }, [user, userId, eventIds, handleRealtimeEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    isConnected,
    events,
    clearEvents
  };
}

// Specialized hook for payment status
export function usePaymentStatus(orderId?: string) {
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkPaymentStatus = useCallback(async () => {
    if (!orderId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-order-status', {
        body: { orderId }
      });

      if (error) throw error;
      setPaymentStatus(data.status);
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useRealtime({
    onEvent: (event) => {
      if (event.type === 'order_status_changed' && event.data.id === orderId) {
        setPaymentStatus(event.data.status);
      }
    }
  });

  useEffect(() => {
    checkPaymentStatus();
  }, [checkPaymentStatus]);

  return {
    paymentStatus,
    isLoading,
    checkPaymentStatus
  };
}