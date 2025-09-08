import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';
import TicketsPage from '@/components/TicketsPage';
import AuthModal from '@/components/AuthModal';

export function TicketsRoute() {
  const { user, profile } = useAuth();
  const { session, isActive, clear } = useGuestTicketSession();
  const [showAuth, setShowAuth] = useState(!user && !isActive);

  if (user) {
    return (
      <TicketsPage
        user={{
          id: user.id,
          name: profile?.display_name || 'User',
          role: (profile?.role as any) || 'attendee',
        }}
        onBack={() => (window.location.href = '/')}
      />
    );
  }

  // Guest session
  if (isActive && session) {
    return (
      <TicketsPage
        guestToken={session.token}
        guestScope={session.scope}
        onBack={() => (window.location.href = '/')}
        onGuestSignOut={clear}
      />
    );
  }

  // No session -> open modal in "guest" tab
  return (
    <>
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          // after guest verifies, this component will re-render and show tickets
          setShowAuth(false);
        }}
        title="Access your tickets"
        description="Enter the phone or email you used at checkout"
        allowGuestTicketAccess
        defaultTab="guest"
      />
    </>
  );
}