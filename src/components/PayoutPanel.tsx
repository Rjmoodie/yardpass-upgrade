import React, { useMemo, useState } from 'react';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  contextType?: 'individual' | 'organization';
  contextId?: string;
};

export function PayoutPanel({ contextType = 'individual', contextId }: Props) {
  const {
    account,
    balance,
    status,
    loading,
    error,
    isFullySetup,
    canRequestPayout,
    createStripeConnectAccount,
    resumeOnboarding,
    openStripePortal,
    requestPayout,
    refreshAccount,
    formatMoney,
  } = useStripeConnect(contextType, contextId);

  const [amount, setAmount] = useState<string>('');

  const statusBadge = useMemo(() => {
    switch (status) {
      case 'unlinked':
        return <Badge variant="secondary">Not connected</Badge>;
      case 'restricted':
        return <Badge variant="outline" className="border-amber-300 text-amber-700">Action required</Badge>;
      case 'active':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      default:
        return null;
    }
  }, [status]);

  const availablePretty = useMemo(() => {
    if (!balance) return '-';
    return formatMoney(balance.available, balance.currency);
  }, [balance, formatMoney]);

  const pendingPretty = useMemo(() => {
    if (!balance) return '-';
    return formatMoney(balance.pending, balance.currency);
  }, [balance, formatMoney]);

  const onRequestPayout = async () => {
    // Accept dollars as input; convert to cents
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    await requestPayout(Math.floor(dollars * 100));
    setAmount('');
  };

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      {/* Header */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payouts</h2>
          {statusBadge}
        </div>
        <p className="text-sm text-muted-foreground">
          Connect your Stripe Express account to receive funds and manage payouts.
        </p>
      </section>

      {/* Status & Balance */}
      <section className="grid gap-4 md:grid-cols-3">
        <CardStat label="Status" value={status === 'active' ? 'Active' : status === 'restricted' ? 'Restricted' : 'Not connected'} />
        <CardStat label="Available" value={availablePretty} />
        <CardStat label="Pending" value={pendingPretty} />
      </section>

      {/* Action zone: state-driven buttons */}
      <section className="space-y-4">
        {/* Unlinked → Offer Connect */}
        {status === 'unlinked' && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={createStripeConnectAccount} disabled={loading}>
              Connect with Stripe
            </Button>
            <Button variant="outline" onClick={() => refreshAccount()} disabled={loading}>
              Refresh
            </Button>
          </div>
        )}

        {/* Restricted → Offer Resume Onboarding + Manage */}
        {status === 'restricted' && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={resumeOnboarding} disabled={loading}>
              Finish verification
            </Button>
            <Button variant="secondary" onClick={openStripePortal} disabled={!account?.stripe_connect_id || loading}>
              Open Stripe dashboard
            </Button>
            <Button variant="outline" onClick={() => refreshAccount()} disabled={loading}>
              Refresh
            </Button>
          </div>
        )}

        {/* Active → Offer Manage + Payout */}
        {status === 'active' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={openStripePortal} disabled={!account?.stripe_connect_id || loading}>
                Manage in Stripe
              </Button>
              <Button variant="outline" onClick={() => refreshAccount()} disabled={loading}>
                Refresh
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="payout-amount">Request payout (in {balance?.currency?.toUpperCase() || 'USD'})</Label>
                <Input
                  id="payout-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 125.00"
                  className="w-48"
                />
              </div>
              <Button
                onClick={onRequestPayout}
                disabled={!canRequestPayout || !amount || Number(amount) <= 0 || loading}
              >
                Request payout
              </Button>
            </div>
            {!canRequestPayout && (
              <p className="text-xs text-muted-foreground">
                You'll be able to request a payout when your account is fully verified and you have an available balance.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Errors */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-base font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}