import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS headers (inlined to avoid import issues)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

/**
 * OG Preview Edge Function
 * 
 * Returns server-rendered HTML with Open Graph and Twitter Card meta tags
 * for social media crawlers (WhatsApp, iMessage, Twitter, Facebook, etc.)
 * 
 * IMPORTANT: This endpoint is for crawlers only. Normal browsers are redirected
 * to the canonical URL (/e/{id} or /post/{id}).
 * 
 * Usage:
 * - Events: /og-preview?type=event&id={event_id}
 * - Posts: /og-preview?type=post&id={post_id}
 */

// Known crawler user agents
const CRAWLER_PATTERNS = [
  /facebookexternalhit/i,
  /Facebot/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /WhatsApp/i,
  /Applebot/i,
  /Googlebot/i,
  /bingbot/i,
  /Slackbot/i,
  /SkypeUriPreview/i,
  /Discordbot/i,
  /TelegramBot/i,
  /Slurp/i,
  /DuckDuckBot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /Sogou/i,
  /Exabot/i,
  /ia_archiver/i,
];

/**
 * Check if the request is from a known crawler
 */
function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return CRAWLER_PATTERNS.some(pattern => pattern.test(userAgent));
}

/**
 * Build OG payload from event data (mirrors src/types/og.ts)
 */
function buildEventOgPayload(event: any) {
  const eventUrl = `https://liventix.tech/e/${event.id}`;
  const coverImage = event.cover_image_url || 'https://liventix.tech/og-image.jpg';
  
  const organizerName = event.owner_context_type === 'organization'
    ? event.organizations?.name || 'Organization'
    : event.user_profiles?.display_name || 'Organizer';
  
  const location = event.venue
    ? `${event.venue}${event.address ? ', ' + event.address : ''}${event.city ? ', ' + event.city : ''}`
    : event.address || 'Location TBA';
  
  const description = event.description
    ? event.description.slice(0, 200) + (event.description.length > 200 ? '...' : '')
    : `Join ${organizerName} for ${event.title} at ${location}`;

  // Normalize dates to ISO 8601 UTC
  const normalizeDate = (date: string | null | undefined): string | undefined => {
    if (!date) return undefined;
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString();
    } catch {
      return undefined;
    }
  };

  return {
    title: `${event.title} | Liventix`,
    description,
    image: coverImage,
    url: eventUrl,
    type: 'article',
    siteName: 'Liventix',
    locale: 'en_US',
    imageWidth: 1200,
    imageHeight: 630,
    imageType: 'image/jpeg',
    eventStartTime: normalizeDate(event.start_at),
    eventEndTime: normalizeDate(event.end_at),
    eventLocation: location,
    twitterCard: 'summary_large_image',
  };
}

/**
 * Build OG payload from post data (mirrors src/types/og.ts)
 */
function buildPostOgPayload(post: any) {
  const postUrl = `https://liventix.tech/post/${post.id}`;
  const event = post.events;
  const author = post.user_profiles;
  
  const mediaUrls = (post.media_urls as string[]) || [];
  const firstImage = mediaUrls.find((url: string) => url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) || 
                     event?.cover_image_url || 
                     'https://liventix.tech/og-image.jpg';

  const title = event 
    ? `${author?.display_name || 'User'}'s post about ${event.title}` 
    : `${author?.display_name || 'User'}'s post`;
  
  const description = post.text
    ? post.text.slice(0, 200) + (post.text.length > 200 ? '...' : '')
    : `Check out this post${event ? ` about ${event.title}` : ''} on Liventix`;

  const normalizeDate = (date: string | null | undefined): string | undefined => {
    if (!date) return undefined;
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString();
    } catch {
      return undefined;
    }
  };

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
    publishedTime: normalizeDate(post.created_at),
    twitterCard: 'summary_large_image',
  };
}

/**
 * Render HTML from OG payload
 */
