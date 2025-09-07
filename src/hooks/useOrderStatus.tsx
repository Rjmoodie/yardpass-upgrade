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
      // Use the edge function for better error handling and service role access
      const { data, error } = await supabase.functions.invoke('get-order-status', {
        body: { session_id: sessionId }
      });

      if (error) {
        throw error;
      }

      if (data.status === 'not_found') {
        setError('Order not found');
        setOrderStatus(null);
      } else {
        setOrderStatus({
          id: data.order_id,
          status: data.status as OrderStatus['status'],
          event_title: data.event_title || 'Event',
          tickets_count: data.tickets_count || 0,
          total_amount: data.total_amount || 0,
          created_at: data.created_at || new Date().toISOString(),
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
