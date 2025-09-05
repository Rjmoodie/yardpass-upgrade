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
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_cents,
          created_at,
          paid_at,
          events (
            title
          )
        `)
        .eq('stripe_session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          setError('Order not found');
          setOrderStatus(null);
        } else {
          throw error;
        }
      } else {
        setOrderStatus({
          id: data.id,
          status: data.status as any,
          event_title: 'Event',
          tickets_count: 0, // Will be updated when tickets are created
          total_amount: data.total_cents / 100,
          created_at: data.created_at,
          paid_at: data.paid_at
        });
      }
    } catch (err: unknown) {
      console.error('Error fetching order status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch order status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();
  }, [sessionId]);

  const refetch = () => {
    return fetchOrderStatus();
  };

  return {
    orderStatus,
    loading,
    error,
    refetch
  };
}