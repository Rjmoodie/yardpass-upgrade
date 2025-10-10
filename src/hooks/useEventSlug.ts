import { useMemo } from 'react';
import { generateEventSlug, beautifySlug } from '@/lib/eventSlug';

export type EventRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  start_at: string | null;
  end_at: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  address?: string | null;
  lat: number | null;
  lng: number | null;
  cover_image_url: string | null;
  owner_context_type: 'organization' | 'individual';
  owner_context_id: string;
  created_by: string;
  visibility: 'public' | 'unlisted' | 'private';
  link_token?: string | null;
  organizations?: {
    id: string;
    name: string;
    handle: string | null;
    logo_url: string | null;
  } | null;
  creator?: {
    user_id: string;
    display_name: string | null;
    photo_url: string | null;
  } | null;
};

export type UseEventSlugOptions = {
  /** If true, prefer the short form (title + city/venue only) */
  preferShort?: boolean;
  /** Clamp max length of generated slugs (defaults to 100) */
  maxLength?: number;
  /** If a custom slug already exists on the event, still generate suggestions */
  alwaysSuggest?: boolean;
};

/**
 * Hook to generate and manage event slugs in a stable, dependency-friendly way.
 * - Uses only the fields relevant to slug generation in deps to avoid extra renders
 * - Exposes current, beautified, and short variants
 * - Returns helpful flags and a canonical path helper
 */
export function useEventSlug(event: EventRow | null, options: UseEventSlugOptions = {}) {
  const { preferShort = false, maxLength = 100, alwaysSuggest = false } = options;

  // Derive only the inputs that influence the slug — keeps memo deps minimal/stable.
  const inputs = useMemo(
    () => ({
      title: event?.title || 'Untitled Event',
      venue: event?.venue || null,
      city: event?.city || null,
      startDate: event?.start_at || null,
      category: event?.category || null,
      existing: event?.slug || null,
      id: event?.id || null,
      visibility: event?.visibility || 'public',
      linkToken: event?.link_token || null,
    }),
    [event?.title, event?.venue, event?.city, event?.start_at, event?.category, event?.slug, event?.id, event?.visibility, event?.link_token]
  );

  // Full suggestion (includes date/category when available)
  const generated = useMemo(() => {
    const slug = generateEventSlug({
      title: inputs.title,
      venue: inputs.venue || undefined,
      city: inputs.city || undefined,
      startDate: inputs.startDate || undefined,
      category: inputs.category || undefined,
    });
    return slug ? slug.slice(0, maxLength) : null;
  }, [inputs.title, inputs.venue, inputs.city, inputs.startDate, inputs.category, maxLength]);

  // Short suggestion (omit date/category)
  const short = useMemo(() => {
    const slug = generateEventSlug({
      title: inputs.title,
      venue: inputs.venue || undefined,
      city: inputs.city || undefined,
    });
    return slug ? slug.slice(0, maxLength) : null;
  }, [inputs.title, inputs.venue, inputs.city, maxLength]);

  // Choose a primary suggestion to display (short or full)
  const primarySuggestion = preferShort ? short : generated;

  // If the event already has a slug, expose it — and optionally still provide suggestions.
  const hasCustom = Boolean(inputs.existing);
  const slug = useMemo(() => {
    if (hasCustom && !alwaysSuggest) return inputs.existing as string;
    return primarySuggestion || inputs.existing || '';
  }, [hasCustom, primarySuggestion, inputs.existing]);

  const beautifiedSlug = useMemo(() => (slug ? beautifySlug(slug) : null), [slug]);

  const isValid = useMemo(() => Boolean(slug && slug.length > 0 && slug.length <= maxLength), [slug, maxLength]);

  /** Useful for linking to the event (handles slug or id + token for unlisted) */
  const buildPath = useMemo(() => {
    return (override?: string | null) => {
      const base = override ?? inputs.existing ?? (event?.slug ?? null);
      const idOrSlug = base || inputs.id || '';
      const token = inputs.visibility === 'unlisted' && inputs.linkToken ? `?k=${inputs.linkToken}` : '';
      return `/e/${idOrSlug}${token}`;
    };
  }, [inputs.existing, inputs.id, inputs.visibility, inputs.linkToken, event?.slug]);

  return {
    // The slug we propose to use/display
    slug,
    // A pretty version for UI (spaced/capitalized)
    beautifiedSlug,
    // Alternative suggestion without date/category
    shortSlug: short,
    // Also return the full-length suggestion in case the caller wants it
    fullSlug: generated,
    // Flags
    isValid,
    hasCustom,
    // Path helper
    buildPath,
  } as const;
}
