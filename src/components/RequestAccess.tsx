import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RequestAccess({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" /> Private Event
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This event is private. Only invited users, organizers, and ticket-holders can view.
          </p>
          {!user ? (
            <Button className="w-full" onClick={() => navigate('/profile')}>Sign in to request access</Button>
          ) : (
            <div className="space-y-3">
              <Button className="w-full" variant="outline" onClick={() => navigate(`/tickets?event=${eventId}`)}>
                I have a ticket
              </Button>
              <Button className="w-full" onClick={() => navigate(`/contact-organizer?event=${eventId}`)}>
                Request access from organizer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}