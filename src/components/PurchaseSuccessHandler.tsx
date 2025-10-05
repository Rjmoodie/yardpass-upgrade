import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { CheckCircle, Ticket, Loader2 } from 'lucide-react';

export function PurchaseSuccessHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { forceRefreshTickets } = useTickets();
  
  const sessionId = searchParams.get('session_id') ?? '';
  
  const [redirecting, setRedirecting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [ensureStatus, setEnsureStatus] = useState<string>('');
  
  const triedKey = `ensured:${sessionId}`;
  const inFlightRef = useRef(false);

  const backoffMs = (n: number) => Math.min(15000, 500 * Math.pow(1.5, n)); // 0.5s -> 15s

  // Main polling logic with backoff
  useEffect(() => {
    if (!sessionId || inFlightRef.current || localStorage.getItem(triedKey) === 'done') return;

    const tick = async () => {
      inFlightRef.current = true;

      try {
        const { data: ensure, error } = await supabase.functions.invoke('ensure-tickets', {
          body: { session_id: sessionId },
        });

        inFlightRef.current = false;

        if (error) {
          console.error('❌ ensure-tickets network error:', error);
          // Check if it's a 404 (function not deployed)
          const status = (error as any)?.context?.status ?? (error as any)?.status;
          if (status === 404) {
            // Function not found → fallback: refresh wallet and redirect
            try { await forceRefreshTickets(); } catch {}
            toast({
              title: 'Checking your wallet',
              description: "Finalizing in the background. If you don't see new tickets, try again shortly.",
            });
            setRedirecting(true);
            setTimeout(() => navigate('/tickets', { replace: true }), 1500);
            return;
          }
          // Other transient errors → retry with backoff
          if (attempts < 8) {
            setTimeout(() => setAttempts(a => a + 1), backoffMs(attempts));
          }
          return;
        }

        console.log('✅ ensure-tickets status:', ensure?.status);
        setEnsureStatus(ensure?.status || '');

        switch (ensure?.status) {
          case 'already_issued':
          case 'issued':
            localStorage.setItem(triedKey, 'done');
            await forceRefreshTickets();
            toast({
              title: 'Payment Successful!',
              description: 'Your tickets are ready! Redirecting...',
            });
            setRedirecting(true);
            setTimeout(() => navigate('/tickets', { replace: true }), 2000);
            return;

          case 'pending':
          case 'busy':
            // Retry with backoff
            if (attempts < 20) {
              setTimeout(() => setAttempts(a => a + 1), backoffMs(attempts));
            } else {
              toast({
                title: 'Payment Processing',
                description: 'Your payment is still processing. Check your tickets shortly.',
              });
              setTimeout(() => navigate('/tickets', { replace: true }), 2000);
            }
            return;

          case 'capacity_error':
            localStorage.setItem(triedKey, 'done');
            toast({
              title: 'Event at Capacity',
              description: ensure?.message || 'This tier is sold out.',
              variant: 'destructive',
            });
            setTimeout(() => navigate('/', { replace: true }), 3000);
            return;

          default:
            // Unknown status; retry a few times then give up
            if (attempts < 8) {
              setTimeout(() => setAttempts(a => a + 1), backoffMs(attempts));
            } else {
              toast({
                title: 'Ticket Issuance Delayed',
                description: "We'll email your tickets shortly.",
              });
              setTimeout(() => navigate('/tickets', { replace: true }), 2000);
            }
        }
      } catch (e) {
        console.error('❌ Unexpected error in tick:', e);
        inFlightRef.current = false;
        if (attempts < 8) {
          setTimeout(() => setAttempts(a => a + 1), backoffMs(attempts));
        }
      }
    };

    tick();
  }, [sessionId, attempts, toast, navigate, forceRefreshTickets, triedKey]);

  // Invalid session guard
  useEffect(() => {
    if (!sessionId) {
      toast({
        title: 'Invalid Session',
        description: 'No session ID found. Redirecting to home...',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/', { replace: true }), 2000);
    }
  }, [sessionId, toast, navigate]);

  // Loading state
  if (ensureStatus === 'pending' || ensureStatus === 'busy' || !ensureStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto shadow-lg animate-pulse">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  {ensureStatus === 'pending' ? 'Processing Payment' : 'Finalizing Tickets'}
                </h2>
                <p className="text-muted-foreground">
                  {ensureStatus === 'pending' 
                    ? 'Please wait while we confirm your payment...'
                    : 'Your tickets are being prepared...'}
                </p>
                
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                
                {attempts > 3 && (
                  <p className="text-sm text-orange-600 font-medium">
                    Taking longer than expected, please wait...
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
  // Fallback manual options
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
          <p className="text-muted-foreground mb-4">
            Please wait while we confirm your payment...
          </p>
          {attempts > 5 && (
            <p className="text-sm text-muted-foreground mb-4">
              Still processing, please wait...
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
