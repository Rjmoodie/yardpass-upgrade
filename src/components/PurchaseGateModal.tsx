import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Ticket, ArrowRight } from 'lucide-react';

interface PurchaseGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscoverEvents: () => void;
}

export function PurchaseGateModal({ isOpen, onClose, onDiscoverEvents }: PurchaseGateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center">
            <Ticket className="w-6 h-6 text-primary" />
            Post to events you attend
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-6">
          <div className="space-y-3">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Ticket className="w-10 h-10 text-primary" />
            </div>
            
            <p className="text-muted-foreground">
              Buy a ticket to join the conversation and share your experience with other attendees.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onDiscoverEvents}
              className="w-full flex items-center gap-2"
            >
              Discover Events
              <ArrowRight className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}