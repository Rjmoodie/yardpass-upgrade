import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';
import TicketsPage from '@/components/TicketsPage';
import AuthModal from '@/components/AuthModal';

export function TicketsRoute() {
  const { user, profile } = useAuth();
  const { session, isActive, clear } = useGuestTicketSession();
  const [showAuth, setShowAuth] = useState(false);

  // If user is authenticated, show their tickets
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

  // If there's an active guest session, show guest tickets
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

  // For unauthenticated users without guest session, show auth modal
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <AuthModal
        isOpen={true}
        onClose={() => (window.location.href = '/')}
        onSuccess={() => {
          // Component will re-render with auth state
          setShowAuth(false);
        }}
        title="Access your tickets"
        description="Enter the phone or email you used at checkout"
        allowGuestTicketAccess
        defaultTab="guest"
      />
    </div>
  );
}