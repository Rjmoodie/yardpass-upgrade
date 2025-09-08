import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function ReportButton({ targetType, targetId }: { targetType: 'post'|'event'|'user'|'comment'; targetId: string }) {
  const { requireAuth } = useAuthGuard();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const submit = async () => {
    await requireAuth(async () => {
      const { error } = await supabase.from('reports').insert({ target_type: targetType, target_id: targetId, reason });
      if (error) {
        toast({ title: 'Failed to report', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Reported', description: 'Thanks for the heads-up.' });
      setOpen(false);
      setReason('');
    }, 'Please sign in to report.');
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Report">
        <Flag className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report content</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Why are you reporting this?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!reason.trim()}>Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}