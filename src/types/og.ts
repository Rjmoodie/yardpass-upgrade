/**
 * Shared Open Graph payload type
 * 
 * Single source of truth for OG metadata across:
 * - Client-side meta tag updates (updateMetaTags)
 * - Server-side OG preview Edge Function
 * 
 * This ensures consistency between in-app previews and social media crawlers.
 */

export interface OgPayload {
  // Required fields
  title: string;
  description: string;
  image: string;
  url: string;
  
  // Image metadata
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
  
  // Basic OG fields
  type?: 'website' | 'article' | 'event';
  siteName?: string;
  locale?: string;
  
  // Event-specific fields
  eventStartTime?: string; // ISO 8601 UTC string
  eventEndTime?: string; // ISO 8601 UTC string
  eventLocation?: string;
  
  // Article-specific fields
  author?: string;
  publishedTime?: string; // ISO 8601 UTC string
  modifiedTime?: string; // ISO 8601 UTC string
  
  // Twitter-specific fields
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterSite?: string;
  twitterCreator?: string;
}

/**
 * Default OG payload for fallback/error cases
 */
export const DEFAULT_OG_PAYLOAD: OgPayload = {
  title: 'Liventix - Live Event Tickets',
  description: 'Buy tickets to live events, concerts, parties, and experiences. Discover, attend, and share unforgettable moments with Liventix.',
  image: 'https://liventix.tech/og-image.jpg',
  url: 'https://liventix.tech',
  type: 'website',
  siteName: 'Liventix',
  locale: 'en_US',
  imageWidth: 1200,
  imageHeight: 630,
  imageType: 'image/jpeg',
  twitterCard: 'summary_large_image',
};

/**
 * Normalize a date to ISO 8601 UTC string
 * Handles timezone conversion and ensures consistent format
 */
export function normalizeToIsoUtc(date: string | Date | null | undefined): string | undefined {
  if (!date) return undefined;
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Build OG payload from event data
 */
export function buildEventOgPayload(event: {
  id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  owner_context_type?: 'user' | 'organization';
  organizations?: { name?: string | null } | null;
  user_profiles?: { display_name?: string | null } | null;
}): OgPayload {
  const eventUrl = `https://liventix.tech/e/${event.id}`;
  const coverImage = event.cover_image_url || DEFAULT_OG_PAYLOAD.image;
  
  // Build description
  const organizerName = event.owner_context_type === 'organization'
    ? event.organizations?.name || 'Organization'
    : event.user_profiles?.display_name || 'Organizer';
  
  const location = event.venue
    ? `${event.venue}${event.address ? ', ' + event.address : ''}${event.city ? ', ' + event.city : ''}`
    : event.address || 'Location TBA';
  
  const description = event.description
    ? event.description.slice(0, 200) + (event.description.length > 200 ? '...' : '')
    : `Join ${organizerName} for ${event.title} at ${location}`;

  return {
    title: `${event.title} | Liventix`,
    description,
    image: coverImage,
    url: eventUrl,
    type: 'article', // Using 'article' for events (better compatibility)
    siteName: 'Liventix',
    locale: 'en_US',
    imageWidth: 1200,
    imageHeight: 630,
    imageType: 'image/jpeg',
    eventStartTime: normalizeToIsoUtc(event.start_at),
    eventEndTime: normalizeToIsoUtc(event.end_at),
    eventLocation: location,
    twitterCard: 'summary_large_image',
  };
}

/**
 * Build OG payload from post data
 */
export function buildPostOgPayload(post: {
  id: string;
  text?: string | null;
  media_urls?: string[] | null;
  created_at?: string | null;
  author_user_id?: string | null;
  event_id?: string | null;
  events?: { id?: string; title?: string | null; cover_image_url?: string | null } | null;
  user_profiles?: { display_name?: string | null; photo_url?: string | null } | null;
}): OgPayload {
  const postUrl = `https://liventix.tech/post/${post.id}`;
  const event = post.events;
  const author = post.user_profiles;
  
  // Find first image from media or use event cover
  const mediaUrls = (post.media_urls as string[]) || [];
  const firstImage = mediaUrls.find(url => url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) || 
                     event?.cover_image_url || 
                     DEFAULT_OG_PAYLOAD.image;

  const title = event 
    ? `${author?.display_name || 'User'}'s post about ${event.title}` 
    : `${author?.display_name || 'User'}'s post`;
  
  const description = post.text
    ? post.text.slice(0, 200) + (post.text.length > 200 ? '...' : '')
    : `Check out this post${event ? ` about ${event.title}` : ''} on Liventix`;

  return {
    title: `${title} | Liventix`,
    description,
    image: firstImage,
    url: postUrl,
    type: 'article',
    siteName: 'Liventix',
    locale: 'en_US',
    imageWidth: 1200,
    imageHeight: 630,
    imageType: 'image/jpeg',
    author: author?.display_name || undefined,
    publishedTime: normalizeToIsoUtc(post.created_at),
    twitterCard: 'summary_large_image',
  };
}

