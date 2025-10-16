import { useEffect, useState } from 'react';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Clock, User, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GuestSessionManagerProps {
  onSignOut: () => void;
  className?: string;
}

export function GuestSessionManager({ onSignOut, className = '' }: GuestSessionManagerProps) {
  const { session, isActive } = useGuestTicketSession();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!session?.exp) return;

    const updateTimeRemaining = () => {
      const remaining = Math.max(0, Math.floor((session.exp - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [session?.exp]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSessionStatus = () => {
    if (timeRemaining <= 0) return 'expired';
    if (timeRemaining <= 300) return 'expiring'; // 5 minutes
    return 'active';
  };

  const getStatusColor = () => {
    const status = getSessionStatus();
    switch (status) {
      case 'expired': return 'destructive';
      case 'expiring': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusText = () => {
    const status = getSessionStatus();
    switch (status) {
      case 'expired': return 'Session expired';
      case 'expiring': return 'Session expiring soon';
      default: return 'Active session';
    }
  };

  if (!isActive || !session) return null;

  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {session.email || session.phone || 'Guest'}
              </span>
            </div>
            
            <Badge variant={getStatusColor() as any} className="text-xs">
              {getStatusText()}
            </Badge>
            
            {timeRemaining > 0 && (
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onSignOut();
              toast({
                title: 'Signed out',
                description: 'Guest session ended',
              });
            }}
            className="text-xs"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Sign out
          </Button>
        </div>
        
        {timeRemaining <= 300 && timeRemaining > 0 && (
          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              Your guest session expires in {formatTime(timeRemaining)}. 
              <button 
                onClick={() => {
                  // TODO: Implement session extension
                  toast({
                    title: 'Session extension',
                    description: 'Feature coming soon!',
                  });
                }}
                className="ml-1 text-yellow-900 dark:text-yellow-100 underline hover:no-underline"
              >
                Extend session
              </button>
            </p>
          </div>
        )}
        
        {timeRemaining <= 0 && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
            <p className="text-xs text-red-800 dark:text-red-200">
              Your guest session has expired. Please sign in again to access your tickets.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
