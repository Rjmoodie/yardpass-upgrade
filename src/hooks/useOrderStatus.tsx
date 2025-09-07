// src/components/TicketPurchaseModal.tsx

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Minus, Plus, Ticket, CreditCard } from 'lucide-react';
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

const formatUSD = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

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

  useEffect(() => {
    // Reset selections when modal is reopened
    if (isOpen) setSelections({});
  }, [isOpen]);

  const updateSelection = (tierId: string, change: number) => {
    const tier = ticketTiers.find((t) => t.id === tierId);
    if (!tier) return;

    const currentQty = selections[tierId] || 0;
    const nextQty = currentQty + change;

    const clamped = Math.max(
      0,
      Math.min(nextQty, tier.max_per_order, tier.quantity) // enforce both inventory and per-order caps
    );

    setSelections((prev) => (clamped === 0 ? { ...prev, [tierId]: 0 } : { ...prev, [tierId]: clamped }));
  };

  const totalTickets = Object.values(selections).reduce((sum, qty) => sum + (qty || 0), 0);
  const totalAmount = Object.entries(selections).reduce((sum, [tierId, qty]) => {
    const tier = ticketTiers.find((t) => t.id === tierId);
    return sum + ((tier?.price_cents || 0) * (qty || 0));
  }, 0);

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to purchase tickets.',
        variant: 'destructive',
      });
      return;
    }

    if (totalTickets === 0) {
      toast({
        title: 'No Tickets Selected',
        description: 'Please select at least one ticket.',
        variant: 'destructive',
      });
      return;
    }

    const ticketSelections = Object.entries(selections)
      .filter(([_, qty]) => (qty || 0) > 0)
      .map(([tierId, quantity]) => ({ tierId, quantity }));

    if (ticketSelections.length === 0) {
      toast({
        title: 'No Tickets Selected',
        description: 'Please select at least one ticket.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          eventId: event.id,
          ticketSelections,
        },
        headers: {
          // Provide idempotency to reduce accidental duplicate sessions
          'x-idempotency-key': crypto?.randomUUID?.() ?? String(Date.now()),
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');

      notifyInfo('Secure payment starting…');
      window.open(data.url, '_blank');

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('💥 Purchase error:', error);
      toast({
        title: 'Checkout Error',
        description: error?.message || 'Failed to create checkout session',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const whenDate = new Date(event.start_at);
  const whenDateStr = whenDate.toLocaleDateString();
  const whenTimeStr = whenDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--modal-bg)] border-[var(--modal-border)] shadow-[var(--shadow-modal)]"
        aria-busy={loading}
      >
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
                <p>
                  {whenDateStr} at {whenTimeStr}
                </p>
                {event.venue && <p>{event.venue}</p>}
                {event.location && <p>{event.location}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Ticket Tiers */}
          <div className="space-y-4">
            <h3 className="font-semibold">Select Tickets</h3>
            {ticketTiers.map((tier) => {
              const q = selections[tier.id] || 0;
              const atCap = q >= tier.max_per_order || q >= tier.quantity;

              return (
                <Card key={tier.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{tier.name}</h4>
                          <Badge variant="outline">{tier.badge_label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{formatUSD(tier.price_cents)}</span>
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
                          disabled={q <= 0 || loading}
                          aria-label={`Decrease ${tier.name} quantity`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center" aria-live="polite">
                          {q}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSelection(tier.id, 1)}
                          disabled={atCap || loading}
                          aria-label={`Increase ${tier.name} quantity`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                    <p className="text-lg font-bold">{formatUSD(totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">Total (USD)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={totalTickets === 0 || loading}
              className="flex-1"
            >
              {loading ? (
                'Processing…'
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
