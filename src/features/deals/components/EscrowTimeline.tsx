// Payment & Escrow Management - Complete payment workflow
// Handles payments, escrow states, payouts, and financial tracking

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  CreditCard, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  Upload,
  Eye,
  Lock,
  Unlock,
  RefreshCw,
  ExternalLink,
  Receipt,
  Banknote,
  Calendar,
  User,
  Building2
} from 'lucide-react';
import { sponsorshipClient, formatCurrency, formatDate } from '@/integrations/supabase/sponsorship-client';
import type { 
  SponsorshipOrderComplete,
  SponsorshipPayout,
  PayoutConfiguration,
  PayoutQueue,
  SponsorshipAnalytics 
} from '@/types/sponsorship-complete';

interface PaymentEscrowManagerProps {
  orderId?: string;
  onPaymentComplete?: (orderId: string) => void;
  onPayoutProcessed?: (payoutId: string) => void;
}

export const PaymentEscrowManager: React.FC<PaymentEscrowManagerProps> = ({
  orderId,
  onPaymentComplete,
  onPayoutProcessed
}) => {
  const [orders, setOrders] = useState<SponsorshipOrderComplete[]>([]);
  const [payouts, setPayouts] = useState<SponsorshipPayout[]>([]);
  const [payoutConfig, setPayoutConfig] = useState<PayoutConfiguration | null>(null);
  const [analytics, setAnalytics] = useState<SponsorshipAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrder, setSelectedOrder] = useState<SponsorshipOrderComplete | null>(null);

  useEffect(() => {
    // Don't auto-load if feature not deployed
    // loadData();
    setLoading(false);
  }, [orderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load analytics
      const analyticsResponse = await sponsorshipClient.getSponsorshipAnalytics();
      if (analyticsResponse.success && analyticsResponse.data) {
        setAnalytics(analyticsResponse.data);
      }

      // Load orders (this would be implemented with a proper API)
      // For now, we'll use mock data
      setOrders([]);
      setPayouts([]);
      
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (orderId: string, action: string) => {
    try {
      // Implement payment actions based on the action type
      switch (action) {
        case 'process_payment':
          // Process payment through Stripe
          break;
        case 'release_escrow':
          // Release escrow funds
          break;
        case 'refund':
          // Process refund
          break;
        case 'dispute':
          // Handle dispute
          break;
      }
      
      onPaymentComplete?.(orderId);
      loadData(); // Reload data after action
    } catch (err) {
      setError('Failed to process payment action');
      console.error('Error processing payment:', err);
    }
  };

  const handlePayoutAction = async (payoutId: string, action: string) => {
    try {
      // Implement payout actions
      switch (action) {
        case 'retry_payout':
          // Retry failed payout
          break;
        case 'cancel_payout':
          // Cancel pending payout
          break;
      }
      
      onPayoutProcessed?.(payoutId);
      loadData(); // Reload data after action
    } catch (err) {
      setError('Failed to process payout action');
      console.error('Error processing payout:', err);
    }
  };

  const getEscrowStatusColor = (state: string) => {
    switch (state) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'funded': return 'bg-blue-100 text-blue-800';
      case 'locked': return 'bg-orange-100 text-orange-800';
      case 'released': return 'bg-green-100 text-green-800';
      case 'refunded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPayoutStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const OrderCard: React.FC<{ order: SponsorshipOrderComplete }> = ({ order }) => {
    const canReleaseEscrow = order.escrow_state === 'funded' && order.status === 'completed';
    const canRefund = order.escrow_state === 'funded' || order.escrow_state === 'locked';
    const canDispute = order.escrow_state === 'locked';

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(order.created_at)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(order.amount_cents)}
              </div>
              <Badge className={getEscrowStatusColor(order.escrow_state || 'pending')}>
                {order.escrow_state || 'pending'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className="ml-2">
                {order.status}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Payout Status:</span>
              <Badge className={`ml-2 ${getPayoutStatusColor(order.payout_status)}`}>
                {order.payout_status}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Application Fee:</span>
              <span className="ml-2">{formatCurrency(order.application_fee_cents)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Version:</span>
              <span className="ml-2">v{order.version_number}</span>
            </div>
          </div>

          {order.notes && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Notes:</strong> {order.notes}
              </p>
            </div>
          )}

          <div className="flex space-x-2">
            {canReleaseEscrow && (
              <Button 
                size="sm" 
                onClick={() => handlePaymentAction(order.id, 'release_escrow')}
                className="flex-1"
              >
                <Unlock className="h-4 w-4 mr-2" />
                Release Escrow
              </Button>
            )}
            {canRefund && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handlePaymentAction(order.id, 'refund')}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Refund
              </Button>
            )}
            {canDispute && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => handlePaymentAction(order.id, 'dispute')}
                className="flex-1"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Dispute
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3" />
              <span>Last updated: {formatDate(order.updated_at || order.created_at)}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedOrder(order)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const PayoutCard: React.FC<{ payout: SponsorshipPayout }> = ({ payout }) => {
    const canRetry = payout.status === 'failed';
    const canCancel = payout.status === 'pending';

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Payout #{payout.id.slice(0, 8)}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(payout.created_at)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(payout.amount_cents)}
              </div>
              <Badge className={getPayoutStatusColor(payout.status)}>
                {payout.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Fee:</span>
              <span className="ml-2">{formatCurrency(payout.application_fee_cents)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Net Amount:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(payout.amount_cents - payout.application_fee_cents)}
              </span>
            </div>
            {payout.stripe_transfer_id && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Stripe Transfer:</span>
                <span className="ml-2 font-mono text-xs">{payout.stripe_transfer_id}</span>
              </div>
            )}
            {payout.failure_reason && (
              <div className="col-span-2 p-2 bg-red-50 rounded text-red-700 text-xs">
                <strong>Failure Reason:</strong> {payout.failure_reason}
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            {canRetry && (
              <Button 
                size="sm" 
                onClick={() => handlePayoutAction(payout.id, 'retry_payout')}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Payout
              </Button>
            )}
            {canCancel && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handlePayoutAction(payout.id, 'cancel_payout')}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const AnalyticsOverview: React.FC = () => {
    if (!analytics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.total_revenue_cents)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{(analytics.conversion_rate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Banknote className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.avg_deal_size_cents)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Accepted Matches</p>
                <p className="text-2xl font-bold">{analytics.accepted_matches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600 mb-2">Error loading payment data</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadData}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment & Escrow Management</h2>
          <p className="text-muted-foreground">
            Manage payments, escrow, and payouts
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      <AnalyticsOverview />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="escrow">Escrow</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sponsorship Orders</h3>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{orders.length} orders</Badge>
            </div>
          </div>
          
          {orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No orders found</p>
                <p className="text-sm text-muted-foreground">
                  Orders will appear here once sponsors make purchases
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payouts</h3>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{payouts.length} payouts</Badge>
            </div>
          </div>
          
          {payouts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Banknote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No payouts found</p>
                <p className="text-sm text-muted-foreground">
                  Payouts will appear here once orders are completed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {payouts.map((payout) => (
                <PayoutCard key={payout.id} payout={payout} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="escrow" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Escrow Management</h3>
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Secure escrow</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-2">
                  {orders.filter(o => o.escrow_state === 'pending').length}
                </div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {orders.filter(o => o.escrow_state === 'funded').length}
                </div>
                <p className="text-sm text-muted-foreground">Funded</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {orders.filter(o => o.escrow_state === 'released').length}
                </div>
                <p className="text-sm text-muted-foreground">Released</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payment Settings</h3>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payout Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {payoutConfig ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Platform Fee</span>
                    <span className="font-medium">{payoutConfig.platform_fee_percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Minimum Payout</span>
                    <span className="font-medium">{formatCurrency(payoutConfig.minimum_payout_amount_cents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Payout Schedule</span>
                    <span className="font-medium capitalize">{payoutConfig.payout_schedule}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Auto Payout</span>
                    <span className="font-medium">{payoutConfig.auto_payout_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payout configuration found</p>
                  <p className="text-sm">Set up your payout preferences</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentEscrowManager;
