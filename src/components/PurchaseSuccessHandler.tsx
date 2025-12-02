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

  // ✅ Support both Checkout Session and Payment Intent
  const sessionId = searchParams.get('session_id') ?? '';
  const paymentIntentId = searchParams.get('payment_intent') ?? '';
  const eventId = searchParams.get('event_id') ?? searchParams.get('eventId') ?? '';
  
  // Use payment_intent if available, otherwise fall back to session_id
  const identifier = paymentIntentId || sessionId;
  const identifierType = paymentIntentId ? 'payment_intent' : 'session_id';
  
  const redirectPath = user ? '/tickets' : eventId ? `/e/${eventId}/tickets` : '/tickets';
  const successDescription = user
    ? 'Your tickets are ready! Redirecting...'
    : eventId
      ? 'Your tickets are ready! Redirecting to your event wallet...'
      : 'Your tickets are ready! Redirecting...';

  const [redirecting, setRedirecting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [ensureStatus, setEnsureStatus] = useState<string>('');
  
  const triedKey = `ensured:${identifier}`;
  const inFlightRef = useRef(false);
  const toastShownRef = useRef(false);

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
    if (!identifier || inFlightRef.current || localStorage.getItem(triedKey) === 'done') return;

    const tick = async () => {
      inFlightRef.current = true;

      try {
        // Tickets are created by the Stripe webhook → process-payment function
        // We just need to wait a moment and then refresh the wallet
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        inFlightRef.current = false;
        localStorage.setItem(triedKey, 'done');
        
        // Clear checkout session data
        localStorage.removeItem('checkoutSessionId');
        localStorage.removeItem('paymentIntentId');
        
        // If using Payment Intent, trigger process-payment manually (webhook may be delayed)
        // This is a best-effort call - the webhook handles it too, so 400 errors are expected if already processed
        if (identifierType === 'payment_intent') {
          try {
            await supabase.functions.invoke('process-payment', {
              body: { paymentIntentId: identifier },
            });
          } catch (processError) {
            // Expected if webhook already processed it - ignore silently
          }
        }
        
        await forceRefreshTickets();
        
        // Create notification instead of toast (only once to prevent duplicates)
        // Check if a similar notification already exists to prevent duplicates
        if (!toastShownRef.current && user) {
          toastShownRef.current = true;
          try {
            // Check for existing notification with same message in last 30 seconds
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', user.id)
              .eq('event_type', 'payment_completed')
              .eq('message', successDescription)
              .gte('created_at', new Date(Date.now() - 30000).toISOString())
              .limit(1)
              .single();

            // Only create if no duplicate exists
            if (!existing) {
              // Get user profile for notification display
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name, photo_url')
                .eq('user_id', user.id)
                .single();

              await supabase.from('notifications').insert({
                user_id: user.id,
                title: 'Payment Successful!',
                message: successDescription,
                type: 'success',
                event_type: 'payment_completed',
                action_url: redirectPath,
                data: {
                  user_name: profile?.display_name || 'You',
                  user_avatar: profile?.photo_url || '',
                  user_id: user.id,
                },
              });
            }
          } catch (notifError: any) {
            // If error is "not found" (no duplicate), that's fine - continue
            // Otherwise log and fallback to toast
            if (notifError?.code !== 'PGRST116') {
              console.error('Failed to create payment notification:', notifError);
              // Fallback to toast if notification creation fails
              toast({
                title: 'Payment Successful!',
                description: successDescription,
              });
            }
          }
        }
        
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
  }, [identifier, identifierType, attempts, toast, navigate, forceRefreshTickets, triedKey, supabase]);

  // Invalid session guard
  useEffect(() => {
    if (!identifier) {
      toast({
        title: 'Invalid Session',
        description: 'No session ID found. Redirecting to home...',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/', { replace: true }), 2000);
    }
  }, [identifier, toast, navigate]);

  // Loading state
  if (ensureStatus === 'pending' || ensureStatus === 'busy' || !ensureStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="space-y-6">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <img 
                  src="/liventix-icon-60.png" 
                  alt="Liventix" 
                  className="w-16 h-16 object-contain"
                  loading="eager"
                  decoding="sync"
                />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-gray-900">
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
                  <p className="text-sm text-brand-600 font-medium">
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
