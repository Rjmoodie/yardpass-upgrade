import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ContextType = 'individual' | 'organization';

interface PayoutAccount {
  id: string;
  stripe_connect_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  context_type: ContextType;
  context_id: string;
  created_at: string;
}

interface Balance {
  available: number;   // cents
  pending: number;     // cents
  currency: string;    // e.g. 'usd'
}

type FnResult<T> = { data: T | null; error: string | null };

function normalizeErr(e: unknown): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  try {
    // Supabase Functions often return { error: { message } } or { message }
    const msg = (e as any)?.error?.message ?? (e as any)?.message;
    return typeof msg === 'string' ? msg : JSON.stringify(e);
  } catch {
    return 'Unexpected error';
  }
}

export function useStripeConnect(
  contextType: ContextType = 'individual',
  contextId?: string,
  opts?: {
    // allow callers to override where Stripe sends users back
    returnUrl?: string;
    refreshUrl?: string;
    // auto-refresh from Stripe on first load (default true)
    autoRefresh?: boolean;
  }
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const opLockRef = useRef(false);

  const effectiveContextId = useMemo(
    () => contextId || user?.id || '',
    [contextId, user?.id]
  );

  const returnUrl = useMemo(
    () => opts?.returnUrl ?? `${window.location.origin}/dashboard?tab=payouts`,
    [opts?.returnUrl]
  );
  const refreshUrl = useMemo(
    () => opts?.refreshUrl ?? `${window.location.origin}/dashboard?tab=payouts`,
    [opts?.refreshUrl]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  const lock = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (opLockRef.current) {
      // prevent double-clicks / concurrent operations
      throw new Error('Another operation is in progress, please wait a moment.');
    }
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  }, []);

  const fetchPayoutAccount = useCallback(
    async (id = effectiveContextId): Promise<FnResult<PayoutAccount | null>> => {
      if (!user || !id) return { data: null, error: null };
      try {
        safeSetState(setLoading, true);
        safeSetState(setError, null);

        const { data, error: fetchError } = await supabase
          .from('payout_accounts')
          .select('*')
          .eq('context_type', contextType)
          .eq('context_id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        safeSetState(setAccount, data);

        // Fetch balance only if we have a connected account
        if (data?.stripe_connect_id) {
          try {
            const balRes = await supabase.functions.invoke('get-stripe-balance', {
              body: { context_type: contextType, context_id: id }
            });

            if (!balRes.error) {
              const d = balRes.data ?? {};
              safeSetState(setBalance, {
                available: Number(d.available || 0),
                pending: Number(d.pending || 0),
                currency: (d.currency || 'usd').toLowerCase()
              });
            }
          } catch (e) {
            // Gracefully handle Stripe Connect not being configured
            console.warn('Stripe Connect balance fetch failed (Stripe Connect may not be configured):', e);
            safeSetState(setBalance, null);
          }
        } else {
          safeSetState(setBalance, null);
        }

        return { data, error: null };
      } catch (e) {
        const msg = normalizeErr(e);
        console.error('fetchPayoutAccount error:', e);
        safeSetState(setError, msg);
        return { data: null, error: msg };
      } finally {
        safeSetState(setLoading, false);
      }
    },
    [contextType, effectiveContextId, safeSetState, user]
  );

  const refreshFromStripe = useCallback(
    async () => {
      try {
        const { error } = await supabase.functions.invoke('refresh-stripe-accounts', {});
        if (error) {
          console.warn('refresh-stripe-accounts error:', error);
        }
      } catch (e) {
        console.warn('refresh-stripe-accounts failed:', e);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      await fetchPayoutAccount(effectiveContextId);
      if (opts?.autoRefresh ?? true) {
        await refreshFromStripe();
        await fetchPayoutAccount(effectiveContextId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveContextId, contextType]);

  const createStripeConnectAccount = useCallback(async () => {
    if (!user || !effectiveContextId) return;
    return lock(async () => {
      safeSetState(setLoading, true);
      try {
        const { data, error } = await supabase.functions.invoke('create-stripe-connect', {
          body: {
            context_type: contextType,
            context_id: effectiveContextId,
            return_url: returnUrl,
            refresh_url: refreshUrl
          }
        }).catch(e => {
          // Gracefully handle Stripe Connect not being configured
          console.warn('Stripe Connect account creation failed (Stripe Connect may not be configured):', e);
          return { data: null, error: 'Stripe Connect is not configured. Please contact support.' };
        });
        if (error) throw error;

        if (data?.account_link_url) {
          // Stripe recommends top-level navigation for onboarding (avoids popup blockers)
          window.location.href = data.account_link_url;
        }

        await fetchPayoutAccount(effectiveContextId);
        toast({
          title: 'Stripe Connect',
          description: 'Finish onboarding to enable payouts.'
        });
      } catch (e) {
        const msg = normalizeErr(e);
        toast({ title: 'Setup Failed', description: msg, variant: 'destructive' });
        throw e;
      } finally {
        safeSetState(setLoading, false);
      }
    });
  }, [user, effectiveContextId, contextType, fetchPayoutAccount, lock, refreshUrl, returnUrl, safeSetState, toast]);

  // Useful when an account exists but requirements are past_due / needs more info
  const resumeOnboarding = useCallback(async () => {
    if (!user || !effectiveContextId) return;
    return lock(async () => {
      safeSetState(setLoading, true);
      try {
        const { data, error } = await supabase.functions.invoke('create-stripe-connect', {
          body: {
            context_type: contextType,
            context_id: effectiveContextId,
            return_url: returnUrl,
            refresh_url: refreshUrl,
            // backend can branch: if account exists -> create account_link for updates
            mode: 'refresh_or_update'
          }
        });
        if (error) throw error;

        if (data?.account_link_url) {
          window.location.href = data.account_link_url;
        }
      } catch (e) {
        const msg = normalizeErr(e);
        toast({ title: 'Onboarding Error', description: msg, variant: 'destructive' });
        throw e;
      } finally {
        safeSetState(setLoading, false);
      }
    });
  }, [user, effectiveContextId, contextType, lock, refreshUrl, returnUrl, safeSetState, toast]);

  const requestPayout = useCallback(async (amountCents: number) => {
    if (!user || !effectiveContextId) return;
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a positive payout amount.', variant: 'destructive' });
      return;
    }
    return lock(async () => {
      safeSetState(setLoading, true);
      try {
        const { data, error } = await supabase.functions.invoke('create-payout', {
          body: {
            context_type: contextType,
            context_id: effectiveContextId,
            amount_cents: Math.floor(amountCents)
          }
        });
        if (error) throw error;

        toast({
          title: 'Payout Requested',
          description: `Payout of ${formatMoney(amountCents, balance?.currency || 'usd')} requested.`
        });

        await fetchPayoutAccount(effectiveContextId);
        return data;
      } catch (e) {
        const msg = normalizeErr(e);
        toast({ title: 'Payout Failed', description: msg, variant: 'destructive' });
        throw e;
      } finally {
        safeSetState(setLoading, false);
      }
    });
  }, [user, effectiveContextId, contextType, lock, fetchPayoutAccount, toast, safeSetState, balance?.currency]);

  const openStripePortal = useCallback(async () => {
    if (!account?.stripe_connect_id) return;
    return lock(async () => {
      safeSetState(setLoading, true);
      try {
        const { data, error } = await supabase.functions.invoke('stripe-connect-portal', {
          body: {
            account_id: account.stripe_connect_id,
            return_url: `${window.location.origin}/profile`
          }
        });
        if (error) throw error;

        if (data?.url) {
          // Express Dashboard login link – popup is okay here; also handle blockers
          const popup = window.open(
            data.url,
            '_blank',
            'width=800,height=600,scrollbars=yes,resizable=yes,noopener,noreferrer'
          );
          if (!popup || popup.closed) {
            toast({
              title: 'Popup Blocked',
              description: 'Please allow popups, then try again. If it persists, copy the URL from console.',
              variant: 'destructive',
              duration: 10000
            });
            console.info('Stripe portal URL:', data.url);
          } else {
            toast({ title: 'Opening Stripe Portal', description: 'Stripe Express Dashboard is opening…' });
          }
        }
      } catch (e) {
        const msg = normalizeErr(e);
        toast({ title: 'Portal Error', description: msg, variant: 'destructive' });
      } finally {
        safeSetState(setLoading, false);
      }
    });
  }, [account?.stripe_connect_id, lock, safeSetState, toast]);

  const refreshAccount = useCallback(async (forceStripeRefresh = true) => {
    if (!effectiveContextId) return;
    return lock(async () => {
      safeSetState(setLoading, true);
      try {
        if (forceStripeRefresh) await refreshFromStripe();
        await fetchPayoutAccount(effectiveContextId);
      } catch (e) {
        const msg = normalizeErr(e);
        safeSetState(setError, msg);
      } finally {
        safeSetState(setLoading, false);
      }
    });
  }, [effectiveContextId, fetchPayoutAccount, refreshFromStripe, lock, safeSetState]);

  // Derived helpers
  const isFullySetup = !!(account?.charges_enabled && account?.payouts_enabled && account?.details_submitted);
  const canRequestPayout = !!(isFullySetup && balance && balance.available > 0);

  const status: 'unlinked' | 'restricted' | 'active' = useMemo(() => {
    if (!account?.stripe_connect_id) return 'unlinked';
    return isFullySetup ? 'active' : 'restricted';
  }, [account?.stripe_connect_id, isFullySetup]);

  return {
    account,
    balance,
    loading,
    error,
    status,
    isFullySetup,
    canRequestPayout,
    // actions
    createStripeConnectAccount,
    resumeOnboarding,
    openStripePortal,
    requestPayout,
    refreshAccount,
    // utils
    formatMoney
  };
}

// ---------- small utils ----------
function formatMoney(cents: number, currency = 'usd') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format((cents ?? 0) / 100);
  } catch {
    return `$${((cents ?? 0) / 100).toFixed(2)}`;
  }
}