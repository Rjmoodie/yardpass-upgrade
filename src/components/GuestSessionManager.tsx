import { useEffect, useMemo, useRef, useState } from 'react';
import { GuestSession } from '@/hooks/useGuestTicketSession';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestSessionManagerProps {
  session: GuestSession;
  onExtend?: () => void;
  onSignOut?: () => void;
  onExpired?: () => void;
  className?: string;
}

const maskContact = (contact?: string) => {
  if (!contact) return 'Guest contact';
  if (contact.includes('@')) {
    const [user, domain] = contact.split('@');
    if (!domain) return contact;
    const maskedUser = user.length <= 2 ? `${user[0] ?? ''}*` : `${user[0]}${'*'.repeat(Math.max(user.length - 2, 1))}${user.slice(-1)}`;
    return `${maskedUser}@${domain}`;
  }

  const digits = contact.replace(/\D/g, '');
  if (digits.length < 4) return contact;
  const lastFour = digits.slice(-4);
  return `••• ••${lastFour}`;
};

export function GuestSessionManager({ session, onExtend, onSignOut, onExpired, className }: GuestSessionManagerProps) {
  const [timeLeftMs, setTimeLeftMs] = useState(() => Math.max(session.exp - Date.now(), 0));
  const initialDurationRef = useRef(timeLeftMs || 1);
  const expiredRef = useRef(false);

  useEffect(() => {
    const remaining = Math.max(session.exp - Date.now(), 0);
    setTimeLeftMs(remaining);
    initialDurationRef.current = remaining || 1;
    expiredRef.current = false;

    if (remaining <= 0) {
      expiredRef.current = true;
      onExpired?.();
    }
  }, [session.exp, session.token, onExpired]);

  useEffect(() => {
    if (expiredRef.current) return;

    const interval = window.setInterval(() => {
      setTimeLeftMs((current) => {
        const next = Math.max(current - 1000, 0);
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          onExpired?.();
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [onExpired, session.exp, session.token]);

  const timeDisplay = useMemo(() => {
    const totalSeconds = Math.floor(timeLeftMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeftMs]);

  const progress = useMemo(() => {
    const total = initialDurationRef.current || 1;
    const value = Math.max(timeLeftMs / total, 0);
    return Math.min(100, Math.max(0, value * 100));
  }, [timeLeftMs]);

  const isExpiringSoon = timeLeftMs <= 5 * 60 * 1000 && timeLeftMs > 0;
  const contactLabel = maskContact((session as any).contact ?? session.phone ?? session.email);
  const scopeLabel = session.scope?.all
    ? 'All active events'
    : session.scope?.eventIds?.length
      ? `${session.scope.eventIds.length} event${session.scope.eventIds.length === 1 ? '' : 's'}`
      : 'Event-specific access';

  return (
    <Card className={cn('border-primary/40 bg-primary/5 backdrop-blur supports-[backdrop-filter]:bg-primary/10', className)}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-1 flex-col gap-3 text-left">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/15 text-primary">
              Guest session active
            </Badge>
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Accessing tickets for <span className="font-semibold">{contactLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground">{scopeLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-medium text-foreground">Session expires in {timeDisplay}</span>
            {isExpiringSoon && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Refresh now to keep access
              </span>
            )}
          </div>
          <Progress
            value={progress}
            className="h-2 w-full overflow-hidden rounded-full bg-primary/20"
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            onClick={onExtend}
            className="group flex-1 gap-2 border-primary/40 text-primary hover:bg-primary/10 sm:flex-initial"
          >
            <RefreshCw className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180" aria-hidden />
            Extend session
          </Button>
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="flex-1 gap-2 text-muted-foreground hover:text-destructive sm:flex-initial"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default GuestSessionManager;
