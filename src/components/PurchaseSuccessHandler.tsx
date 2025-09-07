import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTickets } from '@/hooks/useTickets';
import { useOrderStatus } from '@/hooks/useOrderStatus';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CheckCircle, Ticket, ArrowRight, Loader2 } from 'lucide-react';

export function PurchaseSuccessHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { forceRefreshTickets } = useTickets();
  
  const sessionId = searchParams.get('session_id');
  const { orderStatus, loading: statusLoading, refetch } = useOrderStatus(sessionId);
  
  const [redirecting, setRedirecting] = useState(false);
  const [ticketsRefreshed, setTicketsRefreshed] = useState(false);

  // Handle successful payment
  useEffect(() => {
    if (orderStatus?.status === 'paid' && !ticketsRefreshed) {
      console.log('🎫 Payment successful, refreshing tickets...');
      
      const refreshAndRedirect = async () => {
        try {
          // Force refresh tickets to ensure they're visible
          await forceRefreshTickets();
          setTicketsRefreshed(true);
          
          toast({
            title: 'Payment Successful!',
            description: 'Your tickets are ready! Redirecting to your ticket wallet...',
          });
          
          // Redirect to tickets page after a short delay
          setRedirecting(true);
          setTimeout(() => {
            navigate('/tickets', { replace: true });
          }, 2000);
          
        } catch (error) {
          console.error('Error refreshing tickets:', error);
          toast({
            title: 'Tickets Ready',
            description: 'Your payment was successful! You can view your tickets in the tickets section.',
            variant: 'default',
          });
          
          // Still redirect even if refresh failed
          setRedirecting(true);
          setTimeout(() => {
            navigate('/tickets', { replace: true });
          }, 2000);
        }
      };
      
      refreshAndRedirect();
    }
  }, [orderStatus?.status, ticketsRefreshed, forceRefreshTickets, toast, navigate]);

  // Handle loading state
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle redirecting state
  if (redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Your tickets are ready! Redirecting to your ticket wallet...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecting...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle error states
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Invalid Session</h2>
            <p className="text-muted-foreground mb-4">
              No payment session found. Please try your purchase again.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orderStatus?.status === 'failed' || orderStatus?.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Failed</h2>
            <p className="text-muted-foreground mb-4">
              Your payment could not be processed. Please try again.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default loading state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
          <p className="text-muted-foreground">
            Please wait while we confirm your payment...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
