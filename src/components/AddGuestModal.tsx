import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, Ticket, Mail, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGuest: (guestData: {
    email: string;
    name?: string;
    type: 'complimentary_ticket' | 'invite_only' | 'guest_code';
    tier_id?: string;
    notes?: string;
    max_uses?: number;
    expires_at?: string;
  }) => Promise<void>;
  eventId: string;
}

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  status?: string;
}

export function AddGuestModal({ isOpen, onClose, onAddGuest, eventId }: AddGuestModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [guestType, setGuestType] = useState<'complimentary_ticket' | 'invite_only' | 'guest_code'>('complimentary_ticket');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedTierId, setSelectedTierId] = useState('');
  const [notes, setNotes] = useState('');
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // reset form when opening
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setName('');
      setNotes('');
      setMaxUses(1);
      setExpiresAt('');
      setGuestType('complimentary_ticket');
      loadTicketTiers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId]);

  const loadTicketTiers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ticket_tiers')
        .select('id, name, price_cents, status')
        .eq('event_id', eventId)
        .eq('status', 'active')
        .order('sort_index', { ascending: true });
      if (error) throw error;
      setTicketTiers(data || []);
      if (data?.length) setSelectedTierId(data[0].id);
    } catch (e) {
      // silent; the parent has toasts
      console.error('Error loading ticket tiers:', e);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = useMemo(() => {
    if (guestType === 'guest_code') {
      return Boolean(selectedTierId) && (!Number.isNaN(maxUses) && maxUses > 0);
    }
    if (guestType === 'invite_only') {
      return Boolean(email);
    }
    // complimentary_ticket
    return Boolean(email && selectedTierId);
  }, [guestType, email, selectedTierId, maxUses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      await onAddGuest({
        email,
        name: name || undefined,
        type: guestType,
        tier_id: (guestType === 'complimentary_ticket' || guestType === 'guest_code') ? selectedTierId : undefined,
        notes: notes || undefined,
        max_uses: guestType === 'guest_code' ? maxUses : undefined,
        expires_at: guestType === 'guest_code' && expiresAt ? expiresAt : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error adding guest:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && (open ? void 0 : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add Guest
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guest Type */}
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
                        Guest receives a free ticket (scan-in eligible).
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
                        Guest can view private event; no ticket issued.
                      </p>
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer transition-colors ${guestType === 'guest_code' ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="guest_code" id="guest_code" />
                    <Label htmlFor="guest_code" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        <span className="font-medium">Guest Code</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Generate a code for use at checkout (limit + expiry).
                      </p>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>

          {/* Guest details */}
          <div className="space-y-4">
            {guestType !== 'guest_code' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@example.com"
                  required={guestType === 'complimentary_ticket' || guestType === 'invite_only'}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Guest Name (Optional)</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Tier select */}
          {(guestType === 'complimentary_ticket' || guestType === 'guest_code') && (
            <div className="space-y-2">
              <Label>Ticket Tier</Label>
              {loading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                  <SelectTrigger aria-label="Select ticket tier">
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

          {/* Guest code options */}
          {guestType === 'guest_code' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Maximum Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  max="100"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value || 1)))}
                  placeholder="How many people can use this code?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting} className="flex-1">
              {submitting ? 'Adding…' : 'Add Guest'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
