import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';
import TicketsPage from '@/components/TicketsPage';
import AuthModal from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Clock, ShieldCheck, Smartphone, Ticket as TicketIcon } from 'lucide-react';

type AuthTab = 'signin' | 'signup' | 'guest';

interface AuthState {
  open: boolean;
  title: string;
  description: string;
  defaultTab: AuthTab;
}

export function TicketsRoute() {
  const { user } = useAuth();
  const { session, isActive, clear } = useGuestTicketSession();
  const { identifier: eventIdentifier } = useParams<{ identifier?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authState, setAuthState] = useState<AuthState>({
    open: false,
    title: 'Access your tickets',
    description: 'Enter the phone or email you used at checkout.',
    defaultTab: 'guest',
  });

  const openAuth = useCallback(
    (config?: Partial<Omit<AuthState, 'open'>>) => {
      setAuthState((prev) => ({ ...prev, ...config, open: true }));
    },
    [],
  );

  const closeAuth = useCallback(() => {
    setAuthState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleBack = useCallback(() => {
    if (eventIdentifier) {
      navigate(`/e/${eventIdentifier}`);
    } else {
      navigate('/');
    }
  }, [eventIdentifier, navigate]);

  const handleGuestExpired = useCallback(() => {
    clear();
    toast({
      title: 'Guest session expired',
      description: 'Verify your contact again to keep viewing tickets.',
    });
    openAuth({
      defaultTab: 'guest',
      title: 'Extend your access',
      description: 'Verify your phone or email again to refresh the session.',
    });
  }, [clear, openAuth, toast]);

  const handleGuestExtend = useCallback(() => {
    openAuth({
      defaultTab: 'guest',
      title: 'Extend your access',
      description: 'Verify your phone or email again to refresh the session.',
    });
  }, [openAuth]);

  const handleGuestAccess = useCallback(() => {
    openAuth({
      defaultTab: 'guest',
      title: eventIdentifier ? 'Access event tickets' : 'Access your tickets',
      description: eventIdentifier
        ? 'Enter the contact you used for this event to view your tickets instantly.'
        : 'Enter the phone or email you used at checkout to see your tickets.',
    });
  }, [eventIdentifier, openAuth]);

  const handleMemberSignIn = useCallback(() => {
    openAuth({
      defaultTab: 'signin',
      title: 'Sign in to YardPass',
      description: 'Members can view every ticket and manage their profile.',
    });
  }, [openAuth]);

  const guestSession = isActive ? session : null;

  const featureCards = useMemo(
    () => [
      {
        icon: TicketIcon,
        title: 'Event-specific links',
        description: 'Jump directly to tickets for a single event with /tickets routes.',
      },
      {
        icon: Clock,
        title: 'Live session timer',
        description: 'See exactly how long guest access lasts with real-time countdowns.',
      },
      {
        icon: ShieldCheck,
        title: 'Secure guest sessions',
        description: 'Verified phone or email keeps tickets protected and easy to refresh.',
      },
      {
        icon: Smartphone,
        title: 'Built for mobile',
        description: 'Touch-friendly layouts and large QR codes make entry effortless.',
      },
    ],
    [],
  );

  let content: JSX.Element;

  if (user) {
    content = (
      <TicketsPage
        focusEventId={eventIdentifier}
        onBack={handleBack}
      />
    );
  } else if (guestSession) {
    content = (
      <TicketsPage
        guestToken={guestSession.token}
        guestScope={guestSession.scope}
        guestSession={guestSession}
        focusEventId={eventIdentifier}
        onBack={handleBack}
        onGuestSignOut={clear}
        onGuestSessionExpired={handleGuestExpired}
        onExtendGuestSession={handleGuestExtend}
      />
    );
  } else {
    const heroTitle = eventIdentifier ? 'Tickets for this event' : 'Access your tickets instantly';
    const heroDescription = eventIdentifier
      ? 'Verify the phone number or email used at checkout to unlock tickets for this event. No account required.'
      : 'Enter the contact info you used when purchasing to see every ticket on this device.';

    content = (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-background/80">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-12 px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Unified ticket wallet
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {heroTitle}
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              {heroDescription}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2" onClick={handleGuestAccess}>
              <TicketIcon className="h-5 w-5" aria-hidden />
              Access my tickets
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
              onClick={handleMemberSignIn}
            >
              <ShieldCheck className="h-5 w-5" aria-hidden />
              Sign in as a member
            </Button>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="border-border/50 bg-background/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70"
                >
                  <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {content}
      <AuthModal
        isOpen={authState.open}
        onClose={closeAuth}
        onSuccess={closeAuth}
        title={authState.title}
        description={authState.description}
        allowGuestTicketAccess
        guestScopeEventId={eventIdentifier}
        guestSessionMinutes={45}
        defaultTab={authState.defaultTab}
      />
    </>
  );
}