import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface RefundRequestModalProps {
  open: boolean;
  onClose: () => void;
  ticket: any;
  order: any;
  event: any;
  onSuccess: () => void;
}

const REASON_OPTIONS = [
  { value: 'cant_attend', label: "Can't attend" },
  { value: 'event_postponed', label: 'Event postponed' },
  { value: 'event_cancelled', label: 'Event cancelled' },
  { value: 'duplicate_purchase', label: 'Duplicate purchase' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'other', label: 'Other reason' },
];

export function RefundRequestModal({ 
  open, 
  onClose, 
  ticket, 
  order, 
  event, 
  onSuccess 
}: RefundRequestModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason) {
      toast({ 
        title: 'Please select a reason', 
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-refund-request', {
        body: {
          order_id: order.id,
          reason,
          details: details.trim() || null
        }
      });

      if (error) throw error;

      // Check if auto-approved
      if (data.status === 'auto_approved') {
        toast({
          title: 'Refund Approved!',
          description: `Your refund of $${data.refund?.amount || (order.total_cents / 100).toFixed(2)} has been approved. You'll receive confirmation via email.`
        });
      } else {
        toast({
          title: 'Request Submitted',
          description: 'The organizer will review your refund request and respond within 24 hours.'
        });
      }

      onSuccess();
      onClose();
      
      // Reset form
      setReason('');
      setDetails('');
    } catch (err: any) {
      console.error('Refund request error:', err);
      toast({
        title: 'Request Failed',
        description: err.message || 'Failed to submit refund request',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason('');
      setDetails('');
      onClose();
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Refund</DialogTitle>
          <DialogDescription>
            Request a refund for your ticket. The organizer will review and respond within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Event</span>
              <span className="font-medium text-right">{event.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="text-right">{formatDate(event.start_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tickets</span>
              <span>{order.tickets_count || 1}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
              <span>Refund Amount</span>
              <span className="text-lg">{formatCurrency(order.total_cents)}</span>
            </div>
          </div>

          {/* Refund Policy Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Refund Policy:</strong> Refunds allowed until 24 hours before event start. 
              Processing takes 5-10 business days after approval.
            </AlertDescription>
          </Alert>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Why are you requesting a refund? <span className="text-destructive">*</span>
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Details */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Additional details <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              placeholder="Explain your situation to help the organizer understand..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
            />
            {details.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {details.length} / 500 characters
              </p>
            )}
          </div>

          {/* What Happens Next */}
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-xs text-green-900">
              <strong>What happens next:</strong>
              <ul className="mt-1 space-y-0.5 ml-4">
                <li>• Organizer will review your request</li>
                <li>• You'll receive email notification (approved or declined)</li>
                <li>• If approved, refund processes in 5-10 business days</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Platform Fee Note */}
          <p className="text-xs text-muted-foreground">
            💳 Platform fees (~3.7% + $1.79) will be fully refunded. Stripe payment processing fees may not be refunded per Stripe's policy.
          </p>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!reason || submitting}
          >
            {submitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


