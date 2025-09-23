import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SponsorCheckoutButtonProps {
  packageId: string;
  sponsorId: string;
  onSuccess?: () => void;
}

export function SponsorCheckoutButton({
  packageId,
  sponsorId,
  onSuccess
}: SponsorCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);

      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to sponsor this package.',
          variant: 'destructive'
        });
        return;
      }

      // Create payment intent
      const { data, error } = await supabase.functions.invoke('sponsor-create-intent', {
        body: { packageId, sponsorId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw new Error(error.message);
      }

      if (!data?.clientSecret) {
        throw new Error('No client secret received');
      }

      // Load Stripe.js dynamically
      const stripeScript = document.createElement('script');
      stripeScript.src = 'https://js.stripe.com/v3/';
      document.head.appendChild(stripeScript);

      stripeScript.onload = async () => {
        // @ts-ignore - Stripe is loaded globally
        const stripe = window.Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }

        const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: {
            card: {
              // This will trigger the Stripe payment form
            }
          }
        });

        if (confirmError) {
          console.error('Payment confirmation error:', confirmError);
          toast({
            title: 'Payment Failed',
            description: confirmError.message,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Payment Successful',
            description: 'Your sponsorship payment has been processed. Funds are held in escrow until the event completes.',
          });
          onSuccess?.();
        }
      };

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCheckout} 
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Processing...' : 'Sponsor This Package'}
    </Button>
  );
}