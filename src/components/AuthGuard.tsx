import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { lazy, Suspense } from 'react';
import { BrandedSpinner } from '@/components/BrandedSpinner';
const AuthPage = lazy(() => import('@/pages/AuthPage'));

/**
 * Lightweight reader for a "guest ticket" session saved by your OTP/magic-link flow.
 * Expected localStorage shape (example):
 *  key:  "ticket-guest-session"
 *  value: {
 *    token: string,
 *    email?: string,
 *    phone?: string,
 *    exp: number, // ms epoch
 *    scope?: { all?: boolean; eventIds?: string[] }
 *  }
 */
function useTicketGuestSession() {
  type TicketGuestSession = {
    token: string;
    email?: string;
    phone?: string;
    exp: number; // epoch ms
    scope?: { all?: boolean; eventIds?: string[] };
  };

  const raw = typeof window !== 'undefined'
    ? window.localStorage.getItem('ticket-guest-session')
    : null;

  return useMemo(() => {
    if (!raw) return { valid: false, reason: 'missing' as const, session: null as TicketGuestSession | null };
    try {
      const parsed = JSON.parse(raw) as TicketGuestSession;
      if (!parsed?.token || !parsed?.exp) return { valid: false, reason: 'malformed' as const, session: null };
      if (Date.now() >= parsed.exp) return { valid: false, reason: 'expired' as const, session: parsed };
      return { valid: true, reason: 'ok' as const, session: parsed };
    } catch {
      return { valid: false, reason: 'parse_error' as const, session: null };
    }
  }, [raw]);
}

type Role = 'attendee' | 'organizer' | 'admin';

interface AuthGuardProps {
  children: React.ReactNode;

  /** Shown when blocked. Defaults to <AuthPage/> if not provided. */
  fallback?: React.ReactNode;

  /** Allow a verified "ticket guest" (OTP/magic-link) session instead of a full account. */
  allowTicketGuest?: boolean;

  /** If provided, user.profile.role must be one of these. */
  requireRoles?: Role[];

  /**
   * Optional scope check for ticket guest sessions.
   * If eventId is provided, the guest session must be scoped to that event
   * (or have scope.all === true).
   */
  ticketScope?: { eventId?: string };

  /**
   * If provided, navigate here when blocked. We append ?next=<current path>.
   * If omitted, we render the fallback/AuthPage instead of redirecting.
   */
  redirectTo?: string;

  /** Optional custom loading UI; otherwise a simple spinner is shown. */
  loadingFallback?: React.ReactNode;

  /** Optional callback invoked when access is blocked. */
  onBlocked?: (reason: 'unauthenticated' | 'unauthorized' | 'no-scope') => void;
}

export function AuthGuard({
  children,
  fallback,
  allowTicketGuest = false,
  requireRoles,
  ticketScope,
  redirectTo,
  loadingFallback,
  onBlocked,
}: AuthGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = `${location.pathname}${location.search}${location.hash}`;

  // Full-auth status
  const isAuthed = !!user;

  // Role gating (for full users only). If no roles required, pass.
  const roleOk = useMemo(() => {
    if (!requireRoles || requireRoles.length === 0) return true;
    const currentRole = (profile as any)?.role as Role | undefined; // stay compatible with your context shape
    return currentRole ? requireRoles.includes(currentRole) : false;
  }, [requireRoles, profile]);

  // Guest ticket session
  const guest = useTicketGuestSession();

  // Check guest validity + optional scope
  const guestOk = useMemo(() => {
    if (!allowTicketGuest || !guest.valid) return false;
    if (!ticketScope?.eventId) return true; // no scope needed
    const scope = guest.session?.scope;
    if (scope?.all) return true;
    return !!scope?.eventIds?.includes(ticketScope.eventId);
  }, [allowTicketGuest, guest.valid, guest.session, ticketScope]);

  // Overall access decision
  const allowed = (isAuthed && roleOk) || guestOk;

  // Loading state
  if (loading) {
    return (
      loadingFallback ?? (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
          <BrandedSpinner size="xl" showLogo text="Loading..." />
        </div>
      )
    );
  }

  if (!allowed) {
    // Figure out why we’re blocked (for analytics / debugging)
    const reason: 'unauthenticated' | 'unauthorized' | 'no-scope' =
      !isAuthed && !guest.valid
        ? 'unauthenticated'
        : isAuthed && !roleOk
        ? 'unauthorized'
        : 'no-scope';

    onBlocked?.(reason);

    // Optional redirect instead of rendering fallback
    if (redirectTo) {
      const next = encodeURIComponent(from);
      // Only navigate on the client
      if (typeof window !== 'undefined') {
        // Avoid double navigation in StrictMode
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        navigate(`${redirectTo}?next=${next}`, { replace: true });
      }
      // Render a minimal placeholder to avoid flashing content
      return (
        <div className="min-h-screen flex items-center justify-center">
          <BrandedSpinner size="lg" showLogo text="Redirecting..." />
        </div>
      );
    }

    // Render fallback (AuthPage by default). Keep your background for visual continuity.
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20">
        {fallback ?? <AuthPage />}
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;