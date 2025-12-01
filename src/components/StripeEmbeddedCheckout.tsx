import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { Clock, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { supabase } from '@/integrations/supabase/client';

// ✅ Disable Stripe Assistant (developer tool) - proper way per Stripe docs
// https://docs.stripe.com/js/initializing#init_stripe_js-options-developerTools-assistant
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '', {
  developerTools: {
    assistant: { enabled: false }, // Disable the floating Stripe Assistant button
  },
} as Parameters<typeof loadStripe>[1]);

interface StripeEmbeddedCheckoutProps {
  checkoutSessionId: string;
  eventId: string;
  eventTitle: string;
  expiresAt: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripeEmbeddedCheckout({
  checkoutSessionId,
  eventId,
  eventTitle,
  expiresAt,
  onSuccess,
  onCancel,
}: StripeEmbeddedCheckoutProps) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable onComplete handler (not used due to redirect_on_completion: always)
  const handleComplete = useCallback(() => {
    console.log('✅ Embedded checkout completed');
    onSuccess();
  }, [onSuccess]);

  // Memoize options - appearance must be set server-side when creating checkout session
  // Note: Stripe Embedded Checkout does not support appearance parameter client-side
  const checkoutOptions = useMemo(() => {
    if (!clientSecret) return null;
    return { 
      clientSecret
    };
  }, [clientSecret]);

  // Fetch client secret from our backend
  useEffect(() => {
    const fetchClientSecret = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-embedded-checkout', {
          body: {
            checkoutSessionId,
            eventId,
          },
        });

        if (error) throw error;

        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('No client secret returned');
        }
      } catch (err) {
        console.error('Error fetching client secret:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize checkout');
      } finally {
        setLoading(false);
      }
    };

    fetchClientSecret();
  }, [checkoutSessionId, eventId]);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - currentTime;

    if (diff <= 0) {
      return null;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return {
      minutes,
      seconds,
      totalMs: diff,
      isExpiring: diff < 60000, // Less than 1 minute
      isUrgent: diff < 30000, // Less than 30 seconds
    };
  }, [expiresAt, currentTime]);

  // Handle expiration
  useEffect(() => {
    if (timeRemaining === null && !loading) {
      // Expired
      onCancel();
    }
  }, [timeRemaining, loading, onCancel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Checkout...</h2>
          <p className="text-sm text-muted-foreground">
            Preparing your secure payment form
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Checkout Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={onCancel} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Event
          </Button>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Timer Header */}
      <div 
        className={`sticky top-0 z-50 border-b backdrop-blur-md transition-all ${
          timeRemaining?.isUrgent 
            ? 'bg-destructive/95 border-destructive text-white' 
            : timeRemaining?.isExpiring
            ? 'bg-amber-500/95 border-amber-600 text-white'
            : 'bg-card/95 border-border'
        }`}
      >
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className={timeRemaining?.isExpiring ? 'text-white hover:bg-white/10' : ''}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>

            {/* Event Info + Timer */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold truncate max-w-xs">
                  {eventTitle}
                </p>
                <p className="text-xs opacity-80">
                  {timeRemaining?.isUrgent 
                    ? '⚠️ Complete now!' 
                    : 'Complete your purchase'}
                </p>
              </div>

              {timeRemaining && (
                <div className="flex items-center gap-2">
                  {timeRemaining.isExpiring ? (
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                  <div className={`flex items-center gap-1 px-4 py-2 rounded-lg font-mono text-xl font-bold ${
                    timeRemaining.isUrgent
                      ? 'bg-white/20 animate-pulse'
                      : 'bg-primary/10'
                  }`}>
                    <span>{timeRemaining.minutes}</span>
                    <span className="animate-pulse">:</span>
                    <span>{timeRemaining.seconds.toString().padStart(2, '0')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Checkout Form */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {checkoutOptions && (
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={checkoutOptions}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </div>

      {/* Timer Expiration Warning */}
      {timeRemaining?.isExpiring && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <Card className="border-destructive bg-destructive/10 p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-destructive mb-1">
                  {timeRemaining.isUrgent ? 'Checkout Expiring!' : 'Time Running Out'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {timeRemaining.isUrgent 
                    ? 'Complete your payment in the next 30 seconds to secure your tickets!' 
                    : 'Less than 1 minute remaining. Complete your payment now!'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default StripeEmbeddedCheckout;

