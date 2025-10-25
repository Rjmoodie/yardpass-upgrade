import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Crown } from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  badge: string;
  isOrganizer?: boolean;
}

interface AttendeeListModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  attendeeCount: number;
  attendees: Attendee[];
}


export const AttendeeListModal = ({ 
  isOpen, 
  onClose, 
  eventTitle, 
  attendeeCount,
  attendees = [] 
}: AttendeeListModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Attendees ({attendeeCount})
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{eventTitle}</p>
        </DialogHeader>
        
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {attendees.map((attendee) => (
              <div key={attendee.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {attendee.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{attendee.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {attendee.badge}
                    </Badge>
                    {attendee.isOrganizer && (
                      <Badge variant="secondary" className="text-xs">
                        <Crown className="w-3 h-3 mr-1" />
                        ORG
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};