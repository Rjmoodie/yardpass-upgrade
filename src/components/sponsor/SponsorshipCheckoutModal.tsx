import { useState } from "react";
import { DollarSign, Calendar, MapPin, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketplaceSponsorship } from "@/types/sponsors";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SponsorshipCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package: MarketplaceSponsorship;
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

  const handleSubmitOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sponsorship_orders')
        .insert({
          package_id: pkg.package_id,
          sponsor_id: sponsorId,
          event_id: pkg.event_id,
          amount_cents: pkg.price_cents,
          notes: notes || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Order Submitted",
        description: "Your sponsorship request has been submitted for review.",
      });

      setStep('success');
    } catch (error) {
      console.error('Error creating sponsorship order:', error);
      toast({
        title: "Error",
        description: "Failed to submit sponsorship request. Please try again.",
        variant: "destructive",
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
              {new Date(pkg.start_at).toLocaleDateString()}
            </div>
            {pkg.city && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {pkg.city}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{pkg.tier} Sponsorship</Badge>
            <div className="flex items-center gap-1 text-lg font-semibold">
              <DollarSign className="h-5 w-5" />
              {(pkg.price_cents / 100).toLocaleString()}
            </div>
          </div>

          {pkg.benefits && Object.keys(pkg.benefits).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Package Benefits</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                {Object.entries(pkg.benefits).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    <span>{String(value)}</span>
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
            <span>{pkg.tier} Sponsorship</span>
            <span>${(pkg.price_cents / 100).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Processing Fee</span>
            <span>$0</span>
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
        <Button onClick={handleSubmitOrder} disabled={loading} className="flex-1">
          {loading ? "Processing..." : "Submit Request"}
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
        <h3 className="text-lg font-semibold mb-2">Request Submitted Successfully!</h3>
        <p className="text-muted-foreground">
          Your sponsorship request has been sent to the event organizer for review. 
          You'll receive an email confirmation shortly and updates as your request is processed.
        </p>
      </div>
      <Button onClick={onSuccess} className="w-full">
        View My Deals
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'details' && 'Sponsorship Details'}
            {step === 'payment' && 'Review & Submit'}
            {step === 'success' && 'Request Submitted'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'details' && renderDetails()}
        {step === 'payment' && renderPayment()}
        {step === 'success' && renderSuccess()}
      </DialogContent>
    </Dialog>
  );
}