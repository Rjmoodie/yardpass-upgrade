import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrderStatus } from '@/hooks/useOrderStatus';
import { useTickets } from '@/hooks/useTickets';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Ticket, ArrowLeft } from 'lucide-react';

interface TicketSuccessPageProps {
  onBack: () => void;
  onViewTickets?: () => void;
}

export function TicketSuccessPage({ onBack, onViewTickets }: TicketSuccessPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshTickets } = useTickets();
  const [processing, setProcessing] = useState(false);

  // Get session ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  // Use order status hook to check payment status
  const { orderStatus, loading: statusLoading, refetch } = useOrderStatus(sessionId);

  // Process payment when order is found but not yet paid
  const processPayment = async () => {
    if (!sessionId || !user || processing) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: { sessionId }
      });

      if (error) throw error;

      // Refresh both order status and tickets list
      await Promise.all([
        refetch(),
        refreshTickets()
      ]);

      toast({
        title: "Payment Successful!",
        description: `${data.order.tickets_count} tickets issued for ${data.order.event_title}`,
      });
    } catch (error: any) {
      toast({
        title: "Payment Processing Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  // Auto-process payment if order is found but still pending
  React.useEffect(() => {
    if (orderStatus?.status === 'pending' && !processing) {
      processPayment();
    }
  }, [orderStatus?.status]);

  const loading = statusLoading || processing;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing your payment...</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Invalid Payment Session</h2>
            <p className="text-muted-foreground mb-4">
              No payment session found. Please try purchasing tickets again.
            </p>
            <Button onClick={onBack}>Return to Events</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
          <p className="text-muted-foreground">
            Your tickets have been issued and are ready to use
          </p>
        </CardHeader>

        {orderStatus && orderStatus.status === 'paid' && (
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Event:</span>
                    <span className="font-medium">{orderStatus.event_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tickets:</span>
                    <span className="font-medium">{orderStatus.tickets_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Paid:</span>
                    <span className="font-bold text-lg">${orderStatus.total_amount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What's Next */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  What's Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Check your email</p>
                    <p className="text-xs text-muted-foreground">
                      Confirmation and ticket details sent to your email
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Add to Wallet</p>
                    <p className="text-xs text-muted-foreground">
                      Digital tickets ready for Apple Wallet / Google Pay
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Event Day</p>
                    <p className="text-xs text-muted-foreground">
                      Show your QR code at the event entrance
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
              <Button 
                onClick={onViewTickets || (() => window.location.href = '/tickets')} 
                className="flex-1"
              >
                <Ticket className="w-4 h-4 mr-2" />
                View My Tickets
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default TicketSuccessPage;