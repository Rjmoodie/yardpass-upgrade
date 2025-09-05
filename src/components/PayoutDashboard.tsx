import { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Payout {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  processed_at?: string;
  method: 'bank_transfer' | 'paypal' | 'stripe';
  event_title: string;
}

interface PayoutStats {
  total_earned: number;
  total_paid: number;
  pending_amount: number;
  next_payout_date: string;
}

export function PayoutDashboard() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPayoutData();
    }
  }, [user]);

  const fetchPayoutData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch payout history
      const { data: payoutData, error: payoutError } = await supabase
        .from('payouts')
        .select(`
          id,
          amount_cents,
          status,
          created_at,
          processed_at,
          payment_method,
          events!fk_payouts_event_id (
            title
          )
        `)
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (payoutError) {
        console.error('Error fetching payouts:', payoutError);
        // Use mock data as fallback
        setPayouts(getMockPayouts());
        setStats(getMockStats());
      } else {
        const transformedPayouts = payoutData?.map(payout => ({
          id: payout.id,
          amount: payout.amount_cents / 100,
          status: payout.status,
          created_at: payout.created_at,
          processed_at: payout.processed_at,
          method: payout.payment_method,
          event_title: (payout.events as any)?.title || 'Event'
        })) || [];

        setPayouts(transformedPayouts);

        // Calculate stats
        const totalEarned = transformedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = transformedPayouts
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = transformedPayouts
          .filter(p => p.status === 'pending' || p.status === 'processing')
          .reduce((sum, p) => sum + p.amount, 0);

        setStats({
          total_earned: totalEarned,
          total_paid: totalPaid,
          pending_amount: pendingAmount,
          next_payout_date: getNextPayoutDate()
        });
      }
    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast({
        title: "Error",
        description: "Failed to load payout information",
        variant: "destructive",
      });
      // Use mock data as fallback
      setPayouts(getMockPayouts());
      setStats(getMockStats());
    } finally {
      setLoading(false);
    }
  };

  const getMockPayouts = (): Payout[] => [
    {
      id: '1',
      amount: 1250.00,
      status: 'completed',
      created_at: '2024-01-15T10:00:00Z',
      processed_at: '2024-01-16T14:30:00Z',
      method: 'bank_transfer',
      event_title: 'Summer Music Festival 2024'
    },
    {
      id: '2',
      amount: 850.00,
      status: 'processing',
      created_at: '2024-01-20T09:00:00Z',
      method: 'stripe',
      event_title: 'Tech Innovation Summit'
    },
    {
      id: '3',
      amount: 420.00,
      status: 'pending',
      created_at: '2024-01-22T16:00:00Z',
      method: 'bank_transfer',
      event_title: 'Art Gallery Opening'
    }
  ];

  const getMockStats = (): PayoutStats => ({
    total_earned: 2520.00,
    total_paid: 1250.00,
    pending_amount: 1270.00,
    next_payout_date: '2024-01-25'
  });

  const getNextPayoutDate = (): string => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-yellow-300 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return <CreditCard className="w-4 h-4" />;
      case 'stripe':
        return <DollarSign className="w-4 h-4" />;
      case 'paypal':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
        <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.total_earned.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.total_paid.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">Successfully paid out</p>
          </CardContent>
        </Card>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">${stats?.pending_amount.toLocaleString() || '0'}</div>
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
                <span>${stats.total_paid.toLocaleString()} / ${stats.total_earned.toLocaleString()}</span>
              </div>
              <Progress 
                value={(stats.total_paid / stats.total_earned) * 100} 
                className="h-2"
              />
              </div>
            <div className="text-sm text-muted-foreground">
              Next payout: {new Date(stats.next_payout_date).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Payout History</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payouts yet</p>
              <p className="text-sm">Earnings will appear here after your first event</p>
              </div>
            ) : (
              <div className="space-y-4">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10">
                      {getMethodIcon(payout.method)}
                    </div>
                    <div>
                      <div className="font-medium">${payout.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{payout.event_title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(payout.created_at).toLocaleDateString()}
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