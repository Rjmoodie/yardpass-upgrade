import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  DollarSign,
  CreditCard,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';
import { PayoutManager } from './PayoutManager';

type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
type PayoutMethod = 'bank_transfer' | 'paypal' | 'stripe';

interface Payout {
  id: string;
  amount: number; // dollars
  status: PayoutStatus;
  created_at: string;
  processed_at?: string;
  method: PayoutMethod;
  event_title: string;
}

interface PayoutStats {
  total_earned: number;
  total_paid: number;
  pending_amount: number;
  next_payout_date: string;
}

const formatUSD = (n?: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);

const safePercent = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

interface PayoutDashboardProps {
  contextType?: 'individual' | 'organization';
  contextId?: string;
}

export function PayoutDashboard({ contextType = 'individual', contextId }: PayoutDashboardProps) {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | PayoutStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const effectiveContextId = contextId || user?.id || '';
  const {
    account,
    balance,
    isFullySetup
  } = useStripeConnect(contextType, effectiveContextId);

  useEffect(() => {
    if (user?.id) fetchPayoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchPayoutData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Use real balance data when available
      if (balance) {
        setStats({
          total_earned: balance.available + balance.pending,
          total_paid: 0, // Would need historical data
          pending_amount: balance.pending,
          next_payout_date: getNextPayoutDate()
        });
      } else {
        // Fallback to mock data for demo
        const mockStats = getMockStats();
        setStats(mockStats);
      }

      // TODO: Replace with real payout history from Stripe webhooks
      const mockPayouts = getMockPayouts().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPayouts(mockPayouts);

    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payout information',
        variant: 'destructive'
      });
      setPayouts(getMockPayouts());
      setStats(getMockStats());
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPayoutData();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    if (statusFilter === 'all') return payouts;
    return payouts.filter(p => p.status === statusFilter);
  }, [payouts, statusFilter]);

  const exportCSV = useCallback(async () => {
    try {
      const rows = [
        ['ID', 'Status', 'Method', 'Amount(USD)', 'Event', 'Created At', 'Processed At'],
        ...payouts.map(p => [
          p.id,
          p.status,
          p.method,
          p.amount.toFixed(2),
          p.event_title,
          new Date(p.created_at).toISOString(),
          p.processed_at ? new Date(p.processed_at).toISOString() : ''
        ])
      ];
      const csv = rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const filename = `payouts_${new Date().toISOString().slice(0, 10)}.csv`;

      // Prefer native share if possible
      if (navigator?.canShare && 'share' in navigator) {
        const file = new File([blob], filename, { type: 'text/csv' });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({ title: 'Payout Export', files: [file] });
          toast({ title: 'Export shared' });
          return;
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Export failed', description: 'Could not generate CSV file.', variant: 'destructive' });
    }
  }, [payouts, toast]);

  const getStatusBadge = (status: PayoutStatus) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="border-yellow-300 text-yellow-700">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: PayoutMethod) => {
    switch (method) {
      case 'bank_transfer':
        return <CreditCard className="w-4 h-4" />;
      case 'stripe':
      case 'paypal':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="animate-pulse h-3 bg-muted rounded w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-5 bg-muted rounded w-32" />
          </CardHeader>
          <CardContent>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg mb-3">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-32" />
                    <div className="h-3 bg-muted rounded w-24" />
                  </div>
                </div>
                <div className="h-5 bg-muted rounded w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stripe Connect Setup */}
      {!isFullySetup && (
        <StripeConnectOnboarding
          contextType={contextType}
          contextId={effectiveContextId}
        />
      )}

      {/* Payout Manager */}
      {isFullySetup && (
        <PayoutManager
          contextType={contextType}
          contextId={effectiveContextId}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {balance ? formatUSD(balance.available / 100) : formatUSD(stats?.total_earned)}
            </div>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {balance ? formatUSD(balance.pending / 100) : formatUSD(stats?.total_paid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {balance ? "Pending payout" : "Successfully paid out"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUSD(stats?.pending_amount)}</div>
            <p className="text-xs text-muted-foreground">Awaiting payout</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Progress */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Payout Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Paid out</span>
                <span>
                  {formatUSD(stats.total_paid)} / {formatUSD(stats.total_earned)}
                </span>
              </div>
              <Progress value={safePercent(stats.total_paid, stats.total_earned)} className="h-2" />
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Next payout: {new Date(stats.next_payout_date).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History + Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle>Payout History</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" /> All statuses
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPayouts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payouts {statusFilter !== 'all' ? `(${statusFilter}) ` : ''}yet</p>
              <p className="text-sm">Earnings will appear here after your first event</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10">{getMethodIcon(payout.method)}</div>
                    <div>
                      <div className="font-medium">{formatUSD(payout.amount)}</div>
                      <div className="text-sm text-muted-foreground">{payout.event_title}</div>
                      <div className="text-xs text-muted-foreground">
                        Requested {new Date(payout.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(payout.status)}
                    {payout.processed_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Processed {new Date(payout.processed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Mocks ------------------------------- */
const getMockPayouts = (): Payout[] => [
  {
    id: '1',
    amount: 1250.0,
    status: 'completed',
    created_at: '2024-01-15T10:00:00Z',
    processed_at: '2024-01-16T14:30:00Z',
    method: 'bank_transfer',
    event_title: 'Summer Music Festival 2024'
  },
  {
    id: '2',
    amount: 850.0,
    status: 'processing',
    created_at: '2024-01-20T09:00:00Z',
    method: 'stripe',
    event_title: 'Tech Innovation Summit'
  },
  {
    id: '3',
    amount: 420.0,
    status: 'pending',
    created_at: '2024-01-22T16:00:00Z',
    method: 'bank_transfer',
    event_title: 'Art Gallery Opening'
  }
];

const getMockStats = (): PayoutStats => ({
  total_earned: 2520.0,
  total_paid: 1250.0,
  pending_amount: 1270.0,
  next_payout_date: getNextPayoutDate()
});

function getNextPayoutDate(): string {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().split('T')[0];
}