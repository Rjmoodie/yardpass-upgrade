import { useEffect, useMemo, useState } from 'react';

export type GuestScope = { all?: boolean; eventIds?: string[] };
export type GuestSession = { token: string; exp: number; scope?: GuestScope; phone?: string; email?: string };

const KEY = 'ticket-guest-session';

function read(): GuestSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GuestSession;
    if (!s?.token || !s?.exp) return null;
    if (Date.now() > s.exp) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function useGuestTicketSession() {
  const [session, setSession] = useState<GuestSession | null>(() => read());

  // keep in sync if other tabs change it
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSession(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const clear = () => {
    try { localStorage.removeItem(KEY); } catch {}
    setSession(null);
  };

  const isActive = useMemo(() => !!session, [session]);

  return { session, isActive, clear };
}
