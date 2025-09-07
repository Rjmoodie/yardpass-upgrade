// src/hooks/useOrderStatus.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderStatus {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  event_title: string;
  tickets_count: number;
  total_amount: number;
  created_at: string;
  paid_at?: string;
}

export function useOrderStatus(sessionId: string | null) {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderStatus = async () => {
    if (!sessionId) {
      setOrderStatus(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch order, event title, and order_items to compute ticket count
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_cents,
          created_at,
          paid_at,
          events!event_id (
            title
          ),
          order_items (
            quantity
          )
        `)
        .eq('stripe_session_id', sessionId)
        .single();

      if (error) {
        if ((error as any).code === 'PGRST116') {
          setError('Order not found');
          setOrderStatus(null);
        } else {
          throw error;
        }
      } else {
        const ticketsCount =
          Array.isArray(data.order_items) && data.order_items.length > 0
            ? data.order_items.reduce((sum: number, it: { quantity: number }) => sum + (it?.quantity || 0), 0)
            : 0;

        setOrderStatus({
          id: data.id,
          status: data.status as OrderStatus['status'],
          event_title: data.events?.title || 'Event',
          tickets_count: ticketsCount,
          total_amount: (data.total_cents || 0) / 100,
          created_at: data.created_at,
          paid_at: data.paid_at || undefined,
        });
      }
    } catch (err: unknown) {
      console.error('Error fetching order status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch order status';
      setError(errorMessage);
      
      // If it's a network error or timeout, we might want to retry
      if (errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
        console.log('🔄 Network error detected, will retry...');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();
    // Live updates if this order changes (e.g., Stripe webhook marks paid)
    if (!sessionId) return;

    const channel = supabase
      .channel(`order-status:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `stripe_session_id=eq.${sessionId}`,
        },
        () => {
          // Re-fetch to capture related aggregates
          fetchOrderStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const refetch = () => fetchOrderStatus();

  return {
    orderStatus,
    loading,
    error,
    refetch,
  };
}
