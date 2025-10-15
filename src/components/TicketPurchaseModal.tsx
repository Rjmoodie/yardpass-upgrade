import { useState, useEffect, useMemo, useContext, useRef, useCallback, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Plus, Minus, CreditCard, Key, Check, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { toast } from '@/hooks/use-toast';
import { createHold, createCheckoutSession, createGuestCheckoutSession } from '@/lib/ticketApi';
const SkeletonList = lazy(() => import('@/components/common/SkeletonList'));

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  badge_label: string;
  quantity: number;
  max_per_order: number;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  startAtISO?: string;
  venue?: string;
  address?: string;
  description?: string;
  location?: string;
}

interface TicketPurchaseModalProps {
  event: Event;
  ticketTiers: TicketTier[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TicketSelection {
  [tierId: string]: number;
}

export function TicketPurchaseModal({ 
  event, 
  ticketTiers, 
  isOpen, 
  onClose, 
  onSuccess 
}: TicketPurchaseModalProps) {
  const { trackEvent } = useAnalyticsIntegration();
  const [selections, setSelections] = useState<TicketSelection>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);
  const [user, setUser] = useState<any>(null);
  const [guestCode, setGuestCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [validatedCode, setValidatedCode] = useState<{
    id: string;
    code: string;
    tier_id?: string;
    tier_name?: string;
  } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const notifyInfo = (message: string) => {
    toast({
      title: "Info",
      description: message,
    });
  };

  const validateGuestCode = async () => {
    const trimmed = guestCode.trim().toUpperCase();
    if (!trimmed) return;

    setValidatingCode(true);
    setCodeError(null);
    
    try {
      // Get guest code data
      const { data, error } = await supabase
        .from('guest_codes')
        .select(`
          id,
          code,
          tier_id,
          max_uses,
          used_count,
          expires_at
        `)
        .eq('event_id', event.id)
        .eq('code', trimmed)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCodeError('Invalid guest code');
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setCodeError('Guest code has expired');
        return;
      }

      if (data.used_count >= data.max_uses) {
        setCodeError('Guest code has reached its usage limit');
        return;
      }

      // Get tier name if tier_id exists
      let tierName: string | undefined;
      if (data.tier_id) {
        const { data: tierData } = await supabase
          .from('ticket_tiers')
          .select('name')
          .eq('id', data.tier_id)
          .maybeSingle();
        tierName = tierData?.name;
      }

      setValidatedCode({
        id: data.id,
        code: data.code,
        tier_id: data.tier_id ?? undefined,
        tier_name: tierName,
      });

      toast({
        title: "Valid guest code",
        description: `Access granted${tierName ? ` for ${tierName}` : ''}`,
      });
    } catch (e: any) {
      console.error('Error validating guest code:', e);
      setCodeError('Unable to validate guest code');
    } finally {
      setValidatingCode(false);
    }
  };

  // Fee calculation function
  const calculateFees = (faceValue: number) => {
    // processingFee = (faceValue * 0.037) + 1.89 + (faceValue * 0.029) + 0.30
    // which simplifies to: faceValue * 0.066 + 2.19
    const processingFee = faceValue * 0.066 + 2.19;
    const total = faceValue + processingFee;
    
    return {
      total: Math.round(total * 100) / 100, // Round to cents
      processingFee: Math.round(processingFee * 100) / 100,
      stripeFee: 0, // Not needed for display
      platformComponent: 0 // Not needed for display
    };
  };

  const updateSelection = (tierId: string, change: number) => {
    const tier = ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    const currentQty = selections[tierId] || 0;
    const newQty = Math.max(0, Math.min(currentQty + change, tier.max_per_order, tier.quantity));
    
    // Track ticket selection changes
    trackEvent('ticket_selection_change', {
      event_id: event.id,
      tier_id: tierId,
      tier_name: tier.name,
      previous_quantity: currentQty,
      new_quantity: newQty,
      price_cents: tier.price_cents
    });
    
    setSelections(prev => ({
      ...prev,
      [tierId]: newQty
    }));
  };

  // Calculate totals with fees
  const summary = useMemo(() => {
    let subtotal = 0;
    let totalQuantity = 0;
    let totalProcessingFee = 0;
    let grandTotal = 0;
    
    Object.entries(selections).forEach(([tierId, quantity]) => {
      const tier = ticketTiers.find(t => t.id === tierId);
      if (tier && quantity > 0) {
        const faceValue = tier.price_cents / 100;
        const fees = calculateFees(faceValue);
        
        subtotal += faceValue * quantity;
        totalProcessingFee += fees.processingFee * quantity;
        grandTotal += fees.total * quantity;
        totalQuantity += quantity;
      }
    });
    
    return { 
      subtotal, 
      totalQuantity, 
      processingFee: totalProcessingFee,
      grandTotal
    };
  }, [selections, ticketTiers]);

  const totalTickets = summary.totalQuantity;
  const totalAmount = Math.round(summary.grandTotal * 100); // Convert to cents

  const handlePurchase = useCallback(async () => {
    console.log('🎫 Purchase button clicked!');

    // Double-submit guard
    if (busyRef.current || submitting) {
      console.log('⚠️ Already processing, ignoring duplicate click');
      return;
    }

    // Track checkout initiation
    trackEvent('checkout_started', {
      event_id: event.id,
      tier_ids: Object.keys(selections).filter(id => selections[id] > 0),
      total_cents: totalAmount,
      total_quantity: totalTickets
    });

    console.log('User:', user);
    console.log('Total tickets:', totalTickets);
    console.log('Selections:', selections);

    const selectedEntries = Object.entries(selections).filter(([_, qty]) => (qty ?? 0) > 0);

    if (selectedEntries.length === 0) {
      console.log('❌ No tickets selected');
      trackEvent('checkout_no_tickets_selected', {
        event_id: event.id
      });
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket.",
        variant: "destructive"
      });
      return;
    }

    const items = Object.fromEntries(selectedEntries);
    const isGuestCheckout = !user;

    if (isGuestCheckout) {
      const trimmedEmail = guestEmail.trim().toLowerCase();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
      if (!emailValid) {
        setGuestEmailError('Enter a valid email to continue.');
        trackEvent('checkout_guest_email_invalid', {
          event_id: event.id,
          total_cents: totalAmount,
        });
        toast({
          title: "Email required",
          description: "Enter a valid email so we can send your tickets.",
          variant: "destructive"
        });
        return;
      }
      setGuestEmailError(null);
    } else {
      setGuestEmailError(null);
    }

    busyRef.current = true;
    setSubmitting(true);
    setLoading(true);

    try {
      if (isGuestCheckout) {
        trackEvent('checkout_guest_started', {
          event_id: event.id,
          total_cents: totalAmount,
          total_quantity: totalTickets
        });

        const guestItems = selectedEntries.map(([tierId, quantity]) => ({
          tier_id: tierId,
          quantity,
          unit_price_cents: ticketTiers.find(t => t.id === tierId)?.price_cents || 0
        }));

        const { url } = await createGuestCheckoutSession({
          event_id: event.id,
          items: guestItems,
          contact_email: guestEmail.trim(),
          contact_name: guestName.trim() || undefined,
          guest_code: guestCode || null
        });

        notifyInfo('Redirecting to secure payment...');
        window.location.href = url;
        return;
      }

      // Member checkout - use enhanced-checkout
      console.log('🚀 Using enhanced-checkout for member purchase');
      const ticketSelections = selectedEntries.map(([tierId, quantity]) => ({
        tierId,
        quantity
      }));

      const { data, error } = await supabase.functions.invoke('enhanced-checkout', {
        body: {
          eventId: event.id,
          ticketSelections
        }
      });

      if (error) {
        console.error('❌ Enhanced checkout error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No checkout URL returned');
      }

      console.log('✅ Checkout session created, redirecting...');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      busyRef.current = false;
      setSubmitting(false);
      setLoading(false);
    }
  }, [event.id, selections, submitting, user, totalTickets, totalAmount, trackEvent, guestCode, ticketTiers, onSuccess, guestEmail, guestName]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Purchase Tickets
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Info */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">{event.title}</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{new Date(event.start_at).toLocaleDateString()} at {new Date(event.start_at).toLocaleTimeString()}</p>
                {event.venue && <p>{event.venue}</p>}
                {event.location && <p>{event.location}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Guest contact details for guest checkout */}
          {!user && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <h3 className="font-semibold">Email for ticket delivery</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  We'll send your receipt and ticket access link to this email. You can verify it later with a one-time code to view your tickets.
                </p>
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    aria-invalid={guestEmailError ? true : false}
                  />
                  {guestEmailError && (
                    <p className="text-sm text-destructive">{guestEmailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Name for the order (optional)"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guest Code Section */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Guest Code (Optional)
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Enter your guest code"
                      value={guestCode}
                      onChange={(e) => {
                        setGuestCode(e.target.value);
                        setCodeError(null);
                        setValidatedCode(null);
                      }}
                      className={`${
                        validatedCode ? 'border-green-500' : codeError ? 'border-red-500' : ''
                      } pr-10`}
                      disabled={validatingCode || !!validatedCode}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {validatedCode && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {codeError && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {!validatedCode && (
                    <Button
                      onClick={validateGuestCode}
                      disabled={!guestCode.trim() || validatingCode}
                      variant="outline"
                    >
                      {validatingCode ? 'Validating...' : 'Apply'}
                    </Button>
                  )}
                  {validatedCode && (
                    <Button
                      onClick={() => {
                        setValidatedCode(null);
                        setGuestCode('');
                        setCodeError(null);
                      }}
                      variant="outline"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {codeError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {codeError}
                  </p>
                )}
                {validatedCode && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Guest code applied successfully
                      {validatedCode.tier_name && ` for ${validatedCode.tier_name}`}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ticket Tiers */}
          <div className="space-y-4">
            <h3 className="font-semibold">Select Tickets</h3>
            {ticketTiers.map((tier) => (
              <Card key={tier.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{tier.name}</h4>
                        <Badge variant="outline">{tier.badge_label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          ${(tier.price_cents / 100).toFixed(2)}
                        </span>
                        <span>{tier.quantity} available</span>
                        <span>Max {tier.max_per_order} per order</span>
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSelection(tier.id, -1)}
                        disabled={!selections[tier.id]}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center">
                        {selections[tier.id] || 0}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSelection(tier.id, 1)}
                        disabled={
                          (selections[tier.id] || 0) >= tier.max_per_order ||
                          (selections[tier.id] || 0) >= tier.quantity
                        }
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          {totalTickets > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Order Summary</h3>
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between">
                  <span>Tickets ({summary.totalQuantity})</span>
                  <span>${summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span>Processing fee</span>
                    <div className="relative group">
                      <span className="text-xs w-3 h-3 rounded-full bg-muted-foreground text-background flex items-center justify-center cursor-help">ⓘ</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Includes platform and payment processing costs
                      </div>
                    </div>
                  </div>
                  <span>${summary.processingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>${summary.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handlePurchase} 
              disabled={submitting || loading || totalTickets === 0}
              className="flex-1"
            >
              {submitting || loading ? 'Processing...' : `Purchase ${totalTickets > 0 ? `(${totalTickets} ticket${totalTickets !== 1 ? 's' : ''})` : 'Tickets'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TicketPurchaseModal;