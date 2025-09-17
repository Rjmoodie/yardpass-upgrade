import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import {
  DollarSign,
  AlertCircle,
  CheckCircle,
  TrendingUp
} from 'lucide-react';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { useToast } from '@/hooks/use-toast';

interface PayoutManagerProps {
  contextType: 'individual' | 'organization';
  contextId: string;
  className?: string;
}

export function PayoutManager({ contextType, contextId, className = "" }: PayoutManagerProps) {
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const { toast } = useToast();
  
  const {
    account,
    balance,
    loading,
    isFullySetup,
    requestPayout
  } = useStripeConnect(contextType, contextId);

  const handleRequestPayout = async () => {
    if (!payoutAmount || !balance) return;

    const amountCents = Math.round(parseFloat(payoutAmount) * 100);
    
    if (amountCents <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than $0.00",
        variant: "destructive"
      });
      return;
    }

    if (amountCents > balance.available) {
      toast({
        title: "Insufficient Balance",
        description: `Available balance: $${(balance.available / 100).toFixed(2)}`,
        variant: "destructive"
      });
      return;
    }

    try {
      setRequesting(true);
      await requestPayout(amountCents);
      setPayoutAmount('');
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setRequesting(false);
    }
  };

  const maxAmount = balance ? (balance.available / 100).toFixed(2) : '0.00';

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-16 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Request Payout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your Stripe account first to request payouts.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isFullySetup) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Request Payout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Complete your Stripe account verification to request payouts.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Request Payout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {balance && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Available</div>
              <div className="text-2xl font-bold text-green-600">
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

        {balance && balance.available > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Payout Amount (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="payout-amount"
                  type="number"
                  placeholder="0.00"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="pl-9"
                  min="0.01"
                  max={maxAmount}
                  step="0.01"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Maximum available: ${maxAmount}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setPayoutAmount(maxAmount)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Max
              </Button>
              <Button
                onClick={() => setPayoutAmount((balance.available / 200).toFixed(2))}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Half
              </Button>
            </div>

            <Button
              onClick={handleRequestPayout}
              disabled={!payoutAmount || requesting || parseFloat(payoutAmount) <= 0}
              className="w-full"
            >
              {requesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Requesting...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Request Payout
                </>
              )}
            </Button>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Payouts typically arrive in 1-2 business days to your connected bank account.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No funds available for payout. Revenue will appear here after successful event sales.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}