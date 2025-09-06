import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, Ticket, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGuest: (guestData: {
    email: string;
    name?: string;
    type: 'complimentary_ticket' | 'invite_only';
    tier_id?: string;
    notes?: string;
  }) => Promise<void>;
  eventId: string;
}

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
}

export function AddGuestModal({ isOpen, onClose, onAddGuest, eventId }: AddGuestModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [guestType, setGuestType] = useState<'complimentary_ticket' | 'invite_only'>('complimentary_ticket');
  const [selectedTierId, setSelectedTierId] = useState('');
  const [notes, setNotes] = useState('');
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTicketTiers();
    }
  }, [isOpen, eventId]);

  const loadTicketTiers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ticket_tiers')
        .select('id, name, price_cents')
        .eq('event_id', eventId)
        .eq('status', 'active')
        .order('sort_index');

      if (error) throw error;
      setTicketTiers(data || []);
      
      // Auto-select first tier
      if (data && data.length > 0) {
        setSelectedTierId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading ticket tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await onAddGuest({
        email,
        name: name || undefined,
        type: guestType,
        tier_id: guestType === 'complimentary_ticket' ? selectedTierId : undefined,
        notes: notes || undefined
      });

      // Reset form
      setEmail('');
      setName('');
      setNotes('');
      setGuestType('complimentary_ticket');
      onClose();
    } catch (error) {
      console.error('Error adding guest:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email && (guestType === 'invite_only' || selectedTierId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add Guest
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guest Type Selection */}
          <div className="space-y-3">
            <Label>Guest Type</Label>
            <RadioGroup value={guestType} onValueChange={(value) => setGuestType(value as any)}>
              <Card className={`cursor-pointer transition-colors ${guestType === 'complimentary_ticket' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="complimentary_ticket" id="ticket" />
                    <Label htmlFor="ticket" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4" />
                        <span className="font-medium">Complimentary Ticket</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Guest gets a free ticket and can be scanned in
                      </p>
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer transition-colors ${guestType === 'invite_only' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="invite_only" id="invite" />
                    <Label htmlFor="invite" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span className="font-medium">Invite Only</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Guest can view private event but no ticket issued
                      </p>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>

          {/* Guest Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Guest Name (Optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Ticket Tier Selection (only for complimentary tickets) */}
          {guestType === 'complimentary_ticket' && (
            <div className="space-y-2">
              <Label>Ticket Tier</Label>
              {loading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ticket tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketTiers.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.name} {tier.price_cents > 0 && `($${(tier.price_cents / 100).toFixed(2)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requirements, VIP status, etc."
              className="min-h-[60px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!canSubmit || submitting}
              className="flex-1"
            >
              {submitting ? 'Adding...' : 'Add Guest'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}