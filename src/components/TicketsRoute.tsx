import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';
import TicketsPage from '@/components/TicketsPage';
import AuthModal from '@/components/AuthModal';
import { Ticket } from 'lucide-react';

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

  // For unauthenticated users without guest session, show enhanced auth modal
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Your Tickets</h1>
          <p className="text-muted-foreground">
            Access your event tickets quickly and securely
          </p>
        </div>
        
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
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have tickets yet?{' '}
            <button 
              onClick={() => window.location.href = '/'}
              className="text-primary hover:underline font-medium"
            >
              Browse events
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}