import { useCallback, useEffect, useMemo, useState } from 'react';

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

const persist = (value: GuestSession | null) => {
  try {
    if (!value) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(value));
    }
  } catch {
    // no-op
  }
};

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
    persist(null);
    setSession(null);
  };

  const set = useCallback((value: GuestSession | null) => {
    persist(value);
    setSession(value);
  }, []);

  const update = useCallback(
    (updater: (current: GuestSession | null) => GuestSession | null) => {
      setSession((current) => {
        const next = updater(current);
        persist(next);
        return next;
      });
    },
    [],
  );

  const isActive = useMemo(() => !!session, [session]);

  return { session, isActive, clear, set, update };
}
