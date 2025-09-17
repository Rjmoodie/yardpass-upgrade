import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PayoutAccount {
  id: string;
  stripe_connect_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  context_type: 'individual' | 'organization';
  context_id: string;
  created_at: string;
}

export function useStripeConnect(contextType: 'individual' | 'organization' = 'individual', contextId?: string) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [balance, setBalance] = useState<{available: number, pending: number, currency: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const effectiveContextId = contextId || user.id;
    fetchPayoutAccount(effectiveContextId);
  }, [user, contextId, contextType]);

  const fetchPayoutAccount = async (effectiveContextId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching payout account for:', { contextType, contextId: effectiveContextId });

      const { data, error: fetchError } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('context_type', contextType)
        .eq('context_id', effectiveContextId)
        .maybeSingle();

      if (fetchError) {
        console.error('Payout account fetch error:', fetchError);
        throw fetchError;
      }

      console.log('Payout account data:', data);
      setAccount(data);

      // If account exists and is set up, fetch balance
      if (data?.stripe_connect_id) {
        await fetchBalance(effectiveContextId);
      }
    } catch (err) {
      console.error('Error fetching payout account:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payout account');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (effectiveContextId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-stripe-balance', {
        body: {
          context_type: contextType,
          context_id: effectiveContextId
        }
      });

      if (error) {
        console.error('Balance fetch error:', error);
      } else {
        setBalance({
          available: data.available || 0,
          pending: data.pending || 0,
          currency: data.currency || 'usd'
        });
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const createStripeConnectAccount = async () => {
    if (!user) return;

    const effectiveContextId = contextId || user.id;

    try {
      setLoading(true);
      
      console.log('Creating Stripe Connect account for:', { contextType, contextId: effectiveContextId });
      
      const { data, error } = await supabase.functions.invoke('create-stripe-connect', {
        body: {
          context_type: contextType,
          context_id: effectiveContextId,
          return_url: `${window.location.origin}/dashboard?tab=payouts`,
          refresh_url: `${window.location.origin}/dashboard?tab=payouts`
        }
      });

      if (error) {
        console.error('Stripe Connect creation error:', error);
        throw error;
      }

      console.log('Stripe Connect response:', data);

      if (data?.account_link_url) {
        // Redirect to Stripe onboarding
        window.open(data.account_link_url, '_blank');
      }

      // Refresh account data
      await fetchPayoutAccount(effectiveContextId);

      toast({
        title: "Stripe Connect Setup",
        description: "Complete the setup process in the new tab to enable payouts.",
      });

    } catch (err) {
      console.error('Error creating Stripe Connect account:', err);
      toast({
        title: "Setup Failed",
        description: err instanceof Error ? err.message : 'Failed to setup Stripe Connect',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async (amountCents: number) => {
    if (!user) return;

    const effectiveContextId = contextId || user.id;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-payout', {
        body: {
          context_type: contextType,
          context_id: effectiveContextId,
          amount_cents: amountCents
        }
      });

      if (error) {
        console.error('Payout request error:', error);
        throw error;
      }

      toast({
        title: "Payout Requested",
        description: `Payout of $${(amountCents / 100).toFixed(2)} has been requested successfully.`,
      });

      // Refresh balance
      await fetchBalance(effectiveContextId);

      return data;
    } catch (err) {
      console.error('Error requesting payout:', err);
      toast({
        title: "Payout Failed",
        description: err instanceof Error ? err.message : 'Failed to request payout',
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const openStripePortal = async () => {
    if (!account?.stripe_connect_id) return;

    try {
      setLoading(true);
      
      console.log('Opening Stripe portal for account:', account.stripe_connect_id);
      
      const { data, error } = await supabase.functions.invoke('stripe-connect-portal', {
        body: {
          account_id: account.stripe_connect_id,
          return_url: `${window.location.origin}/dashboard?tab=payouts`
        }
      });

      if (error) {
        console.error('Stripe portal error:', error);
        throw error;
      }

      console.log('Stripe portal response:', data);

      if (data?.url) {
        window.open(data.url, '_blank');
      }

    } catch (err) {
      console.error('Error opening Stripe portal:', err);
      toast({
        title: "Portal Error",
        description: err instanceof Error ? err.message : 'Failed to open Stripe portal',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAccount = () => {
    const effectiveContextId = contextId || user?.id;
    if (effectiveContextId) {
      console.log('Refreshing payout account...');
      fetchPayoutAccount(effectiveContextId);
    }
  };

  const isFullySetup = account?.charges_enabled && account?.payouts_enabled && account?.details_submitted;

  return {
    account,
    balance,
    loading,
    error,
    isFullySetup,
    createStripeConnectAccount,
    openStripePortal,
    requestPayout,
    refreshAccount
  };
}