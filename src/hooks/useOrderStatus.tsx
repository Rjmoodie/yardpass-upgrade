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
      console.log('🔍 Fetching order status for session:', sessionId);
      
      // Construct the URL with session_id parameter
      const functionUrl = `https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/get-order-status?session_id=${encodeURIComponent(sessionId)}`;
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Edge Function returned a non-2xx status code`);
      }

      const data = await response.json();

      console.log('📡 get-order-status response:', { data });

      if (data.error) {
        throw new Error(data.error || 'Failed to fetch order status');
      }

      if (data.status === 'not_found') {
        console.log('❌ Order not found for session:', sessionId);
        setError('Order not found');
        setOrderStatus(null);
      } else {
        console.log('✅ Order status received:', data);
        setOrderStatus({
          id: data.order_id || data.id,
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
      
      // If it's a 500 error, don't retry immediately to prevent infinite loops
      if (errorMessage.includes('500') || errorMessage.includes('non-2xx')) {
        console.log('🚫 Server error detected, backing off from retries...');
        // Set a longer retry interval for server errors
        setTimeout(() => {
          if (sessionId) {
            console.log('🔄 Retrying after server error cooldown...');
            fetchOrderStatus();
          }
        }, 15000); // 15 second cooldown for server errors
      } else if (errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
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