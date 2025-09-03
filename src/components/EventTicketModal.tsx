import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Ticket, X, CreditCard } from 'lucide-react';
import { TicketPurchaseModal } from './TicketPurchaseModal';

interface Event {
  id: string;
  title: string;
  start_at: string;
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

// Mock data for testing
const mockTicketTiers: TicketTier[] = [
  {
    id: '1',
    name: 'General Admission',
    price_cents: 2500, // $25.00
    badge_label: 'GA',
    quantity: 100,
    max_per_order: 6
  },
  {
    id: '2',
    name: 'VIP Experience',
    price_cents: 7500, // $75.00
    badge_label: 'VIP',
    quantity: 25,
    max_per_order: 4
  },
  {
    id: '3',
    name: 'Early Bird',
    price_cents: 1500, // $15.00
    badge_label: 'EARLY',
    quantity: 50,
    max_per_order: 6
  }
];

export function EventTicketModal({ event, isOpen, onClose, onSuccess }: EventTicketModalProps) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

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
              {mockTicketTiers.map((tier) => (
                <Card key={tier.id} className="border hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{tier.name}</h4>
                          <Badge variant="outline">{tier.badge_label}</Badge>
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
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button onClick={handlePurchaseClick} className="flex-1">
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
        ticketTiers={mockTicketTiers}
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
}

export default EventTicketModal;