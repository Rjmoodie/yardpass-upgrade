import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Ticket, X, CreditCard } from 'lucide-react';
import { TicketPurchaseModal } from './TicketPurchaseModal';
import { supabase } from '@/integrations/supabase/client';

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

  // Fetch ticket tiers when event changes
  useEffect(() => {
    if (event?.id && isOpen) {
      fetchTicketTiers();
    }
  }, [event?.id, isOpen]);

  const fetchTicketTiers = async () => {
    if (!event?.id) return;
    
    console.log('🎫 Fetching ticket tiers for event:', event.id);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ticket_tiers')
        .select('id, name, price_cents, badge_label, quantity, max_per_order')
        .eq('event_id', event.id)
        .order('price_cents', { ascending: true });

      console.log('🎫 Ticket tiers result:', { data, error, count: data?.length });
      
      if (error) throw error;
      setTicketTiers(data || []);
    } catch (error) {
      console.error('❌ Error fetching ticket tiers:', error);
      setTicketTiers([]);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const handlePurchaseClick = () => {
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = () => {
    setShowPurchaseModal(false);
    onSuccess();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <p>{new Date(event.start_at).toLocaleDateString()} at {new Date(event.start_at).toLocaleTimeString()}</p>
                  {event.venue && <p>{event.venue}</p>}
                  {event.address && <p>{event.address}</p>}
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                )}
              </CardContent>
            </Card>

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
                ticketTiers.map((tier) => (
                  <Card key={tier.id} className="border hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{tier.name}</h4>
                            {tier.badge_label && <Badge variant="outline">{tier.badge_label}</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground text-lg">
                              ${(tier.price_cents / 100).toFixed(2)}
                            </span>
                            <span>{tier.quantity} available</span>
                            <span>Max {tier.max_per_order} per order</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
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
                disabled={loading || ticketTiers.length === 0}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Purchase Tickets
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Modal */}
      <TicketPurchaseModal
        event={event}
        ticketTiers={ticketTiers}
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
}

export default EventTicketModal;