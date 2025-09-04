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
}

export function useStripeConnect() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    fetchPayoutAccount();
  }, [user, profile]);

  const fetchPayoutAccount = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching payout account for user:', user.id);

      const { data, error: fetchError } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('context_type', 'individual')
        .eq('context_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Payout account fetch error:', fetchError);
        throw fetchError;
      }

      console.log('Payout account data:', data);
      setAccount(data);
    } catch (err) {
      console.error('Error fetching payout account:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payout account');
    } finally {
      setLoading(false);
    }
  };

  const createStripeConnectAccount = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      console.log('Creating Stripe Connect account for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('create-stripe-connect', {
        body: {
          context_type: 'individual',
          context_id: user.id,
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
      await fetchPayoutAccount();

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
    console.log('Refreshing payout account...');
    fetchPayoutAccount();
  };

  const isFullySetup = account?.charges_enabled && account?.payouts_enabled && account?.details_submitted;

  return {
    account,
    loading,
    error,
    isFullySetup,
    createStripeConnectAccount,
    openStripePortal,
    refreshAccount
  };
}