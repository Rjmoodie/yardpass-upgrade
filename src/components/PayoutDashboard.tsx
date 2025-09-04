import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { VerificationBadge } from './VerificationBadge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DollarSign, 
  CreditCard, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  Settings
} from 'lucide-react';

export function PayoutDashboard() {
  const { profile } = useAuth();
  const { account, loading, isFullySetup, createStripeConnectAccount, openStripePortal } = useStripeConnect();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verification Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Organizer Verification
                <VerificationBadge 
                  status={profile?.verification_status || 'none'} 
                  size="md" 
                />
              </CardTitle>
              <CardDescription>
                Your verification level affects payout capabilities and platform features
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(!profile?.verification_status || profile?.verification_status === 'none') && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                Complete your first event to begin verification process
              </div>
            )}
            {profile?.verification_status === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <AlertCircle className="w-4 h-4" />
                Verification in progress - payouts available after completion
              </div>
            )}
            {profile?.verification_status === 'verified' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                Verified organizer - full payout access available
              </div>
            )}
            {profile?.verification_status === 'pro' && (
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <CheckCircle className="w-4 h-4" />
                Pro organizer (25+ events) - priority support & advanced features
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connect Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payout Setup
          </CardTitle>
          <CardDescription>
            Connect your bank account to receive event payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!account ? (
              <div className="text-center py-6">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Setup Payouts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect with Stripe to receive payments from your events
                </p>
                <Button onClick={createStripeConnectAccount} disabled={loading}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect with Stripe
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Stripe Account</span>
                      <Badge variant={isFullySetup ? 'default' : 'secondary'}>
                        {isFullySetup ? 'Active' : 'Setup Required'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.stripe_connect_id ? `Account: ${account.stripe_connect_id.slice(-8)}` : 'No account connected'}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={openStripePortal}
                    disabled={!account.stripe_connect_id}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      account.details_submitted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Details</div>
                      <div className="text-muted-foreground">
                        {account.details_submitted ? 'Complete' : 'Pending'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      account.charges_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Charges</div>
                      <div className="text-muted-foreground">
                        {account.charges_enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      account.payouts_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Payouts</div>
                      <div className="text-muted-foreground">
                        {account.payouts_enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>

                {!isFullySetup && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <div className="text-sm">
                      <span className="font-medium text-yellow-800">Setup incomplete.</span>
                      <span className="text-yellow-700 ml-1">
                        Complete your Stripe setup to receive payouts.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payout Information */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Information</CardTitle>
          <CardDescription>
            How and when you'll receive payments from your events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payout schedule:</span>
              <span>After event completion</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee:</span>
              <span>3% + payment processing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Processing time:</span>
              <span>2-7 business days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Refund handling:</span>
              <span>Automatic via your policy</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}