import { useState } from "react";
import { DollarSign, Calendar, MapPin, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SponsorshipPackage } from "@/hooks/useMarketplaceSponsorships";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SponsorshipCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package: SponsorshipPackage;
  sponsorId: string;
  onSuccess: () => void;
}

export function SponsorshipCheckoutModal({
  open,
  onOpenChange,
  package: pkg,
  sponsorId,
  onSuccess
}: SponsorshipCheckoutModalProps) {
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStripeCheckout = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to complete the sponsorship purchase.',
          variant: 'destructive'
        });
        return;
      }

      // Create payment intent
      const { data, error } = await supabase.functions.invoke('sponsor-create-intent', {
        body: { 
          packageId: pkg.id, 
          sponsorId: sponsorId 
        },
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
          setStep('success');
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

  const renderDetails = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{pkg.event_title}</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {pkg.event_start_at ? new Date(pkg.event_start_at).toLocaleDateString() : 'TBD'}
            </div>
            {pkg.event_city && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {pkg.event_city}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{pkg.title} Sponsorship</Badge>
            <div className="flex items-center gap-1 text-lg font-semibold">
              <DollarSign className="h-5 w-5" />
              {(pkg.price_cents / 100).toLocaleString()}
            </div>
          </div>

          {pkg.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{pkg.description}</p>
            </div>
          )}

          {pkg.benefits && Array.isArray(pkg.benefits) && pkg.benefits.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Package Benefits</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                {pkg.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>{String(benefit)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              Additional Notes (Optional)
            </label>
            <Textarea
              placeholder="Any special requests or questions about the sponsorship..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
          Cancel
        </Button>
        <Button onClick={() => setStep('payment')} className="flex-1">
          Continue to Payment
        </Button>
      </div>
    </div>
  );

  const renderPayment = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span>{pkg.title} Sponsorship</span>
            <span>${(pkg.price_cents / 100).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Platform Fee (10%)</span>
            <span>${((pkg.price_cents * 0.1) / 100).toLocaleString()}</span>
          </div>
          <hr />
          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span>${(pkg.price_cents / 100).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-1">Escrow Protection</h4>
        <p className="text-sm text-blue-700">
          Your payment will be held in escrow until the event organizer fulfills the sponsorship benefits. 
          This protects your investment and ensures delivery.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep('details')} className="flex-1">
          Back
        </Button>
        <Button onClick={handleStripeCheckout} disabled={loading} className="flex-1">
          {loading ? "Processing..." : "Pay Now"}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <CheckCircle className="h-16 w-16 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
        <p className="text-muted-foreground">
          Your sponsorship payment has been processed and is now held in escrow. 
          You'll receive email confirmations and updates as the event approaches.
        </p>
      </div>
      <Button onClick={onSuccess} className="w-full">
        View My Sponsorships
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'details' && 'Sponsorship Details'}
            {step === 'payment' && 'Review & Pay'}
            {step === 'success' && 'Payment Successful'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'details' && renderDetails()}
        {step === 'payment' && renderPayment()}
        {step === 'success' && renderSuccess()}
      </DialogContent>
    </Dialog>
  );
}