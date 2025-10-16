import { useEffect, useMemo, useRef, useState } from 'react';
import { GuestSession } from '@/hooks/useGuestTicketSession';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw, User } from 'lucide-react';
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
    <div className={cn('mb-4 flex items-center justify-between rounded-lg border border-border/60 bg-background/80 p-3 text-xs', className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <User className="h-3 w-3" />
        <span>Guest access • {contactLabel}</span>
        {timeLeftMs > 0 && (
          <>
            <span>•</span>
            <Clock className="h-3 w-3" />
            <span>Expires in {timeDisplay}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isExpiringSoon && timeLeftMs > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExtend}
            className="h-6 text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Extend
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="h-6 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="mr-1 h-3 w-3" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export default GuestSessionManager;
