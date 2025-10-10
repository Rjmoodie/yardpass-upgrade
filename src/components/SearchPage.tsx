import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Search, X, SlidersHorizontal, Calendar as CalendarIcon, Star, Sparkles, MapPin, LocateFixed } from 'lucide-react';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, isSameDay, nextSaturday, nextSunday } from 'date-fns';
import { cn } from '@/lib/utils';
import { FilterChip } from './search/FilterChip';
import { EventCard } from './search/EventCard';
import { SkeletonGrid, EmptyState } from './search/SearchPageComponents';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { useCampaignBoosts } from '@/hooks/useCampaignBoosts';
import { canServeCampaign, logAdClick, logAdImpression } from '@/lib/adTracking';

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (eventId: string) => void;
}

const categories = [
  'All', 'Music', 'Food & Drink', 'Art & Culture', 'Sports & Fitness', 
  'Business & Professional', 'Community', 'Technology', 'Other'
];

// ————————————————————————————————————————
// Mock fallback (unchanged)
// ————————————————————————————————————————
const mockSearchResults = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    description: 'Three days of incredible music with top artists',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    date: 'July 15, 2025',
    location: 'Central Park, NYC',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 1243,
    priceFrom: 89,
    rating: 4.8,
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world',
    organizer: 'Foodie Adventures',
    organizerId: '102',
    category: 'Food & Drink',
    date: 'August 8, 2025',
    location: 'Brooklyn Bridge Park',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 567,
    priceFrom: 25,
    rating: 4.6,
  },
  {
    id: '3',
    title: 'Contemporary Art Showcase',
    description: 'Discover emerging artists and groundbreaking installations',
    organizer: 'Modern Gallery NYC',
    organizerId: '103',
    category: 'Art & Culture',
    date: 'September 2, 2025',
    location: 'SoHo Art District',
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 298,
    priceFrom: 35,
    rating: 4.9,
  }
];

const LOCATION_UNKNOWN = 'Location TBD';
const EARTH_RADIUS_KM = 6371;