function renderOgHtml(payload: any, canonicalUrl: string) {
  // Safely access optional properties
  const eventStartTime = (payload as any).eventStartTime;
  const eventEndTime = (payload as any).eventEndTime;
  const publishedTime = (payload as any).publishedTime;
  const author = (payload as any).author;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.title}</title>
  
  <!-- Canonical URL (always points to user-facing URL, not /og-preview) -->
  <link rel="canonical" href="${canonicalUrl}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${payload.type || 'article'}" />
  <meta property="og:url" content="${payload.url}" />
  <meta property="og:title" content="${payload.title}" />
  <meta property="og:description" content="${payload.description}" />
  <meta property="og:image" content="${payload.image}" />
  <meta property="og:image:width" content="${payload.imageWidth || 1200}" />
  <meta property="og:image:height" content="${payload.imageHeight || 630}" />
  <meta property="og:image:type" content="${payload.imageType || 'image/jpeg'}" />
  <meta property="og:site_name" content="${payload.siteName || 'Liventix'}" />
  <meta property="og:locale" content="${payload.locale || 'en_US'}" />
  ${eventStartTime ? `<meta property="article:published_time" content="${eventStartTime}" />` : ''}
  ${eventEndTime ? `<meta property="article:modified_time" content="${eventEndTime}" />` : ''}
  ${publishedTime ? `<meta property="article:published_time" content="${publishedTime}" />` : ''}
  ${author ? `<meta property="article:author" content="${author}" />` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="${payload.twitterCard || 'summary_large_image'}" />
  <meta name="twitter:title" content="${payload.title}" />
  <meta name="twitter:description" content="${payload.description}" />
  <meta name="twitter:image" content="${payload.image}" />
  
  <!-- Additional meta -->
  <meta name="description" content="${payload.description}" />
  
  <!-- Redirect to actual page for non-crawlers (crawlers ignore this) -->
  <meta http-equiv="refresh" content="0; url=${canonicalUrl}" />
</head>
<body>
  <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
    <h1>${payload.title.replace(' | Liventix', '')}</h1>
    <p>${payload.description}</p>
    <p><a href="${canonicalUrl}">View on Liventix →</a></p>
  </div>
</body>
</html>`;
}

/**
 * Default OG payload for fallback/error cases
 */
const DEFAULT_OG_PAYLOAD = {
  title: 'Liventix - Live Event Tickets',
  description: 'Buy tickets to live events, concerts, parties, and experiences. Discover, attend, and share unforgettable moments with Liventix.',
  image: 'https://liventix.tech/og-image.jpg',
  url: 'https://liventix.tech',
  type: 'website' as const,
  siteName: 'Liventix',
  locale: 'en_US',
  imageWidth: 1200,
  imageHeight: 630,
  imageType: 'image/jpeg',
  twitterCard: 'summary_large_image' as const,
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userAgent = req.headers.get('user-agent');
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // 'event' or 'post'
    const id = url.searchParams.get('id');

    // If no type/id, return default OG page
    if (!type || !id) {
      const html = renderOgHtml(DEFAULT_OG_PAYLOAD, 'https://liventix.tech');
      return new Response(html, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Determine canonical URL
    const canonicalUrl = type === 'event' 
      ? `https://liventix.tech/e/${id}`
      : `https://liventix.tech/post/${id}`;

    // If NOT a crawler, redirect to canonical URL
    if (!isCrawler(userAgent)) {
      return new Response(null, {
        status: 307, // Temporary redirect
        headers: {
          ...corsHeaders,
          'Location': canonicalUrl,
        },
      });
    }

    // For crawlers, fetch data and render OG HTML
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    if (type === 'event') {
      // Fetch event details
      const { data: event, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          cover_image_url,
          start_at,
          end_at,
          venue,
          address,
          city,
          country,
          owner_context_type,
          owner_context_id,
          organizations(name, logo_url),
          user_profiles(display_name, photo_url)
        `)
        .eq('id', id)
        .single();

      if (error || !event) {
        // Return default OG with 404 status (still has OG tags to avoid broken preview)
        const html = renderOgHtml(DEFAULT_OG_PAYLOAD, canonicalUrl);
        return new Response(html, {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const ogPayload = buildEventOgPayload(event);
      const html = renderOgHtml(ogPayload, canonicalUrl);

      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    } else if (type === 'post') {
      // Fetch post details
      const { data: post, error } = await supabase
        .from('event_posts')
        .select(`
          id,
          text,
          media_urls,
          created_at,
          author_user_id,
          event_id,
          events(id, title, cover_image_url),
          user_profiles(display_name, photo_url)
        `)
        .eq('id', id)
        .single();

      if (error || !post) {
        // Return default OG with 404 status
        const html = renderOgHtml(DEFAULT_OG_PAYLOAD, canonicalUrl);
        return new Response(html, {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const ogPayload = buildPostOgPayload(post);
      const html = renderOgHtml(ogPayload, canonicalUrl);

      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    } else {
      const html = renderOgHtml(DEFAULT_OG_PAYLOAD, canonicalUrl);
      return new Response(html, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (error) {
    console.error('OG Preview error:', error);
    const html = renderOgHtml(DEFAULT_OG_PAYLOAD, 'https://liventix.tech');
    return new Response(html, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});
