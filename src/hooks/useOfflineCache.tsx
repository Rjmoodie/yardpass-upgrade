import { useState, useEffect, useCallback } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface OfflineCacheOptions {
  expiryMinutes?: number;
  maxItems?: number;
}

export function useOfflineCache<T>(
  key: string, 
  options: OfflineCacheOptions = {}
) {
  const { expiryMinutes = 60, maxItems = 100 } = options;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cache, setCache] = useState<Map<string, CacheItem<T>>>(new Map());

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`offline_cache_${key}`);
      if (stored) {
        const parsedCache = new Map(JSON.parse(stored));
        setCache(parsedCache as Map<string, CacheItem<T>>);
      }
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
    }
  }, [key]);

  // Save cache to localStorage when it changes
  useEffect(() => {
    try {
      const cacheArray = Array.from(cache.entries());
      localStorage.setItem(`offline_cache_${key}`, JSON.stringify(cacheArray));
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }, [cache, key]);

  const set = useCallback((itemKey: string, data: T) => {
    const now = Date.now();
    const expiry = now + (expiryMinutes * 60 * 1000);

    setCache(prev => {
      const newCache = new Map(prev);
      newCache.set(itemKey, { data, timestamp: now, expiry });

      // Remove expired items
      for (const [key, item] of newCache.entries()) {
        if (item.expiry < now) {
          newCache.delete(key);
        }
      }

      // Limit cache size
      if (newCache.size > maxItems) {
        const entries = Array.from(newCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, newCache.size - maxItems);
        toRemove.forEach(([key]) => newCache.delete(key));
      }

      return newCache;
    });
  }, [expiryMinutes, maxItems]);

  const get = useCallback((itemKey: string): T | null => {
    const item = cache.get(itemKey);
    if (!item) return null;

    const now = Date.now();
    if (item.expiry < now) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(itemKey);
        return newCache;
      });
      return null;
    }

    return item.data;
  }, [cache]);

  const has = useCallback((itemKey: string): boolean => {
    const item = cache.get(itemKey);
    if (!item) return false;

    const now = Date.now();
    if (item.expiry < now) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(itemKey);
        return newCache;
      });
      return false;
    }

    return true;
  }, [cache]);

  const clear = useCallback(() => {
    setCache(new Map());
    localStorage.removeItem(`offline_cache_${key}`);
  }, [key]);

  const clearExpired = useCallback(() => {
    const now = Date.now();
    setCache(prev => {
      const newCache = new Map(prev);
      for (const [key, item] of newCache.entries()) {
        if (item.expiry < now) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
  }, []);

  return {
    isOnline,
    set,
    get,
    has,
    clear,
    clearExpired,
    cacheSize: cache.size
  };
}

// Hook for caching tickets specifically
interface CachedTicket {
  id: string;
  event_id: string;
  tier_id: string;
  user_id: string;
  status: string;
  created_at: string;
  events?: {
    title: string;
    date: string;
  };
  ticket_tiers?: {
    name: string;
    price_cents: number;
  };
}

export function useTicketCache() {
  const cache = useOfflineCache<CachedTicket>('tickets', { 
    expiryMinutes: 120, // 2 hours
    maxItems: 50 
  });

  const cacheTicket = useCallback((ticket: CachedTicket) => {
    cache.set(`ticket_${ticket.id}`, ticket);
  }, [cache]);

  const getCachedTicket = useCallback((ticketId: string) => {
    return cache.get(`ticket_${ticketId}`);
  }, [cache]);

  const cacheTicketList = useCallback((tickets: CachedTicket[]) => {
    cache.set('ticket_list', tickets as any);
    tickets.forEach(ticket => cacheTicket(ticket));
  }, [cache, cacheTicket]);

  const getCachedTicketList = useCallback(() => {
    return cache.get('ticket_list') || [];
  }, [cache]);

  return {
    ...cache,
    cacheTicket,
    getCachedTicket,
    cacheTicketList,
    getCachedTicketList
  };
}