type LocationDetails = {
  full: string;
  short: string;
  display: string;
  city: string | null;
  state: string | null;
  country: string | null;
  isVirtual: boolean;
  keywords: string[];
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function parseLocationLabel(raw: string | null | undefined): LocationDetails {
  if (!raw || !raw.trim()) {
    return {
      full: LOCATION_UNKNOWN,
      short: LOCATION_UNKNOWN,
      display: LOCATION_UNKNOWN,
      city: null,
      state: null,
      country: null,
      isVirtual: false,
      keywords: [],
    };
  }

  const trimmed = raw.trim();
  const isVirtual = /(online|virtual|remote|livestream|webinar)/i.test(trimmed);
  const cleaned = trimmed
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*\|.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const segments = cleaned
    .split(/[•\-]/)
    .map((segment) => segment.split(',').map((part) => part.trim()))
    .flat()
    .map((segment) => segment.trim())
    .filter(Boolean);

  const city = segments[0] ?? null;
  const state = segments.length > 1 ? segments[1] ?? null : null;
  const country = segments.length > 2 ? segments[segments.length - 1] ?? null : null;
  const short = isVirtual
    ? 'Online event'
    : segments.slice(0, Math.min(2, segments.length)).join(', ') || cleaned;
  const display = isVirtual
    ? 'Online / Virtual'
    : [city, state].filter(Boolean).join(', ') || short || LOCATION_UNKNOWN;

  const keywordSet = new Set<string>();
  segments.forEach((segment) => {
    if (segment) keywordSet.add(segment.toLowerCase());
  });
  if (isVirtual) {
    keywordSet.add('online');
    keywordSet.add('virtual');
  }

  return {
    full: trimmed,
    short,
    display,
    city,
    state,
    country,
    isVirtual,
    keywords: Array.from(keywordSet),
  };
}

const LOCAL_RECENT_KEY = 'yp_recent_searches';

export default function SearchPage({ onBack, onEventSelect }: SearchPageProps) {
  const { trackEvent } = useAnalyticsIntegration();
  const { user } = useAuth();
  const { data: recommendations, loading: recLoading, error: recError } = useRecommendations(user?.id, 8);
  const { trackInteraction } = useInteractionTracking();
  const { data: searchBoosts = [] } = useCampaignBoosts({
    placement: 'search_results',
    limit: 8,
    userId: user?.id ?? null,
  });

  // URL-synced state
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const cat = params.get('cat') || 'All';
  const city = params.get('city') || '';
  const sort = (params.get('sort') || 'date_asc') as 'date_asc'|'price_asc'|'price_desc'|'attendees_desc';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const latParam = params.get('lat');
  const lngParam = params.get('lng');
  const radiusParam = params.get('radius');
  const locationLabelParam = params.get('locLabel') || '';

  // recent searches
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_RECENT_KEY) || '[]'); } catch { return []; }
  });
  const pushRecent = useCallback((s: string) => {
    if (!s.trim()) return;
    const next = [s.trim(), ...recent.filter(i => i.trim() !== s.trim())].slice(0, 8);
    setRecent(next);
    localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
  }, [recent]);
  const removeRecent = useCallback((s: string) => {
    const next = recent.filter(i => i !== s);
    setRecent(next);
    localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
  }, [recent]);

  // Use the smart search hook instead of custom logic
  const {
    q: searchQuery,
    setQ: setSearchQuery,
    filters,
    setFilters,
    clearFilters,
    results: searchResults,
    loading,
    isInitialLoading,
    error,
    hasMore,
    loadMore,
    totalFetched,
    lastUpdatedAt,
    retry,
    isStale,
  } = useSmartSearch({
    initialQuery: '',
    initialFilters: { onlyEvents: true },
    minimumQueryLength: 2,
    pageSize: 24,
  });

  const [showFilters, setShowFilters] = useState(false);

  const near = useMemo(() => {
    if (!latParam || !lngParam) return null;
    const lat = Number(latParam);
    const lng = Number(lngParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const radius = radiusParam ? Number(radiusParam) : 50;
    const radiusKm = Number.isFinite(radius) && radius > 0 ? radius : 50;
    return { lat, lng, radiusKm };
  }, [latParam, lngParam, radiusParam]);

  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocationLabel, setUserLocationLabel] = useState(locationLabelParam);

  useEffect(() => {
    setUserLocationLabel(locationLabelParam);
  }, [locationLabelParam]);

  // Sync URL params with search hook
  useEffect(() => {
    setSearchQuery(q);
  }, [q, setSearchQuery]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      category: cat !== 'All' ? cat : null,
      dateFrom: from || null,
      dateTo: to || null,
      city: city || null,
      near,
      onlyEvents: true, // Filter to events only at the source
      location: city || null, // Add location filter
    });
  }, [cat, from, to, city, setFilters]);

  // Keep only true events (ignore event_posts, orgs, etc.)
  const eventHits = useMemo(() => {
    return (searchResults || []).filter(r =>
      r.item_type === 'event' && r.item_id
    );
  }, [searchResults]);

  // Verify event pages exist & are public
  const [validEventIds, setValidEventIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = Array.from(new Set(
      eventHits.map(h => h.item_id).filter(Boolean)
    ));
    if (ids.length === 0) {
      setValidEventIds(new Set());
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, visibility')
        .in('id', ids);

      if (cancelled) return;
      if (error) {
        console.warn('verify events failed:', error);
        // fallback: allow all ids
        setValidEventIds(new Set(ids));
        return;
      }

      const allowed = new Set(
        (data || [])
          .filter(e => e.visibility === 'public')
          .map(e => e.id)
      );
      setValidEventIds(allowed);
    })();

    return () => { cancelled = true; };
  }, [eventHits]);

  // Transform verified events only
  const transformedResults = useMemo(() => {
    const rows = eventHits.filter(h => validEventIds.has(h.item_id));
    return rows.map(result => {
      const locationDetails = parseLocationLabel(result.location);
      const rawLat = (result as any).latitude ?? (result as any).lat ?? (result as any).geo_lat ?? (result as any).geoLatitude ?? null;
      const rawLng = (result as any).longitude ?? (result as any).lng ?? (result as any).geo_lng ?? (result as any).geoLongitude ?? null;
      const baseDistance =
        (result as any).distance_km ??
        (result as any).distanceKm ??
        ((result as any).distance_meters ? (result as any).distance_meters / 1000 : null);

      return {
        id: result.item_id,
        title: result.title,
        description: result.description || result.content || '',
        organizer: result.organizer_name || 'Organizer',
        organizerId: result.item_id,
        category: result.category || 'Other',
        date: result.start_at
          ? new Date(result.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'TBA',
        start_at: result.start_at,
        location: locationDetails.display,
        locationDetails,
        latitude: typeof rawLat === 'number' ? rawLat : null,
        longitude: typeof rawLng === 'number' ? rawLng : null,
        distance_km: typeof baseDistance === 'number' ? baseDistance : null,
        coverImage:
          result.cover_image_url ||
          'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60',
        attendeeCount: undefined, // TODO: get real metrics
        priceFrom: undefined,     // TODO: get real pricing
        rating: 4.2,
        type: 'event',
        parentEventId: null,
        isVirtual: locationDetails.isVirtual,
      };
    });
  }, [eventHits, validEventIds]);

  // Client-side filtering for price (until server-side is implemented)
  const filteredResults = useMemo(() => {
    const nearFilter = near;
    const withDistance = transformedResults.map((event) => {
      let computedDistance = typeof event.distance_km === 'number' ? event.distance_km : null;
      if (
        nearFilter &&
        typeof event.latitude === 'number' &&
        typeof event.longitude === 'number'
      ) {
        computedDistance = calculateDistanceKm(
          nearFilter.lat,
          nearFilter.lng,
          event.latitude,
          event.longitude,
        );
      }
      return { ...event, distance_km: computedDistance };
    });

    let filtered = [...withDistance];

    if (min) filtered = filtered.filter(e => (e.priceFrom ?? 0) >= Number(min));
    if (max) filtered = filtered.filter(e => (e.priceFrom ?? 1e9) <= Number(max));

    // Location filtering is now handled at the database level

    filtered.sort((a, b) => {
      if (sort === 'price_asc') {
        return (a.priceFrom ?? Number.POSITIVE_INFINITY) - (b.priceFrom ?? Number.POSITIVE_INFINITY);
      }
      if (sort === 'price_desc') {
        return (b.priceFrom ?? Number.NEGATIVE_INFINITY) - (a.priceFrom ?? Number.NEGATIVE_INFINITY);
      }
      if (sort === 'attendees_desc') {
        return (b.attendeeCount ?? 0) - (a.attendeeCount ?? 0);
      }
      if (nearFilter) {
        const distA = typeof a.distance_km === 'number' ? a.distance_km : Number.POSITIVE_INFINITY;
        const distB = typeof b.distance_km === 'number' ? b.distance_km : Number.POSITIVE_INFINITY;
        if (distA !== distB) return distA - distB;
      }
      const dateA = a.start_at ? new Date(a.start_at).getTime() : Number.POSITIVE_INFINITY;
      const dateB = b.start_at ? new Date(b.start_at).getTime() : Number.POSITIVE_INFINITY;
      return dateA - dateB;
    });

    return filtered;
  }, [transformedResults, min, max, sort]);

  const boostedResults = useMemo(() => {
    return (searchBoosts ?? [])
      .filter((row) => row && row.event_id)
      .map((row) => {
        const locationDetails = parseLocationLabel(row.event_location ?? row.event_city ?? row.event_region ?? null);
        const rawLat = (row as any).event_latitude ?? (row as any).latitude ?? null;
        const rawLng = (row as any).event_longitude ?? (row as any).longitude ?? null;
        return {
          id: row.event_id,
          title: row.event_title ?? row.headline ?? 'Promoted Event',
          description: row.event_description ?? row.body_text ?? '',
          organizer: row.organizer_name ?? 'Organizer',
          organizerId: row.organizer_id ?? row.event_id,
          category: row.event_category ?? 'Other',
          date: row.event_starts_at
            ? new Date(row.event_starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : 'TBA',
          start_at: row.event_starts_at,
          location: locationDetails.display,
          locationDetails,
          latitude: typeof rawLat === 'number' ? rawLat : null,
          longitude: typeof rawLng === 'number' ? rawLng : null,
          distance_km: null,
          coverImage:
            row.event_cover_image ??
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60',
          attendeeCount: undefined,
          priceFrom: undefined,
          rating: 4.6,
          isVirtual: locationDetails.isVirtual,
          promotion: {
          placement: 'search_results' as const,
          campaignId: row.campaign_id,
          creativeId: row.creative_id,
          objective: row.objective,
          ctaLabel: row.cta_label,
          ctaUrl: row.cta_url,
          headline: row.headline,
          priority: row.priority ?? 0,
          frequencyCapPerUser: row.frequency_cap_per_user,
          frequencyCapPeriod: row.frequency_cap_period,
          targeting: row.targeting,
          rateModel: row.default_rate_model,
          cpmRateCredits: row.cpm_rate_credits,
          cpcRateCredits: row.cpc_rate_credits,
          remainingCredits: row.remaining_credits,
          dailyRemainingCredits: row.daily_remaining,
        },
        };
      });
  }, [searchBoosts]);

  const augmentedResults = useMemo(() => {
    const map = new Map<string, any>(filteredResults.map((event) => [event.id, { ...event }]));

    for (const promo of boostedResults) {
      if (!promo?.id) continue;
      const matchesCategory = cat === 'All' || !promo.category || promo.category === cat;
      if (!matchesCategory) continue;
      if (
        !canServeCampaign(
          promo.promotion.campaignId,
          promo.promotion.frequencyCapPerUser,
          promo.promotion.frequencyCapPeriod,
        )
      ) {
        continue;
      }

      if (map.has(promo.id)) {
        const existing = map.get(promo.id)!;
        existing.promotion = promo.promotion;
      } else {
        map.set(promo.id, promo);
      }
    }

    const combined = Array.from(map.values());
    const enriched = combined.map((event) => {
      if (!near) return event;
      if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
        const computed = calculateDistanceKm(near.lat, near.lng, event.latitude, event.longitude);
        if (Number.isFinite(computed)) {
          return { ...event, distance_km: computed };
        }
      }
      return event;
    });
    const promoted = enriched
      .filter((event) => event.promotion)
      .sort((a, b) => (b.promotion?.priority ?? 0) - (a.promotion?.priority ?? 0));
    const organic = enriched.filter((event) => !event.promotion);
    return [...promoted, ...organic];
  }, [filteredResults, boostedResults, cat, near]);

  const locationSuggestions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; isVirtual: boolean }>();
    for (const event of augmentedResults) {
      const details: LocationDetails | undefined = event.locationDetails;
      if (!details) continue;
      if (!details.display || details.display === LOCATION_UNKNOWN) continue;
      const key = details.display.toLowerCase();
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
        entry.isVirtual = entry.isVirtual || details.isVirtual;
      } else {
        counts.set(key, { label: details.display, count: 1, isVirtual: details.isVirtual });
      }
    }

    const curated = [
      { label: 'Online / Virtual', isVirtual: true },
      { label: 'New York, NY', isVirtual: false },
      { label: 'Los Angeles, CA', isVirtual: false },
      { label: 'Austin, TX', isVirtual: false },
      { label: 'Chicago, IL', isVirtual: false },
      { label: 'Atlanta, GA', isVirtual: false },
    ];

    const trending = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .map(({ label, isVirtual }) => ({ label, isVirtual }));

    const combined = [...trending, ...curated];
    const result: { label: string; isVirtual: boolean }[] = [];
    const seen = new Set<string>();

    for (const item of combined) {
      const key = item.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (result.length >= 6) break;
    }

    return result;
  }, [augmentedResults]);

  // Pagination
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const loggedPromotionsRef = useRef<Set<string>>(new Set());

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [augmentedResults]);

  // infinite scroll sentinel
  useEffect(() => {
    if (!loaderRef.current) return;
    const el = loaderRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount((c) => {
          const next = Math.min(c + PAGE_SIZE, augmentedResults.length);
          if (next >= augmentedResults.length && hasMore && !loading) {
            // Request the next page from Supabase when we've exhausted the local slice
            setTimeout(() => {
              // Allow layout to expand before fetching to avoid thrash
              loadMore();
            }, 0);
          }
          return next;
        });
      }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [augmentedResults.length, hasMore, loading, loadMore]);

  // helpers to update url params succinctly
  const setNearLocation = useCallback((next: { lat: number; lng: number; radiusKm?: number; label?: string } | null) => {
    const nextParams = new URLSearchParams(params);
    const hadNear = Boolean(near);
    setLocationError(null);

    if (!next) {
      nextParams.delete('lat');
      nextParams.delete('lng');
      nextParams.delete('radius');
      nextParams.delete('locLabel');
      setUserLocationLabel('');
      setFilters((prev) => ({ ...prev, near: null }));
      if (hadNear) {
        trackEvent('search_filter_change', {
          filter_type: 'near',
          filter_value: '',
          query: q,
          category: cat,
          results_count: augmentedResults?.length || 0,
        });
      }
    } else {
      const radiusValue = next.radiusKm && Number.isFinite(next.radiusKm)
        ? Math.max(1, Math.round(next.radiusKm))
        : 50;
      nextParams.set('lat', next.lat.toFixed(4));
      nextParams.set('lng', next.lng.toFixed(4));
      nextParams.set('radius', String(radiusValue));
      if (next.label) {
        nextParams.set('locLabel', next.label);
        setUserLocationLabel(next.label);
      } else {
        nextParams.delete('locLabel');
        setUserLocationLabel('');
      }
      nextParams.delete('city');
      setFilters((prev) => ({
        ...prev,
        city: null,
        near: { lat: next.lat, lng: next.lng, radiusKm: radiusValue },
      }));
      trackEvent('search_filter_change', {
        filter_type: 'near',
        filter_value: `${next.lat.toFixed(4)},${next.lng.toFixed(4)}@${radiusValue}`,
        query: q,
        category: cat,
        results_count: augmentedResults?.length || 0,
      });
    }

    setParams(nextParams, { replace: true });
  }, [params, near, setParams, setFilters, trackEvent, q, cat, augmentedResults]);

  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params);
    if (v && v.length) next.set(k, v); else next.delete(k);

    // analytics (use safe access to avoid undefined reference)
    trackEvent('search_filter_change', {
      filter_type: k,
      filter_value: v || '',
      query: q,
      category: cat,
      results_count: augmentedResults?.length || 0
    });

    // recent searches (when editing the main query)
    if (k === 'q' && v !== undefined) {
      // push after small debounce
      window.setTimeout(() => pushRecent(v), 50);
    }

    setParams(next, { replace: true });
  };

  const requestCurrentLocation = useCallback(() => {
    if (!navigator?.geolocation) {
      setLocationError('Location detection is not supported in this browser.');
      trackEvent('search_location_error', {
        reason: 'unsupported',
        query: q,
        category: cat,
      });
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setLocationError('We could not determine your position. Try again in a moment.');
          return;
        }

        setNearLocation({
          lat: latitude,
          lng: longitude,
          radiusKm: near?.radiusKm ?? 50,
          label: 'Near you',
        });

        trackEvent('search_location_detected', {
          query: q,
          category: cat,
        });
      },
      (err) => {
        setIsLocating(false);
        const reason = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable';
        setLocationError(
          reason === 'denied'
            ? 'We need permission to find events near you.'
            : 'Unable to detect location right now. Try again soon.'
        );
        trackEvent('search_location_error', {
          reason,
          code: err.code,
          message: err.message,
          query: q,
          category: cat,
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [trackEvent, q, cat, near?.radiusKm, setNearLocation]);

  const handleRadiusChange = useCallback((radiusKm: number) => {
    if (!near) return;
    setNearLocation({
      lat: near.lat,
      lng: near.lng,
      radiusKm,
      label: userLocationLabel || 'Near you',
    });
  }, [near, setNearLocation, userLocationLabel]);

  const clearAll = () => {
    trackEvent('search_filters_clear', {
      previous_query: q,
      previous_category: cat,
      results_count: augmentedResults?.length || 0
    });
    setParams(new URLSearchParams(), { replace: true });
    setVisibleCount(PAGE_SIZE);
    clearFilters();
    setUserLocationLabel('');
  };

  // quick chips
  const setTonight = () => {
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(23,59,59,999);
    setParam('from', now.toISOString());
    setParam('to', midnight.toISOString());
  };
  const setWeekend = () => {
    const sat = nextSaturday(new Date());
    const sun = nextSunday(new Date(sat));
    const end = new Date(sun); end.setHours(23,59,59,999);
    setParam('from', sat.toISOString());
    setParam('to', end.toISOString());
  };
  const set30d = () => {
    const now = new Date();
    const in30 = new Date(now); in30.setDate(now.getDate() + 30);
    setParam('from', now.toISOString());
    setParam('to', in30.toISOString());
  };

  const handleRecommendationClick = (eventId: string) => {
    trackInteraction(eventId, 'event_view');
    onEventSelect(eventId);
  };

  const handleRecommendationTicketClick = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    trackInteraction(eventId, 'ticket_open');
    onEventSelect(eventId);
  };

  const handleResultClick = useCallback((event: any) => {
    if (event?.promotion) {
      void logAdClick(
        {
          campaignId: event.promotion.campaignId,
          creativeId: event.promotion.creativeId ?? null,
          eventId: event.id,
          placement: 'search_results',
        },
        { userId: user?.id ?? null },
      ).catch(() => undefined);
    }
    trackInteraction(event.id, 'event_view');
    onEventSelect(event.id);
  }, [onEventSelect, trackInteraction, user?.id]);

  const handleResultTicketClick = useCallback((event: any, eventId?: string) => {
    if (event?.promotion) {
      void logAdClick(
        {
          campaignId: event.promotion.campaignId,
          creativeId: event.promotion.creativeId ?? null,
          eventId: event.id,
          placement: 'search_results',
        },
        { userId: user?.id ?? null },
      ).catch(() => undefined);
      if (event.promotion.ctaUrl) {
        try {
          window.open(event.promotion.ctaUrl, '_blank', 'noopener');
        } catch (err) {
          console.warn('[search] failed to open CTA url', err);
        }
      }
    }
    trackInteraction(event.id, 'ticket_open');
    onEventSelect(eventId ?? event.id);
  }, [onEventSelect, trackInteraction, user?.id]);

  // keyboard shortcut: open focus on query ("/")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !(e.target as HTMLElement).isContentEditable) {
          e.preventDefault();
          const input = document.getElementById('search-query-input') as HTMLInputElement | null;
          input?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ————————————————————————————————————————
  // Render
  // ————————————————————————————————————————
  const visible = augmentedResults.slice(0, visibleCount);

  useEffect(() => {
    visible.forEach((event) => {
      if (!event?.promotion) return;
      const key = `${event.promotion.campaignId}:${event.promotion.creativeId ?? event.id}`;
      if (loggedPromotionsRef.current.has(key)) return;

      void logAdImpression(
        {
          campaignId: event.promotion.campaignId,
          creativeId: event.promotion.creativeId ?? null,
          eventId: event.id,
          placement: 'search_results',
        },
        {
          userId: user?.id ?? null,
          frequencyCap: {
            cap: event.promotion.frequencyCapPerUser,
            period: event.promotion.frequencyCapPeriod,
          },
        },
      ).catch(() => undefined);

      loggedPromotionsRef.current.add(key);
    });
  }, [visible, user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/80 bg-card/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center gap-3 text-muted-foreground/80">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full border border-transparent hover:border-border/60"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="sr-only">Back</span>
            </Button>
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">Discover</span>
          </div>

          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3 max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Find your next unforgettable event</h1>
              <p className="text-base text-muted-foreground">
                Explore curated experiences from organizers you love. Filter by location, timing, or vibe to surface the perfect match.
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1">
                  <Sparkles className="w-4 h-4 text-primary" /> Curated daily drops
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                  <Star className="w-4 h-4 text-primary/80" /> Trusted organizers worldwide
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="rounded-full border border-border/60 bg-background/70 px-4 py-2">
                {augmentedResults.length > 0 ? `${augmentedResults.length} events available` : 'Fresh events added hourly'}
              </div>
            </div>
          </div>

          {/* Search / controls */}
          <div className="mt-8 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm ring-1 ring-border/50 backdrop-blur-sm md:p-6">
            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-5">
                <label htmlFor="search-query-input" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search</label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search-query-input"
                    value={q}
                    onChange={(e) => setParam('q', e.target.value)}
                    placeholder="Search events, organizers, or locations (press / to focus)"
                    className="h-12 rounded-xl border-border/60 bg-background/70 pl-10 text-base transition-all focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</label>
                <Input
                  value={city}
                  onChange={(e) => setParam('city', e.target.value)}
                  placeholder="City or virtual"
                  className="mt-2 h-12 rounded-xl border-border/60 bg-background/70 text-base focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>

              <div className="md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'mt-2 h-12 w-full justify-start rounded-xl border-border/60 bg-background/70 text-base font-normal hover:bg-background',
                        !from && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2"/> {from ? format(new Date(from), 'MMM dd, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={from ? new Date(from) : undefined} onSelect={(d)=> setParam('from', d ? d.toISOString() : undefined)} className="p-2" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'mt-2 h-12 w-full justify-start rounded-xl border-border/60 bg-background/70 text-base font-normal hover:bg-background',
                        !to && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2"/> {to ? format(new Date(to), 'MMM dd, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={to ? new Date(to) : undefined} onSelect={(d)=> setParam('to', d ? d.toISOString() : undefined)} className="p-2" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="md:col-span-12 flex flex-wrap items-center gap-3 pt-2">
                <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
                  <SelectTrigger className="h-12 min-w-[200px] rounded-xl border-border/60 bg-background/70 text-base focus:ring-2 focus:ring-primary/40">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[200px]">
                    <SelectItem value="date_asc">Soonest first</SelectItem>
                    <SelectItem value="price_asc">Price · Low to High</SelectItem>
                    <SelectItem value="price_desc">Price · High to Low</SelectItem>
                    <SelectItem value="attendees_desc">Most popular</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1">Quick picks:</span>
                  <Button variant="secondary" size="sm" onClick={setTonight} className="rounded-full border border-transparent bg-secondary/60 text-secondary-foreground hover:bg-secondary/70">
                    Tonight
                  </Button>
                  <Button variant="secondary" size="sm" onClick={setWeekend} className="rounded-full border border-transparent bg-secondary/60 text-secondary-foreground hover:bg-secondary/70">
                    This weekend
                  </Button>
                  <Button variant="secondary" size="sm" onClick={set30d} className="rounded-full border border-transparent bg-secondary/60 text-secondary-foreground hover:bg-secondary/70">
                    Next 30 days
                  </Button>
                </div>

                <div className="flex-1" />

                <Popover open={showFilters} onOpenChange={setShowFilters}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-12 rounded-xl border-border/60 bg-background/70 px-5 text-base">
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      More filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="end">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Refine results</h3>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-muted-foreground">Clear all</Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)} className="h-8 w-8 p-0"><X className="w-4 h-4"/></Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Min price ($)</label>
                          <Input inputMode="numeric" value={min} onChange={(e)=>setParam('min', e.target.value)} placeholder="0" className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Max price ($)</label>
                          <Input inputMode="numeric" value={max} onChange={(e)=>setParam('max', e.target.value)} placeholder="Any" className="mt-1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('justify-start', !from && 'text-muted-foreground')}>
                              <CalendarIcon className="w-4 h-4 mr-2"/> {from ? format(new Date(from), 'MMM dd, yyyy') : 'From'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={from ? new Date(from) : undefined} onSelect={(d)=> setParam('from', d ? d.toISOString() : undefined)} className="p-2" />
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('justify-start', !to && 'text-muted-foreground')}>
                              <CalendarIcon className="w-4 h-4 mr-2"/> {to ? format(new Date(to), 'MMM dd, yyyy') : 'To'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={to ? new Date(to) : undefined} onSelect={(d)=> setParam('to', d ? d.toISOString() : undefined)} className="p-2" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {(q || city || min || max || from || to || (cat !== 'All')) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {cat !== 'All' && <FilterChip label={`Category: ${cat}`} onClear={()=>setParam('cat','All')} />}
                {q && <FilterChip label={`"${q}"`} onClear={()=>setParam('q')} />}
                {city && <FilterChip label={`City: ${city}`} onClear={()=>setParam('city')} />}
                {min && <FilterChip label={`Min $${min}`} onClear={()=>setParam('min')} />}
                {max && <FilterChip label={`Max $${max}`} onClear={()=>setParam('max')} />}
                {from && <FilterChip label={`From ${format(new Date(from),'MMM dd')}`} onClear={()=>setParam('from')} />}
                {to && <FilterChip label={`To ${format(new Date(to),'MMM dd')}`} onClear={()=>setParam('to')} />}
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-8">Reset</Button>
              </div>
            )}

            {!q && recent.length > 0 && (
              <div className="mt-4 border-t border-dashed border-border/60 pt-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent searches</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      onClick={() => setParam('q', r)}
                      aria-label={`Use recent search ${r}`}
                    >
                      {r}
                      <span
                        className="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); removeRecent(r); }}
                      >
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 pb-2">
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={cat === c ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('rounded-full border border-transparent px-4 py-1.5 text-sm transition-colors', cat === c ? 'shadow-sm' : 'border-border/60 hover:border-primary/40 hover:bg-primary/5')}
                  onClick={()=> setParam('cat', cat === c ? 'All' : c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* For You Recommendations Section */}
          {user && !recLoading && recommendations.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">For you</h2>
                <span className="text-sm text-muted-foreground">Based on your activity</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.slice(0, 6).map(rec => {
                  const locationDetails = parseLocationLabel(rec.venue || rec.city || rec.region || null);
                  const eventForCard = {
                    id: rec.event_id,
                    title: rec.title,
                    description: rec.description || `Join this ${rec.category || 'event'} and connect with others`,
                    category: rec.category,
                    start_at: rec.starts_at,
                    date: rec.starts_at,
                    location: locationDetails.display,
                    locationDetails,
                    latitude: typeof rec.latitude === 'number' ? rec.latitude : undefined,
                    longitude: typeof rec.longitude === 'number' ? rec.longitude : undefined,
                    distance_km: rec.distance_km ?? null,
                    coverImage: rec.cover_image_url || `/images/placeholders/event-cover-fallback.jpg`,
                    priceFrom: rec.min_price || undefined, // Use actual pricing data
                    rating: 4.2,
                    attendeeCount: undefined, // Don't show attending count as requested
                    isVirtual: locationDetails.isVirtual,
                  };

                  return (
                    <EventCard
                      key={rec.event_id}
                      event={eventForCard}
                      onClick={() => handleRecommendationClick(rec.event_id)}
                      onTicket={(eventId) => {
                        const e = new Event('click') as any;
                        e.stopPropagation = () => {};
                        handleRecommendationTicketClick(eventId, e);
                      }}
                      className="border-2 border-primary/20 hover:border-primary/40"
                    />
                  );
                })}
              </div>
              <div className="border-t mt-6 pt-6 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-xl font-semibold">
                  {city.trim() ? `Events in ${city}` : 'All Events'}
                </h2>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">We hit a snag while searching</p>
                  <p className="text-sm opacity-80">{error instanceof Error ? error.message : 'Please try again in a moment.'}</p>
                </div>
                <Button variant="outline" onClick={retry} className="border-destructive/40 text-destructive hover:bg-destructive/20">
                  Retry search
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {visible.length > 0 
                  ? `Showing ${visible.length} of ${augmentedResults.length} curated ${augmentedResults.length === 1 ? 'event' : 'events'}` 
                  : city.trim() 
                    ? `No events found in ${city}` 
                    : 'No events found yet'}
              </span>
              {totalFetched > augmentedResults.length && (
                <span className="rounded-full bg-muted px-2 py-0.5">{totalFetched} results fetched</span>
              )}
              {isStale && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-500">
                  Updating…
                </span>
              )}
              {lastUpdatedAt && !isStale && (
                <span>Updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}</span>
              )}
            </div>
            {loading && !isInitialLoading && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
                Refreshing results…
              </div>
            )}
          </div>

          {isInitialLoading ? (
            <SkeletonGrid />
          ) : augmentedResults.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {visible.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onClick={() => handleResultClick(e)}
                    onTicket={(eventId) => handleResultTicketClick(e, eventId)}
                  />
                ))}
              </div>
              {/* sentinel for infinite scroll */}
              {(visibleCount < augmentedResults.length || hasMore) && (
                <div ref={loaderRef} className="h-12 flex items-center justify-center text-muted-foreground">
                  {loading ? 'Loading more…' : hasMore ? 'Scroll to load more results' : 'You have reached the end'}
                </div>
              )}
              {hasMore && !loading && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={loadMore} className="min-w-[200px]">
                    Load more results
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
