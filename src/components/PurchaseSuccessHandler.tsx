import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { CheckCircle, Ticket } from 'lucide-react';
import { BrandedSpinner } from './BrandedSpinner';

export function PurchaseSuccessHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { forceRefreshTickets } = useTickets();
  const { user } = useAuth();
  const { update: updateGuestSession } = useGuestTicketSession();

  const sessionId = searchParams.get('session_id') ?? '';
  const eventId = searchParams.get('event_id') ?? searchParams.get('eventId') ?? '';
  const redirectPath = user ? '/tickets' : eventId ? `/e/${eventId}/tickets` : '/tickets';
  const successDescription = user
    ? 'Your tickets are ready! Redirecting...'
    : eventId
      ? 'Your tickets are ready! Redirecting to your event wallet...'
      : 'Your tickets are ready! Redirecting...';

  const [redirecting, setRedirecting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [ensureStatus, setEnsureStatus] = useState<string>('');
  
  const triedKey = `ensured:${sessionId}`;
  const inFlightRef = useRef(false);

  const backoffMs = (n: number) => Math.min(15000, 500 * Math.pow(1.5, n)); // 0.5s -> 15s

  useEffect(() => {
    if (!eventId) return;

    updateGuestSession((current) => {
      if (!current || current.scope?.all) return current;
      const existingIds = new Set(current.scope?.eventIds ?? []);
      if (existingIds.has(eventId)) return current;
      existingIds.add(eventId);
      return {
        ...current,
        scope: {
          ...(current.scope ?? {}),
          eventIds: Array.from(existingIds),
        },
      };
    });
  }, [eventId, updateGuestSession]);

  // Main polling logic with backoff
  useEffect(() => {
    if (!sessionId || inFlightRef.current || localStorage.getItem(triedKey) === 'done') return;

    const tick = async () => {
      inFlightRef.current = true;

      try {
        // Tickets are created by the Stripe webhook → process-payment function
        // We just need to wait a moment and then refresh the wallet
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        inFlightRef.current = false;
        localStorage.setItem(triedKey, 'done');
        await forceRefreshTickets();
        
        toast({
          title: 'Payment Successful!',
          description: successDescription,
        });
        
        setRedirecting(true);
        setTimeout(() => navigate(redirectPath, { replace: true }), 1500);
      } catch (e) {
        console.error('❌ Unexpected error in tick:', e);
        inFlightRef.current = false;
        // Retry with backoff on error
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
                <p className="text-muted-foreground">{successDescription}</p>
                
                {/* Animated redirect indicator */}
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <BrandedSpinner size="sm" />
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
          <BrandedSpinner size="xl" className="mx-auto mb-4" />
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
              onClick={() => navigate(redirectPath)}
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
