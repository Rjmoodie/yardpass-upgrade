import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function ClaimTicketsPrompt({
  isOpen, onClose, emailOrPhone
}: {
  isOpen: boolean;
  onClose: () => void;
  emailOrPhone: string; // the checkout identifier you captured
}) {
  const claim = async () => {
    // You'd implement an Edge Function that verifies ownership (OTP / magic link)
    // and then binds historical tickets with that email/phone to the newly created account.
    const { error } = await supabase.functions.invoke('claim-tickets', {
      body: { contact: emailOrPhone }
    });
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tickets claimed', description: 'Your past tickets are now in your account!' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Save your tickets</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Create/claim an account in one tap so your tickets are always saved and you can follow organizers.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Later</Button>
          <Button onClick={claim}>Claim Now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}