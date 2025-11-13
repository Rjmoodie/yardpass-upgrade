import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCcw, 
  Search, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  AlertCircle
} from 'lucide-react';

interface Order {
  id: string;
  event_id: string;
  user_id: string;
  total_cents: number;
  status: string;
  created_at: string;
  contact_email: string;
  contact_name: string;
  event_title: string;
  event_start: string;
  ticket_count: number;
  redeemed_count: number;
}

interface RefundRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  details: string;
  status: string;
  requested_at: string;
  reviewed_at: string;
  organizer_response: string;
  total_cents: number;
  contact_email: string;
  event_title: string;
  event_start: string;
  requester_name: string;
}

interface RefundLog {
  id: string;
  order_id: string;
  refund_amount_cents: number;
  refund_type: string;
  reason: string;
  tickets_refunded: number;
  processed_at: string;
  contact_email: string;
  event_title: string;
  initiated_by_name: string;
}

export function OrganizerRefundsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'orders' | 'requests' | 'history'>('requests');
  const [orders, setOrders] = useState<Order[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [refundHistory, setRefundHistory] = useState<RefundLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [myEvents, setMyEvents] = useState<Array<{id: string; title: string}>>([]);
  
  // Modals
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'decline'>('approve');
  const [reviewResponse, setReviewResponse] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch organizer's events
  useEffect(() => {
    fetchMyEvents();
  }, [user?.id]);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    else if (activeTab === 'requests') fetchRefundRequests();
    else if (activeTab === 'history') fetchRefundHistory();
  }, [activeTab, user?.id]);

  const fetchMyEvents = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .or(`created_by.eq.${user.id}`)
        .order('title');

      setMyEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchOrders = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Get all orders for organizer's events
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          events!orders_event_id_fkey(title, start_at)
        `)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map and enrich with ticket counts
      const enrichedOrders: Order[] = await Promise.all(
        (data || []).map(async (order: any) => {
          const { count: ticketCount } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          const { count: redeemedCount } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id)
            .eq('status', 'redeemed');

          return {
            ...order,
            event_title: order.events?.title,
            event_start: order.events?.start_at,
            ticket_count: ticketCount || 0,
            redeemed_count: redeemedCount || 0
          };
        })
      );

      setOrders(enrichedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error loading orders',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRefundRequests = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setRefundRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching refund requests:', error);
      toast({
        title: 'Error loading requests',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRefundHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('refund_log')
        .select('*')
        .order('processed_at', { ascending: false });

      if (error) throw error;

      setRefundHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching refund history:', error);
      toast({
        title: 'Error loading history',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDirectRefund = async () => {
    if (!selectedOrder) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: {
          order_id: selectedOrder.id,
          reason: refundReason || 'Organizer initiated refund'
        }
      });

      if (error) throw error;

      toast({
        title: 'Refund Processed',
        description: `Refund of $${data.refund?.amount || (selectedOrder.total_cents / 100).toFixed(2)} processed successfully.`
      });

      setRefundModalOpen(false);
      setSelectedOrder(null);
      setRefundReason('');
      await fetchOrders();
      await fetchRefundHistory();
    } catch (error: any) {
      toast({
        title: 'Refund Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewRequest = async (action: 'approve' | 'decline') => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('review-refund-request', {
        body: {
          request_id: selectedRequest.id,
          action,
          organizer_response: reviewResponse || undefined
        }
      });

      if (error) throw error;

      toast({
        title: action === 'approve' ? 'Refund Approved' : 'Request Declined',
        description: action === 'approve'
          ? `Refund of $${data.refund?.amount || (selectedRequest.total_cents / 100).toFixed(2)} processed.`
          : 'Customer has been notified.'
      });

      setReviewModalOpen(false);
      setSelectedRequest(null);
      setReviewResponse('');
      await fetchRefundRequests();
      await fetchRefundHistory();
    } catch (error: any) {
      toast({
        title: 'Review Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const pendingCount = refundRequests.length;

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Refunds & Orders</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage refund requests and order history</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="requests" className="relative text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-2.5 flex-col sm:flex-row gap-1">
            <span className="whitespace-nowrap">Pending</span>
            <span className="hidden sm:inline"> Requests</span>
            {pendingCount > 0 && (
              <Badge variant="danger" className="ml-0 sm:ml-2 text-[10px] sm:text-xs px-1 sm:px-2 py-0 sm:py-0.5">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-2.5">
            <span className="whitespace-nowrap">All Orders</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-2.5 flex-col sm:flex-row">
            <span className="whitespace-nowrap">Refund</span>
            <span className="hidden sm:inline"> History</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Pending Refund Requests */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Refund Requests</CardTitle>
              <CardDescription>
                Review and approve or decline customer refund requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
              ) : refundRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-semibold">No pending requests</p>
                  <p className="text-sm text-muted-foreground">All refund requests have been reviewed</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="text-sm">
                          {formatDate(req.requested_at)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{req.requester_name || 'Customer'}</div>
                            <div className="text-xs text-muted-foreground">{req.contact_email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{req.event_title}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(req.total_cents)}</TableCell>
                        <TableCell>
                          <Badge variant="neutral">
                            {req.reason.replace('_', ' ')}
                          </Badge>
                          {req.details && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {req.details}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setReviewAction('approve');
                              setReviewModalOpen(true);
                            }}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: All Orders */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>
                View and manage orders for your events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search by email or order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {myEvents.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Orders Table */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold">No orders yet</p>
                  <p className="text-sm text-muted-foreground">Orders for your events will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders
                      .filter(order => {
                        if (selectedEvent !== 'all' && order.event_id !== selectedEvent) return false;
                        if (searchQuery && !order.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) && !order.id.includes(searchQuery)) return false;
                        return true;
                      })
                      .slice(0, 50)
                      .map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="text-sm">
                            {formatDate(order.created_at)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.contact_name || 'Customer'}</div>
                              <div className="text-xs text-muted-foreground">{order.contact_email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{order.event_title}</TableCell>
                          <TableCell>
                            <Badge variant={order.redeemed_count > 0 ? "danger" : "neutral"}>
                              {order.ticket_count} ticket{order.ticket_count !== 1 ? 's' : ''}
                              {order.redeemed_count > 0 && ` (${order.redeemed_count} used)`}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(order.total_cents)}</TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'paid' ? 'success' : 'neutral'}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedOrder(order);
                                setRefundModalOpen(true);
                              }}
                              disabled={order.status === 'refunded' || order.redeemed_count > 0}
                            >
                              Refund
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Refund History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Refund History</CardTitle>
              <CardDescription>
                Complete audit trail of all processed refunds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
              ) : refundHistory.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold">No refunds yet</p>
                  <p className="text-sm text-muted-foreground">Processed refunds will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Initiated By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundHistory.map(refund => (
                      <TableRow key={refund.id}>
                        <TableCell className="text-sm">
                          {formatDate(refund.processed_at)}
                        </TableCell>
                        <TableCell className="text-sm">{refund.contact_email}</TableCell>
                        <TableCell className="font-medium">{refund.event_title}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(refund.refund_amount_cents)}
                        </TableCell>
                        <TableCell>{refund.tickets_refunded}</TableCell>
                        <TableCell>
                          <Badge variant={
                            refund.refund_type === 'admin' ? 'brand' :
                            refund.refund_type === 'organizer' ? 'success' :
                            'neutral'
                          }>
                            {refund.refund_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {refund.initiated_by_name || 'System'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Direct Refund Modal */}
      <Dialog open={refundModalOpen} onOpenChange={setRefundModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund</DialogTitle>
            <DialogDescription>
              Process a refund for this order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{selectedOrder.contact_email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium">{selectedOrder.event_title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tickets</span>
                  <span>{selectedOrder.ticket_count}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Refund Amount</span>
                  <span className="text-lg">{formatCurrency(selectedOrder.total_cents)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  placeholder="Why are you issuing this refund?"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                />
              </div>

              {selectedOrder.redeemed_count > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">
                    ⚠️ {selectedOrder.redeemed_count} ticket{selectedOrder.redeemed_count !== 1 ? 's have' : ' has'} been redeemed. 
                    These cannot be refunded.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModalOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button 
              onClick={handleDirectRefund} 
              disabled={processing || (selectedOrder?.redeemed_count || 0) > 0}
            >
              {processing ? 'Processing...' : 'Process Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Request Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Refund Request</DialogTitle>
            <DialogDescription>
              Approve or decline this customer's refund request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{selectedRequest.contact_email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium">{selectedRequest.event_title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Requested</span>
                  <span>{formatDate(selectedRequest.requested_at)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Refund Amount</span>
                  <span className="text-lg">{formatCurrency(selectedRequest.total_cents)}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-1">Customer's Reason:</p>
                <p className="text-sm text-blue-800">{selectedRequest.reason.replace('_', ' ')}</p>
                {selectedRequest.details && (
                  <p className="text-sm text-blue-700 mt-2 italic">"{selectedRequest.details}"</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant={reviewAction === 'approve' ? 'default' : 'outline'}
                  onClick={() => setReviewAction('approve')}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant={reviewAction === 'decline' ? 'destructive' : 'outline'}
                  onClick={() => setReviewAction('decline')}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {reviewAction === 'approve' ? 'Message to customer (optional)' : 'Reason for declining'}
                </label>
                <Textarea
                  placeholder={reviewAction === 'approve' 
                    ? "Add a message for the customer..." 
                    : "Explain why you're declining this request..."
                  }
                  value={reviewResponse}
                  onChange={(e) => setReviewResponse(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModalOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleReviewRequest(reviewAction)}
              disabled={processing}
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
            >
              {processing ? 'Processing...' : reviewAction === 'approve' ? 'Approve & Refund' : 'Decline Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

