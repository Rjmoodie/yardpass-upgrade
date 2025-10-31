import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Ticket, X, CreditCard, AlertCircle } from 'lucide-react';
import { TicketPurchaseModal } from './TicketPurchaseModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Event {
  id: string;
  title: string;
  start_at: string; // Keep this for backward compatibility
  startAtISO?: string; // New field from Index.tsx
  venue?: string;
  address?: string;
  description?: string;
}

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  badge_label: string;
  quantity: number;
  max_per_order: number;
}

interface EventTicketModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EventTicketModal({ event, isOpen, onClose, onSuccess }: EventTicketModalProps) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(false);

  const isPast = (() => {
    if (!event?.start_at && !event?.startAtISO) return false;
    const iso = event.startAtISO ?? event.start_at;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t < Date.now() : false;
  })();

  // Fetch ticket tiers when event changes
  useEffect(() => {
    if (event?.id && isOpen) {
      console.log('🎫 [EventTicketModal] Event data:', {
        id: event.id,
        title: event.title,
        start_at: event.start_at,
        startAtISO: event.startAtISO,
        fullEvent: event
      });
      fetchTicketTiers();
    }
  }, [event?.id, isOpen]);

  const fetchTicketTiers = async () => {
    if (!event?.id) return;
    
    console.log('🎫 Fetching ticket tiers for event:', event.id);
    setLoading(true);
    try {
      // Fetch ticket tiers with reserved and issued quantities
      const { data: tiers, error: tiersError } = await supabase
        .from('ticket_tiers')
        .select('id, name, price_cents, badge_label, quantity, max_per_order, reserved_quantity, issued_quantity')
        .eq('event_id', event.id)
        .order('price_cents', { ascending: true });

      if (tiersError) throw tiersError;
      if (!tiers || tiers.length === 0) {
        setTicketTiers([]);
        return;
      }

      // Calculate truly available tickets (capacity - reserved - issued)
      const tiersWithAvailability = tiers.map((tier: any) => {
        const totalCapacity = tier.quantity || 0;
        const reserved = tier.reserved_quantity || 0;
        const issued = tier.issued_quantity || 0;
        const available = totalCapacity - reserved - issued;

        console.log(`🎫 Tier "${tier.name}": total=${totalCapacity}, reserved=${reserved}, issued=${issued}, available=${available}`);

        return {
          ...tier,
          quantity: Math.max(0, available), // Show truly available tickets
          totalCapacity,
          reserved,
          issued,
        };
      });

      setTicketTiers(tiersWithAvailability);
    } catch (error) {
      console.error('❌ Error fetching ticket tiers:', error);
      setTicketTiers([]);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const handlePurchaseClick = () => {
    if (isPast) return; // safety
    console.log('🛒 Purchase button clicked!');
    console.log('Available ticket tiers:', ticketTiers?.length);
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = () => {
    console.log('✅ Purchase successful!');
    setShowPurchaseModal(false);
    onSuccess();
    toast({
      title: 'Success!',
      description: 'Redirecting to checkout...'
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Event Tickets
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Event Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{event.title}</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  {(() => {
                    const dateString = event.startAtISO ?? event.start_at;
                    if (!dateString) {
                      return <p>Date TBA</p>;
                    }
                    try {
                      const date = new Date(dateString);
                      if (isNaN(date.getTime())) {
                        return <p>Date TBA</p>;
                      }
                      return (
                        <p>
                          {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                        </p>
                      );
                    } catch {
                      return <p>Date TBA</p>;
                    }
                  })()}
                  {event.venue && !event.address && <p>{event.venue}</p>}
                  {event.address && <p>{event.address}</p>}
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                )}
              </CardContent>
            </Card>

            {/* Past event notice */}
            {isPast && (
              <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
                Sales ended — this event has already started or ended.
              </div>
            )}

            {/* Available Tickets */}
            <div className="space-y-4">
              <h3 className="font-semibold">Available Tickets</h3>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading tickets...</p>
                </div>
              ) : ticketTiers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No tickets available for this event.</p>
                </div>
              ) : (
                <>
                  {/* All sold out warning */}
                  {ticketTiers.every(tier => tier.quantity === 0) && !isPast && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-destructive mb-1">All Tickets Sold Out</h4>
                        <p className="text-sm text-muted-foreground">
                          All tickets for this event are currently sold out. Check back later as more tickets may become available.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {ticketTiers.map((tier) => {
                    const isSoldOut = tier.quantity === 0;
                    return (
                      <Card
                        key={tier.id}
                        className={`border transition-colors ${
                          isPast || isSoldOut 
                            ? 'opacity-60 bg-muted/30' 
                            : 'hover:border-primary/50'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className={`font-medium ${isSoldOut ? 'text-muted-foreground' : ''}`}>
                                  {tier.name}
                                </h4>
                                {isSoldOut && (
                                  <Badge variant="destructive" className="bg-destructive/90">
                                    SOLD OUT
                                  </Badge>
                                )}
                                {tier.badge_label && !isSoldOut && (
                                  <Badge variant="outline">{tier.badge_label}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className={`font-semibold text-lg ${
                                  isSoldOut ? 'text-muted-foreground line-through' : 'text-foreground'
                                }`}>
                                  ${(tier.price_cents / 100).toFixed(2)}
                                </span>
                                <span className={isSoldOut ? 'text-destructive font-medium' : ''}>
                                  {isSoldOut ? 'None available' : `${tier.quantity} available`}
                                </span>
                                {!isSoldOut && <span>Max {tier.max_per_order} per order</span>}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button
                onClick={handlePurchaseClick}
                className="flex-1"
                disabled={
                  loading || 
                  ticketTiers.length === 0 || 
                  isPast || 
                  ticketTiers.every(tier => tier.quantity === 0)
                }
                variant={isPast || ticketTiers.every(tier => tier.quantity === 0) ? 'outline' : 'default'}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {isPast 
                  ? 'Sales ended' 
                  : ticketTiers.every(tier => tier.quantity === 0)
                  ? 'Sold Out'
                  : 'Purchase Tickets'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Modal */}
      {event && (
        <TicketPurchaseModal
          event={event}
          ticketTiers={ticketTiers || []}
          isOpen={showPurchaseModal}
          onClose={() => {
            console.log('🔄 Purchase modal closed');
            setShowPurchaseModal(false);
          }}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </>
  );
}

export default EventTicketModal;