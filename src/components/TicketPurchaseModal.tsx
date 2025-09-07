import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Minus, Plus, Ticket, CreditCard, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { notify, notifyInfo } from '@/lib/notifications';

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
  location?: string;
  venue?: string;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [selections, setSelections] = useState<TicketSelection>({});
  const [loading, setLoading] = useState(false);

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

  const totalTickets = Object.values(selections).reduce((sum, qty) => sum + qty, 0);
  const totalAmount = Object.entries(selections).reduce((sum, [tierId, qty]) => {
    const tier = ticketTiers.find(t => t.id === tierId);
    return sum + (tier?.price_cents || 0) * qty;
  }, 0);

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
        .map(([tierId, quantity]) => ({ tierId, quantity }));

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

      console.log('✅ Checkout session created, redirecting to:', data.url);
      
      // Show redirect notification
      notifyInfo("Redirecting to secure payment...");
      
      // Add a small delay to ensure the notification is seen
      setTimeout(() => {
        try {
          // Redirect to Stripe checkout (not new tab)
          window.location.href = data.url;
        } catch (error) {
          console.error('❌ Redirect failed:', error);
          toast({
            title: "Redirect Failed",
            description: "Please click the link to complete your payment.",
            variant: "destructive",
          });
          
          // Fallback: open in new tab
          window.open(data.url, '_blank');
        }
      }, 500);

      // Close modal (success will be handled by PurchaseSuccessHandler)
      onClose();
    } catch (error: any) {
      console.error('💥 Purchase error:', error);
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--modal-bg)] border-[var(--modal-border)] shadow-[var(--shadow-modal)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            Get Tickets
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

          {/* Summary */}
          {totalTickets > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Order Summary</p>
                    <p className="text-sm text-muted-foreground">
                      {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      ${(totalAmount / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total (USD)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handlePurchase}
              disabled={totalTickets === 0 || loading}
              className="flex-1"
            >
              {loading ? (
                "Processing..."
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Purchase Tickets
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TicketPurchaseModal;