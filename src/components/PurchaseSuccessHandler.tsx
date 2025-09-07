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
  const { orderStatus, loading: statusLoading, refetch, error: orderError } = useOrderStatus(sessionId);
  
  const [redirecting, setRedirecting] = useState(false);
  const [ticketsRefreshed, setTicketsRefreshed] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

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

  // Handle timeout and retry logic
  useEffect(() => {
    if (!sessionId) {
      toast({
        title: 'Invalid Session',
        description: 'No session ID found. Redirecting to home...',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/', { replace: true }), 2000);
      return;
    }

    // Set a timeout for order status checking
    const timeoutId = setTimeout(() => {
      if (!orderStatus && !statusLoading) {
        console.log('⏰ Timeout reached, attempting retry...');
        setTimeoutReached(true);
        
        if (retryCount < 3) {
          setRetryCount(prev => prev + 1);
          refetch();
        } else {
          // After 3 retries, assume payment was successful and redirect
          console.log('🔄 Max retries reached, assuming payment successful...');
          toast({
            title: 'Payment Processing',
            description: 'Your payment is being processed. You can check your tickets in the tickets section.',
            variant: 'default',
          });
          setTimeout(() => navigate('/tickets', { replace: true }), 2000);
        }
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [sessionId, orderStatus, statusLoading, retryCount, refetch, toast, navigate]);

  // Handle order error
  useEffect(() => {
    if (orderError && !statusLoading) {
      console.error('❌ Order status error:', orderError);
      toast({
        title: 'Payment Status Error',
        description: 'Unable to verify payment status. Your payment may still be processing.',
        variant: 'destructive',
      });
      
      // Still redirect to tickets page after error
      setTimeout(() => navigate('/tickets', { replace: true }), 3000);
    }
  }, [orderError, statusLoading, toast, navigate]);

  // Handle loading state
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground mb-2">
              Please wait while we confirm your payment...
            </p>
            {retryCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Retry attempt {retryCount} of 3
              </p>
            )}
            {timeoutReached && (
              <p className="text-sm text-orange-600">
                Taking longer than expected, retrying...
              </p>
            )}
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

  // Default loading state with manual redirect option
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
          <p className="text-muted-foreground mb-4">
            Please wait while we confirm your payment...
          </p>
          {retryCount > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              Retry attempt {retryCount} of 3
            </p>
          )}
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/tickets')} 
              variant="outline" 
              className="w-full"
            >
              <Ticket className="w-4 h-4 mr-2" />
              Go to My Tickets
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="ghost" 
              className="w-full"
            >
              Return Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
