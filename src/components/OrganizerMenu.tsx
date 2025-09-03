import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Copy, Plus, ArrowRight } from 'lucide-react';

interface OrganizerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onPostAsCrew: () => void;
  onRecreateEvent: () => void;
}

export function OrganizerMenu({ isOpen, onClose, onPostAsCrew, onRecreateEvent }: OrganizerMenuProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center">
            <Users className="w-6 h-6 text-primary" />
            Organizer Menu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button 
            onClick={onPostAsCrew}
            className="w-full flex items-center gap-3 h-16 text-left justify-start"
            variant="outline"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Post as Crew</div>
              <div className="text-sm text-muted-foreground">
                Share updates with your event attendees
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Button>

          <Button 
            onClick={onRecreateEvent}
            className="w-full flex items-center gap-3 h-16 text-left justify-start"
            variant="outline"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Copy className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Recreate Event</div>
              <div className="text-sm text-muted-foreground">
                Create a new event from a past template
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Button>

          <Button 
            variant="ghost" 
            onClick={onClose}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}