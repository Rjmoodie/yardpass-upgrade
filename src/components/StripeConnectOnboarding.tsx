import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  CreditCard,
  Shield,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { formatDistanceToNow } from 'date-fns';

interface StripeConnectOnboardingProps {
  contextType: 'individual' | 'organization';
  contextId: string;
  title?: string;
  description?: string;
  className?: string;
}

export function StripeConnectOnboarding({
  contextType,
  contextId,
  title = "Enable Payouts",
  description = "Connect with Stripe to receive payouts from your events",
  className = ""
}: StripeConnectOnboardingProps) {
  const [refreshing, setRefreshing] = useState(false);
  const {
    account,
    balance,
    loading,
    error,
    isFullySetup,
    createStripeConnectAccount,
    openStripePortal,
    refreshAccount
  } = useStripeConnect(contextType, contextId);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAccount();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = () => {
    if (!account) {
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Not Connected
        </Badge>
      );
    }

    if (isFullySetup) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 gap-1">
          <CheckCircle className="w-3 h-3" />
          Active
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="border-yellow-300 text-yellow-700 gap-1">
        <AlertCircle className="w-3 h-3" />
        Setup Required
      </Badge>
    );
  };

  const getStatusMessage = () => {
    if (!account) {
      return "Connect with Stripe to start receiving payouts from your events.";
    }

    if (isFullySetup) {
      return "Your Stripe Connect account is fully verified and ready to receive payouts.";
    }

    const issues = [];
    if (!account.details_submitted) issues.push("complete verification");
    if (!account.charges_enabled) issues.push("enable charges");
    if (!account.payouts_enabled) issues.push("enable payouts");

    return `Please ${issues.join(", ")} to start receiving payouts.`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-32 animate-pulse" />
              <div className="h-4 bg-muted rounded w-48 animate-pulse" />
            </div>
            <div className="h-6 bg-muted rounded w-20 animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-16 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>{getStatusMessage()}</AlertDescription>
        </Alert>

        {balance && isFullySetup && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Available Balance</div>
              <div className="text-xl font-semibold">
                ${(balance.available / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="text-xl font-semibold">
                ${(balance.pending / 100).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {!account ? (
            <Button
              onClick={createStripeConnectAccount}
              disabled={loading}
              className="w-full gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Connect with Stripe
            </Button>
          ) : !isFullySetup ? (
            <Button
              onClick={createStripeConnectAccount}
              disabled={loading}
              className="w-full gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Complete Setup
            </Button>
          ) : (
            <Button
              onClick={openStripePortal}
              variant="outline"
              disabled={loading}
              className="w-full gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Stripe Account
            </Button>
          )}

          {account && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Account ID:</span>
                <span className="font-mono">{account.stripe_connect_id?.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="flex items-center gap-1">
                  {account.details_submitted ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-yellow-600" />
                  )}
                  <span className="text-xs">Details</span>
                </div>
                <div className="flex items-center gap-1">
                  {account.charges_enabled ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-yellow-600" />
                  )}
                  <span className="text-xs">Charges</span>
                </div>
                <div className="flex items-center gap-1">
                  {account.payouts_enabled ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-yellow-600" />
                  )}
                  <span className="text-xs">Payouts</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {isFullySetup && (
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-2">
              Revenue from your events will be automatically transferred to your connected account after each successful sale.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}