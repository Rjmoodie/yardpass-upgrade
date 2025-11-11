import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// 🎯 Removed framer-motion import (using CSS animations instead)
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
        title: 'Event links that work anywhere',
        description: 'Instantly open your tickets from any email or message—no app needed.',
        span: 1,
      },
      {
        icon: ShieldCheck,
        title: 'Always secure, always yours',
        description: 'We verify every session, so your tickets stay private and easy to refresh.',
        span: 1,
      },
      {
        icon: Smartphone,
        title: 'Entry made effortless',
        description: 'Swipe, scan, and go with touch‑friendly QR codes that work offline.',
        span: 2, // Full width on mobile, spans 2 columns on desktop
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
    const heroTitle = eventIdentifier ? 'Tickets for this event' : 'Your tickets, ready when you are';
    const heroDescription = eventIdentifier
      ? 'Verify the phone number or email used at checkout to unlock tickets for this event. No account required.'
      : 'View, manage, and enter events—all from one secure place.';

    content = (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background text-foreground flex items-start justify-center p-4 sm:p-8">
        <main className="w-full max-w-5xl">
          {/* Card container */}
          <section className="mx-auto bg-card/80 backdrop-blur rounded-3xl shadow-xl ring-1 ring-border/20 overflow-hidden">
            {/* Hero */}
            <div className="px-6 sm:px-12 py-10 sm:py-14 text-center">
              {/* 🎯 Replaced framer-motion with CSS animations */}
              <div className="inline-flex items-center gap-3 mb-4 animate-slide-up">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <TicketIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-muted-foreground">Ticket Wallet</p>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground animate-slide-up animate-stagger-1">
                {heroTitle}
              </h1>

              <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto animate-slide-up animate-stagger-2">
                {heroDescription}
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col items-center gap-3 animate-fade-in animate-stagger-3">
                <Button
                  onClick={handleGuestAccess}
                  className="group inline-flex items-center justify-center rounded-2xl px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold bg-primary text-primary-foreground shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition"
                >
                  Access My Tickets
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleMemberSignIn}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Already a member? Sign in here
                </Button>
              </div>
            </div>

            {/* Value props */}
            <div className="px-6 sm:px-12 pb-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {featureCards.map((feature, index) => {
                  const Icon = feature.icon;
                  const isFullWidth = feature.span === 2;
                  
                  return (
                    <div
                      key={feature.title}
                      className={`${isFullWidth ? 'sm:col-span-2' : ''} rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm animate-scale-in`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trust line */}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Your data is encrypted and never shared.</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <>
      {content}
      <AuthModal
        isOpen={authState.open}
        onClose={closeAuth}
        onSuccess={() => {
          // Close modal first
          closeAuth();
          
          // Small delay to ensure modal closes before navigation
          setTimeout(() => {
            // Trigger storage event to update guest session state
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'ticket-guest-session',
              newValue: localStorage.getItem('ticket-guest-session')
            }));
            
            // Navigate to tickets page after successful guest verification
            if (eventIdentifier) {
              navigate(`/e/${eventIdentifier}/tickets`);
            } else {
              navigate('/tickets');
            }
          }, 100);
        }}
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