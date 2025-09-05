import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderStatus {
  status: 'pending' | 'paid' | 'failed' | 'not_found';
  order_id?: string;
  event_title?: string;
  tickets_count?: number;
  total_amount?: number;
  paid_at?: string;
  message?: string;
}

export function useOrderStatus(sessionId: string | null, enabled: boolean = true) {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkOrderStatus = async () => {
    if (!sessionId || !enabled) return;

    try {
      setLoading(true);
      setError(null);

      // Make direct request to the function with session_id as URL parameter
      const response = await fetch(`https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/get-order-status?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      setOrderStatus(data);
    } catch (error: any) {
      console.error('Error checking order status:', error);
      setError(error.message || 'Failed to check order status');
      setOrderStatus({ status: 'failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId && enabled) {
      checkOrderStatus();
    }
  }, [sessionId, enabled]);

  return {
    orderStatus,
    loading,
    error,
    refetch: checkOrderStatus
  };
}