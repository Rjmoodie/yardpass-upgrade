import { useState, useEffect, useMemo, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Plus, Minus, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  const [selections, setSelections] = useState<TicketSelection>({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const notifyInfo = (message: string) => {
    toast({
      title: "Info",
      description: message,
    });
  };

  // Fee calculation function
  const calculateFees = (faceValue: number) => {
    // Formula: Total = (F*1.037 + 2.19)/0.971
    const total = (faceValue * 1.037 + 2.19) / 0.971;
    const processingFee = total - faceValue;
    const stripeFee = 0.029 * total + 0.30;
    const platformComponent = processingFee - stripeFee;
    
    return {
      total: Math.round(total * 100) / 100, // Round to cents
      processingFee: Math.round(processingFee * 100) / 100,
      stripeFee: Math.round(stripeFee * 100) / 100,
      platformComponent: Math.round(platformComponent * 100) / 100
    };
  };

  const updateSelection = (tierId: string, change: number) => {
    const tier = ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    const currentQty = selections[tierId] || 0;
    const newQty = Math.max(0, Math.min(currentQty + change, tier.max_per_order, tier.quantity));
    
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

  const handlePurchase = async () => {
    console.log('🎫 Purchase button clicked!');
    console.log('User:', user);
    console.log('Total tickets:', totalTickets);
    console.log('Selections:', selections);
    
    if (!user) {
      console.log('❌ User not authenticated');
      toast({
        title: "Authentication Required",
        description: "Please sign in to purchase tickets.",
        variant: "destructive"
      });
      return;
    }

    if (totalTickets === 0) {
      console.log('❌ No tickets selected');
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const ticketSelections = Object.entries(selections)
        .filter(([_, qty]) => qty > 0)
        .map(([tierId, quantity]) => ({ 
          tierId, 
          quantity,
          faceValue: ticketTiers.find(t => t.id === tierId)?.price_cents || 0
        }));

      console.log('🚀 Calling create-checkout with:', {
        eventId: event.id,
        ticketSelections
      });

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          eventId: event.id,
          ticketSelections
        }
      });

      console.log('📡 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      console.log('✅ Checkout session created, opening in new tab:', data.url);
      
      // Show redirect notification
      notifyInfo("Opening secure payment in new tab...");
      
      // Open Stripe checkout in a new tab (recommended approach)
      const checkoutWindow = window.open(data.url, '_blank');
      
      if (!checkoutWindow) {
        // Fallback for popup blockers
        console.log('🚨 Popup blocked, showing manual redirect');
        toast({
          title: "Popup Blocked",
          description: "Please allow popups or click here to continue to checkout.",
          action: (
            <Button 
              size="sm" 
              onClick={() => window.open(data.url, '_blank')}
            >
              Go to Checkout
            </Button>
          )
        });
      } else {
        // Track when user returns to the original tab
        const checkInterval = setInterval(() => {
          if (checkoutWindow.closed) {
            clearInterval(checkInterval);
            console.log('🔄 User returned from checkout, calling success callback');
            onSuccess();
          }
        }, 1000);
      }

    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              disabled={loading || totalTickets === 0}
              className="flex-1"
            >
              {loading ? 'Processing...' : `Purchase ${totalTickets > 0 ? `(${totalTickets} ticket${totalTickets !== 1 ? 's' : ''})` : 'Tickets'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TicketPurchaseModal;