import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTickets } from '@/hooks/useTickets';
import { useOrderStatus } from '@/hooks/useOrderStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  const [processing, setProcessing] = useState(false);
  const [hasProcessedPayment, setHasProcessedPayment] = useState(false);

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
  }, [orderStatus?.status, ticketsRefreshed, toast, navigate]); // Removed forceRefreshTickets from deps

  // Handle timeout and retry logic - also process payment for pending orders
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

    // If order status is pending and not already processing, try to process the payment
    if (orderStatus?.status === 'pending' && !processing && !statusLoading && !hasProcessedPayment) {
      console.log('🔄 Order is pending, attempting to process payment...');
      processPayment();
      return; // Don't set timeout if we're processing payment
    }
    
    // If we have a successful order, don't start any timeouts
    if (orderStatus?.status === 'paid') {
      return;
    }
    
    // If we have an order error, don't keep retrying
    if (orderError) {
      return;
    }
    
    // If order status loading has been too long, try processing payment (only once)
    if (!orderStatus && statusLoading && !processing && retryCount === 0 && !hasProcessedPayment) {
      console.log('🔄 Order status taking too long, attempting to process payment...');
      processPayment();
      return;
    }

    // Set a timeout for order status checking (only if not already processing)
    if (!processing && retryCount < 3) {
      const timeoutId = setTimeout(() => {
        if (!orderStatus && !statusLoading && !processing) {
          console.log('⏰ Timeout reached, attempting retry...');
          setTimeoutReached(true);
          setRetryCount(prev => prev + 1);
          refetch();
        }
      }, 8000); // 8 second timeout

      return () => clearTimeout(timeoutId);
    } else if (retryCount >= 3 && !orderStatus) {
      // After 3 retries, assume payment was successful and redirect
      console.log('🔄 Max retries reached, assuming payment successful...');
      toast({
        title: 'Payment Processing',
        description: 'Your payment is being processed. You can check your tickets in the tickets section.',
        variant: 'default',
      });
      setTimeout(() => navigate('/tickets', { replace: true }), 2000);
    }
  }, [sessionId, orderStatus, statusLoading, retryCount, processing, orderError, refetch, toast, navigate]);

  const processPayment = async () => {
    if (!sessionId || processing || hasProcessedPayment) return;
    
    setProcessing(true);
    setHasProcessedPayment(true); // Prevent multiple payment processing attempts
    
    try {
      console.log('💳 Processing payment for session:', sessionId);
      
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: { sessionId }  // Keep original parameter name
      });
      
      if (error) {
        console.error('❌ Payment processing error:', error);
        throw error;
      }
      
      console.log('✅ Payment processed successfully:', data);
      
      // Refresh order status after processing
      setTimeout(() => {
        refetch();
      }, 1000); // Give a small delay for database to update
      
    } catch (error) {
      console.error('❌ Failed to process payment:', error);
      setHasProcessedPayment(false); // Allow retry on error
      toast({
        title: 'Payment Processing Error',
        description: 'There was an issue processing your payment. Please contact support if this persists.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

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
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="space-y-6">
              {/* Animated payment icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto shadow-lg animate-pulse">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-gray-900">Processing Payment</h2>
                <p className="text-muted-foreground">
                  Please wait while we confirm your payment...
                </p>
                
                {/* Progress indicators */}
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                
                {retryCount > 0 && (
                  <p className="text-sm text-orange-600 font-medium">
                    Retry attempt {retryCount} of 3
                  </p>
                )}
                {timeoutReached && (
                  <p className="text-sm text-orange-600 font-medium">
                    Taking longer than expected, retrying...
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle redirecting state
  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="space-y-6">
              {/* Success animation */}
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg animate-pulse">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-gray-900">Payment Successful!</h2>
                <p className="text-muted-foreground">
                  Your tickets are ready! Redirecting to your ticket wallet...
                </p>
                
                {/* Animated redirect indicator */}
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="font-medium">Redirecting...</span>
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
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
