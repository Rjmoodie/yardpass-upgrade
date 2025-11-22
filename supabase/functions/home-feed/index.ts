// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** ---------------------------
 *   UTILITY: Simple Hash for ETags
 * ---------------------------- */
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/** ---------------------------
 *   CORS HELPER (inlined to avoid import issues)
 * ---------------------------- */
type WithCORSOpts = { allowOrigins?: string[] };

function withCORS(
  handler: (req: Request) => Promise<Response>,
  opts: WithCORSOpts = {},
) {
  return async (req: Request) => {
    const origin = req.headers.get("Origin") || "";
    
    // Determine which origin to allow
    let allowOrigin = "*";
    if (opts.allowOrigins?.length) {
      const isAllowed = opts.allowOrigins.some(allowed => {
        if (allowed === origin) return true;
        // Support wildcard patterns like *.liventix.com
        if (allowed.includes("*")) {
          const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return false;
      });
      
      allowOrigin = isAllowed ? origin : "*";
    }

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key, if-none-match",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, headers });
  };
}

/** ---------------------------
 *   CONFIG & CONSTANTS
 * ---------------------------- */
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;
const CACHE_TTL_AUTHENTICATED = 10; // seconds
const CACHE_TTL_GUEST = 30; // seconds

// Public web origins that may call this endpoint
const ALLOWED_ORIGINS = [
  "https://www.liventix.tech",
  "https://liventix.tech",
  "https://app.liventix.com",
  "https://staging.liventix.com",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8084",
  "http://localhost:8085",
  // iOS Capacitor origins
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  // Allow all origins for mobile apps (Capacitor uses various schemes)
  "*", // Fallback to allow all for mobile apps
];

// Optional internal test override (only if both origin + header match)
const INTERNAL_OVERRIDE_HEADER = "X-Internal-Override";
const INTERNAL_OVERRIDE_TOKEN = Deno.env.get("INTERNAL_OVERRIDE_TOKEN") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

/** ---------------------------
 *   UTILITIES
 * ---------------------------- */
function json(status: number, body: any, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

function str(x: unknown) {
  return typeof x === "string" && x.trim() ? x.trim() : undefined;
}

function clampNumber(x: unknown, fallback: number, min: number, max: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function dedupe<T>(arr: T[]) { 
  return Array.from(new Set(arr)); 
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryJsonParse(value: unknown) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeCursor(cursor: any) {
  if (!cursor) return null;
  const ts = typeof cursor.ts === "string" && cursor.ts ? cursor.ts : undefined;
  const id = typeof cursor.id === "string" && cursor.id ? cursor.id : undefined;
  const score = typeof cursor.score === "number" && Number.isFinite(cursor.score) ? cursor.score : undefined;
  if (!ts && !id && score == null) return null;
  return { ts, id, score };
}

function normalizeSponsor(value: unknown) {
  const input = tryJsonParse(value);
  if (!isRecord(input)) return null;
  const name = str(input.name);
  if (!name) return null;
  const normalized: any = {
    name,
    amount_cents: Number.isFinite(Number(input.amount_cents))
      ? Math.max(0, Math.round(Number(input.amount_cents)))
      : 0,
  };
  const logo = str((input as any).logo_url);
  if (logo) normalized.logo_url = logo;
  const tier = str((input as any).tier);
  if (tier) normalized.tier = tier;
  return normalized;
}

function normalizeSponsorList(value: unknown) {
  const input = tryJsonParse(value);
  if (!Array.isArray(input)) return null;
  const sponsors = input.map((entry) => normalizeSponsor(entry)).filter(Boolean);
  return sponsors.length ? sponsors : null;
}

function normalizeSocialLinks(value: unknown) {
  const input = tryJsonParse(value);
  if (!Array.isArray(input)) return null;
  const links = input.filter((entry) => isRecord(entry) && Object.keys(entry).length > 0);
  return links.length ? links : null;
}

// Enhanced video metadata extraction
function extractVideoMetadata(mediaUrls: any[]): any[] {
  if (!Array.isArray(mediaUrls)) return [];
  
  return mediaUrls.map(url => {
    if (typeof url !== 'string') return url;
    
    // Check if it's a Mux video URL
    if (url.includes('mux.com') || url.includes('.m3u8')) {
      return {
        url,
        type: 'video',
        format: 'hls',
        preload: 'metadata',
        // Add quality hints for different connection speeds
        quality_hints: {
          low: url.replace('.m3u8', '_360p.m3u8'),
          medium: url.replace('.m3u8', '_720p.m3u8'),
          high: url
        }
      };
    }
    
    // Check if it's an image
    if (url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      return {
        url,
        type: 'image',
        preload: 'metadata'
      };
    }
    
    return { url, type: 'unknown', preload: 'none' };
  });
}

// Connection speed detection based on user agent and headers
function detectConnectionSpeed(req: Request): 'slow' | 'medium' | 'fast' {
  const userAgent = req.headers.get('user-agent') || '';
  const connection = req.headers.get('connection') || '';
  
  // Mobile networks are typically slower
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    return 'slow';
  }
  
  // Check for connection hints
  if (connection.includes('slow') || userAgent.includes('2G')) {
    return 'slow';
  }
  
  if (connection.includes('fast') || userAgent.includes('5G')) {
    return 'fast';
  }
  
  return 'medium';
}

// Origin matching with wildcards in ALLOWED_ORIGINS
function computeAllowedOrigin(origin: string) {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin || origin === "null" || origin === "") {
    // Check if "*" is in allowed origins (for mobile apps)
    if (ALLOWED_ORIGINS.includes("*")) {
      return "*";
    }
    // For mobile apps without origin, allow if we have wildcard
    return "*";
  }
  
  const match = ALLOWED_ORIGINS.some((allowed) => {
    if (allowed === "*") return true; // Wildcard allows all
    if (allowed === origin) return true;
    if (allowed.includes("*")) {
      const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return false;
  });
  return match ? origin : (ALLOWED_ORIGINS.includes("*") ? "*" : null);
}

const isTrustedOrigin = (o: string) =>
  o === "https://app.liventix.com" ||
  o === "https://staging.liventix.com" ||
  o === "http://localhost:5173";

/** ---------------------------
 *   AD INJECTION
 * ---------------------------- */
async function injectAds({
  supabase,
  organicItems,
  viewerId,
  placement = 'feed',
  category = null,
  location = null,
  monitor
}: {
  supabase: any;
  organicItems: any[];
  viewerId: string | null;
  placement: string;
  category: string | null;
  location: string | null;
  monitor: any;
}) {
  try {
    // Calculate how many ads to inject (1 ad per 5-7 organic items)
    const adFrequency = 6; // Show ad every 6 items
    const maxAds = Math.max(1, Math.floor(organicItems.length / adFrequency));
    
    if (maxAds === 0 || organicItems.length < 3) {
      // Not enough content to inject ads
      return organicItems;
    }

    monitor?.mark('ad_selection_start');

    // Fetch eligible ads from database
    const { data: eligibleAds, error } = await supabase
      .rpc('get_eligible_ads', {
        p_user_id: viewerId,
        p_category: category,
        p_location: location,
        p_keywords: null, // Not using keyword filtering yet
        p_placement: placement,
        p_limit: maxAds
      });

    if (error) {
      console.error('Failed to fetch eligible ads:', error);
      return organicItems; // Fail gracefully, return organic feed
    }

    if (!eligibleAds || eligibleAds.length === 0) {
      return organicItems;
    }

    monitor?.mark('ad_selection_complete');

    // Transform ads into feed item format
    const adItems = eligibleAds.map((ad: any) => ({
      item_type: 'event',
      item_id: ad.event_id,
      event_id: ad.event_id,
      event_title: ad.event_title,
      event_description: ad.event_description,
      event_cover_image: ad.event_cover_image,
      event_start_at: ad.event_start_at,
      event_venue: ad.event_venue,
      event_category: ad.event_category,
      event_address: null,
      organizer_name: ad.org_name,
      organizer_handle: null,
      organizer_verified: false,
      organizer_logo_url: ad.org_logo_url || null,
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      is_attending: false,
      is_bookmarked: false,
      // Mark as promoted content
      isPromoted: true,
      promotion: {
        campaignId: ad.campaign_id,
        creativeId: ad.creative_id,
        placement: placement as any,
        pricingModel: ad.pricing_model,
        estimatedRate: ad.estimated_rate,
        // Include CTA data for custom action buttons
        ctaLabel: ad.cta_label || 'Learn More',
        ctaUrl: ad.cta_url || null,
        // Add frequency cap info for client-side tracking
        frequencyCapPerUser: null,
        frequencyCapPeriod: null,
      }
    }));

    // Inject ads into feed at regular intervals
    const result: any[] = [];
    let adIndex = 0;
    
    for (let i = 0; i < organicItems.length; i++) {
      result.push(organicItems[i]);
      
      // Inject ad every N items (skip first few items)
      if (i > 2 && (i + 1) % adFrequency === 0 && adIndex < adItems.length) {
        result.push(adItems[adIndex]);
        adIndex++;
      }
    }

    monitor?.mark('ad_injection_complete');

    return result;
  } catch (err) {
    console.error('Ad injection error:', err);
    return organicItems; // Fail gracefully
  }
}

/** ---------------------------
 *   PERFORMANCE MONITORING
 * ---------------------------- */
class PerformanceMonitor {
  private startTime: number;
  private metrics: Record<string, number> = {};

  constructor() {
    this.startTime = performance.now();
  }

  mark(name: string) {
    this.metrics[name] = performance.now() - this.startTime;
  }

  getMetrics() {
    return {
      total_time: performance.now() - this.startTime,
      ...this.metrics
    };
  }
}

/** ---------------------------
 *   CORE HANDLER
 * ---------------------------- */
const handler = withCORS(async (req: Request) => {
  const monitor = new PerformanceMonitor();
  
  try {
    const origin = req.headers.get("Origin") || "";
    const allowOrigin = computeAllowedOrigin(origin);

    if (!allowOrigin) {
      return json(403, { error: "Origin not allowed" });
    }

    const isGet = req.method === "GET";
    const payload = isGet
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await safeJson(req);

    // Performance: Start timing
    monitor.mark('request_parsed');

    // Guests are supported; identity comes from Supabase JWT (never from payload)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    const { data: { user } = { user: null }, error: userError } = await supabase.auth.getUser();
    if (userError && userError.message !== "Auth session missing!") {
      console.warn("getUser warning", userError.message);
    }
    let viewerId: string | null = user?.id ?? null;

    // Optional INTERNAL override for QA tools only (trusted origin + secret header)
    const overrideHeader = req.headers.get(INTERNAL_OVERRIDE_HEADER) || "";
    const userIdOverride = str((payload as any).user_id);
    if (
      INTERNAL_OVERRIDE_TOKEN &&
      isTrustedOrigin(origin) &&
      overrideHeader === INTERNAL_OVERRIDE_TOKEN &&
      userIdOverride
    ) {
      viewerId = userIdOverride;
    }

    // Performance: Auth completed
    monitor.mark('auth_completed');

    // pagination + limit
    const limit = clampNumber((payload as any).limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const cursorInput = (payload as any).cursor ?? {
      ts: (payload as any).cursorTs ?? undefined,
      id: (payload as any).cursorId ?? undefined,
      score: (payload as any).cursorScore ?? undefined,
    };
    const cursor = normalizeCursor(cursorInput);

    // Optional guest/session identifier for light personalization (NOT a user id)
    const sessionId = str((payload as any).session_id) ?? undefined;

    // Extract filters from payload
    const filters = (payload as any).filters || {};
    const locationFilters: string[] = Array.isArray(filters.locations) ? filters.locations : [];
    const categoryFilters: string[] = Array.isArray(filters.categories) ? filters.categories : [];
    const dateFilters: string[] = Array.isArray(filters.dates) ? filters.dates : [];
    const searchRadius: number | undefined = typeof filters.searchRadius === 'number' ? filters.searchRadius : undefined;

    // Build RPC args (pass all cursor parts for stable pagination + filters)
    const rpcArgs: Record<string, unknown> = {
      p_user_id: viewerId,        // null for guests
      p_session_id: sessionId,    // optional: use in SQL for guest-affinity if you like
      p_limit: (limit as number) + 1,
    };
    if (cursor?.id) rpcArgs.p_cursor_item_id = cursor.id;
    // ❌ Removed p_cursor_ts and p_cursor_score - new SQL uses ROW_NUMBER + p_cursor_item_id for pagination
    
    // Add filter parameters
    if (categoryFilters.length > 0) rpcArgs.p_categories = categoryFilters;
    if (searchRadius && searchRadius < 100) {
      // For "Near Me" functionality, we need user's location
      // This should come from the frontend via geolocation API
      const userLat = typeof (payload as any).user_lat === 'number' ? (payload as any).user_lat : null;
      const userLng = typeof (payload as any).user_lng === 'number' ? (payload as any).user_lng : null;
      if (userLat !== null && userLng !== null) {
        rpcArgs.p_user_lat = userLat;
        rpcArgs.p_user_lng = userLng;
        rpcArgs.p_max_distance_miles = searchRadius;
      }
    }
    if (dateFilters.length > 0) rpcArgs.p_date_filters = dateFilters;

    // 🎯 PERF-001: Track SQL query duration
    const queryStartTime = Date.now();
    
    // Try ranked feed; fallback to time-ordered events if RPC fails or returns none
    let ranked: any[] = [];
    const { data: rankedData, error: rankedError } =
      await supabase.rpc("get_home_feed_ranked", rpcArgs);

    if (!rankedError && Array.isArray(rankedData) && rankedData.length > 0) {
      ranked = rankedData;
    } else {
      if (rankedError) {
        console.warn("get_home_feed_ranked error => fallback:", rankedError.message);
      }
      ranked = await fetchFallbackRows({ supabase, limit: (limit as number) + 1, cursor, viewerId });
    }
    
    // 🎯 PERF-001: Calculate query duration
    const queryDuration = Date.now() - queryStartTime;
    
    // 🎯 PERF-010: SLO Monitoring - Log slow queries with context
    const SLO_TARGET_MS = 500; // P95 should be under 500ms
    if (queryDuration > SLO_TARGET_MS) {
      console.warn('🚨 [SLO BREACH] Feed query exceeded 500ms target:', {
        duration_ms: queryDuration,
        slo_target_ms: SLO_TARGET_MS,
        breach_percentage: Math.round((queryDuration / SLO_TARGET_MS - 1) * 100),
        query_params: {
          user_id: viewerId || 'anonymous',
          limit: rpcArgs.p_limit,
          has_categories: !!rpcArgs.p_categories?.length,
          has_location: !!(rpcArgs.p_user_lat && rpcArgs.p_user_lng),
          has_date_filters: !!rpcArgs.p_date_filters?.length,
          cursor_provided: !!rpcArgs.p_cursor_item_id
        },
        result: {
          item_count: ranked.length,
          used_fallback: !!rankedError
        }
      });
    } else {
      console.log('✅ [SLO OK] Feed query within target:', {
        duration_ms: queryDuration,
        slo_target_ms: SLO_TARGET_MS,
        margin_ms: SLO_TARGET_MS - queryDuration
      });
    }

    // Performance: Feed data retrieved
    monitor.mark('feed_data_retrieved');

    // Filters are now applied server-side in the SQL function

    // Paging cursor
    let nextCursor: any = null;
    if (ranked.length > (limit as number)) {
      const cursorRow = ranked.pop();
      nextCursor = {
        cursorTs: cursorRow?.sort_ts ?? new Date().toISOString(),
        cursorId: cursorRow?.item_id ?? "",
        cursorScore: cursorRow?.score ?? null,
      };
    }

    // Expand rows (parallelized I/O inside)
    const organicItems = await expandRows({ 
      supabase, 
      rows: ranked, 
      viewerId, 
      req,
      monitor 
    });

    // Performance: Organic data processed
    monitor.mark('organic_data_processed');

    // Inject ads into feed
    const items = await injectAds({
      supabase,
      organicItems,
      viewerId,
      placement: 'feed',
      category: categoryFilters.length === 1 ? categoryFilters[0] : null,
      location: locationFilters.length === 1 ? locationFilters[0] : null,
      monitor
    });

    // Performance: All data processed (including ads)
    monitor.mark('data_processed');

    // Performance metrics (lightweight, production-safe)
    const metrics = monitor.getMetrics();
    if (metrics.total_duration > 200) {
      // Only log slow requests for monitoring
      console.warn('⚠️ Slow feed response:', {
        duration: metrics.total_duration,
        itemCount: items.length
      });
    }

    // 🎯 PERF-008: Add ETag support for conditional requests
    const responseData = {
      items, 
      nextCursor,
      performance: {
        query_time: metrics.feed_data_retrieved,
        total_time: metrics.total_time
      }
    };
    
    // Generate ETag from content hash (simple but effective)
    const etag = `"${hashCode(JSON.stringify({ itemCount: items.length, cursor: nextCursor }))}"`;
    
    // Check If-None-Match header for conditional request
    const clientEtag = req.headers.get('If-None-Match');
    if (clientEtag === etag) {
      console.log('✅ [PERF-008] Cache hit - returning 304 Not Modified');
      return new Response(null, { 
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
          "X-Cache-Status": "HIT"
        }
      });
    }
    
    // Determine cache strategy based on user type
    const cacheControl = viewerId 
      ? `private, max-age=${CACHE_TTL_AUTHENTICATED}, stale-while-revalidate=30` 
      : `public, max-age=${CACHE_TTL_GUEST}, stale-while-revalidate=60`;

    return json(
      200,
      responseData,
      { 
        "Cache-Control": cacheControl,
        "ETag": etag,
        "X-Performance-Metrics": JSON.stringify(metrics),
        "X-Query-Duration-Ms": queryDuration.toString(), // 🎯 PERF-001: Expose query duration
        "X-Cache-Status": "MISS"
      }
    );
  } catch (err) {
    console.error("home-feed error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return json(500, { error: message });
  }
}, { 
  allowOrigins: [
    'https://www.liventix.tech',
    'https://liventix.tech',
    'http://localhost:8080',
    'http://localhost:4173',
    '*' // Allow all origins for now
  ] 
});

/** ---------------------------
 *   SERVER BOOTSTRAP
 * ---------------------------- */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  
  // Detect mobile app origins (Capacitor, Ionic, etc.)
  const isMobileApp = !origin || origin === "null" || origin === "" || 
                     origin.startsWith("capacitor://") || 
                     origin.startsWith("ionic://") ||
                     origin.startsWith("http://localhost");
  
  const allowOrigin = computeAllowedOrigin(origin) || (isMobileApp ? "*" : null);

  // OPTIONS preflight - Always allow for mobile apps
  if (req.method === "OPTIONS") {
    // For mobile apps, always allow OPTIONS
    const finalAllowOrigin = allowOrigin || (isMobileApp ? "*" : null);
    
    if (!finalAllowOrigin) {
      return new Response(null, { status: 403 });
    }
    
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": finalAllowOrigin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, if-none-match, " + INTERNAL_OVERRIDE_HEADER,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Reject disallowed origins early (but allow mobile apps)
  if (!allowOrigin && !isMobileApp) {
    return json(403, { error: "Origin not allowed" });
  }

  const res = await handler(req);
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin || "*");
  headers.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
});

/** ---------------------------
 *   EXPANSION (PARALLELIZED)
 * ---------------------------- */
async function expandRows({
  supabase,
  rows,
  viewerId,
  req,
  monitor
}: {
  supabase: ReturnType<typeof createClient>;
  rows: any[];
  viewerId: string | null;
  req: Request;
  monitor: PerformanceMonitor;
}) {
  if (!rows.length) return [];

  const eventIds = dedupe(rows.map((r) => r.event_id));
  const postIds = rows.filter((r) => r.item_type === "post").map((r) => r.item_id);

  // Debug: Performance monitoring only (removed verbose logging for production)

  // Phase 1: kick off everything that only depends on IDs
  const eventsQ = supabase
    .from("events")  // Will use public.events view after migration
    .select(`
      id, title, description, cover_image_url, start_at, end_at, venue, city, created_at,
      created_by, owner_context_type, owner_context_id, tags
    `)
    .in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]);

  // Query event_posts with ticket_tier badge info
  const postsQ = postIds.length
    ? supabase
        .from("event_posts")
        .select(`
          id, event_id, text, media_urls, like_count, comment_count, author_user_id, created_at,
          ticket_tier_id,
          ticket_tiers!event_posts_ticket_tier_id_fkey (badge_label, name)
        `)
        .in("id", postIds)
        .is("deleted_at", null)
    : Promise.resolve({ data: [], error: null });

  const sponsorsQ = eventIds.length
    ? supabase.rpc("get_active_event_sponsors", { p_event_ids: eventIds })
    : Promise.resolve({ data: [], error: null });

  const likesQ = viewerId && postIds.length
    ? supabase
        .from("event_reactions")
        .select("post_id")
        .eq("user_id", viewerId)
        .eq("kind", "like")
        .in("post_id", postIds)
        .throwOnError(false)
    : Promise.resolve({ data: [], error: null });

  // NEW: Query tickets to determine is_attending
  const ticketsQ = viewerId && eventIds.length
    ? supabase
        .from("tickets")
        .select("event_id")
        .eq("owner_user_id", viewerId)
        .in("event_id", eventIds)
        .in("status", ["issued", "transferred", "redeemed"])
    : Promise.resolve({ data: [], error: null });

  const [{ data: events, error: eventsError }, postsRes, sponsorsRes, likesRes, ticketsRes] =
    await Promise.all([eventsQ, postsQ, sponsorsQ, likesQ, ticketsQ]);
  if (eventsError) throw eventsError;

  // Performance: Phase 1 queries completed
  monitor.mark('phase1_queries_completed');

  const posts = postsRes?.data ?? [];
  const likedPostIds = new Set((likesRes?.data ?? []).map((l: any) => l.post_id));
  const attendingEventIds = new Set((ticketsRes?.data ?? []).map((t: any) => t.event_id));

  // Posts fetched - verbose logging removed for production performance

  // Phase 2: author profiles (fetch display_name, username, avatar_url, and social_links)
  const authorIds = dedupe(posts.map((p: any) => p.author_user_id).filter(Boolean));
  const { data: authorProfiles } = authorIds.length
    ? await supabase.from("user_profiles").select("user_id, display_name, username, photo_url, social_links").in("user_id", authorIds)
    : { data: [] as any[] };

  // Fetch organizer names for events (created_by users)
  const organizerUserIds = dedupe((events ?? []).filter((e: any) => e.owner_context_type === 'individual').map((e: any) => e.created_by).filter(Boolean));
  const { data: organizerProfiles } = organizerUserIds.length
    ? await supabase.from("user_profiles").select("user_id, display_name").in("user_id", organizerUserIds)
    : { data: [] as any[] };
  const organizerNamesMap = new Map((organizerProfiles ?? []).map((p: any) => [p.user_id, p.display_name]));

  // Performance: Phase 2 queries completed
  monitor.mark('phase2_queries_completed');

  // Create maps for author data
  const authorLinksMap = new Map(
    (authorProfiles ?? []).map((p: any) => [p.user_id, normalizeSocialLinks(p.social_links)]),
  );
  const authorNamesMap = new Map(
    (authorProfiles ?? []).map((p: any) => [p.user_id, p.display_name]),
  );
  const authorUsernamesMap = new Map(
    (authorProfiles ?? []).map((p: any) => [p.user_id, p.username]),
  );
  const authorPhotosMap = new Map(
    (authorProfiles ?? []).map((p: any) => [p.user_id, p.photo_url]),
  );

  const sponsorMap = new Map(
    Array.isArray(sponsorsRes?.data)
      ? (sponsorsRes!.data as any[]).map((row: any) => [
          row.event_id,
          {
            primary: normalizeSponsor(row.primary_sponsor),
            sponsors: normalizeSponsorList(row.sponsors),
          },
        ])
      : [],
  );

  const eMap = new Map((events ?? []).map((e: any) => [e.id, e]));
  const pMap = new Map(posts.map((p: any) => [p.id, p]));

  const includeViewerFields = !!viewerId;
  const connectionSpeed = detectConnectionSpeed(req);

  const expandedRows = rows
    .map((row) => {
      const ev = eMap.get(row.event_id);
      if (!ev) return null;

      const sponsorEntry = sponsorMap.get(row.event_id);
      const primarySponsor = sponsorEntry?.primary ?? null;
      const sponsorList = sponsorEntry?.sponsors ?? null;

      const organizerName =
        ev?.owner_context_type === "organization"
          ? "Organizer" // TODO: Fetch organization names
          : organizerNamesMap.get(ev?.created_by) ?? "Organizer";
      const organizerId =
        ev?.owner_context_type === "organization" ? ev?.owner_context_id ?? null : ev?.created_by ?? null;
      const eventCreatedBy = ev?.created_by ?? null; // Always pass the actual creator

      const location = [ev?.venue, ev?.city].filter(Boolean).join(", ") || "TBA";
      const sortTs = row.sort_ts ?? ev?.start_at ?? ev?.created_at ?? new Date().toISOString();

      if (row.item_type === "event") {
        return {
          item_type: "event",
          sort_ts: sortTs,
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? "Event",
          event_description: ev?.description ?? "",
          event_starts_at: ev?.start_at ?? null,
          event_cover_image: ev?.cover_image_url ?? "",
          event_organizer: organizerName,
          event_organizer_id: organizerId,
          event_created_by: eventCreatedBy,
          event_owner_context_type: ev?.owner_context_type ?? "individual",
          event_location: location,
          author_id: null,
          author_name: null,
          author_badge: null,
          author_social_links: null,
          media_urls: null,
          content: null,
          metrics: {
            likes: 0,
            comments: 0,
            viewer_has_liked: false,
            score: row.score ?? null,
          },
          sponsor: primarySponsor,
          sponsors: sponsorList,
          is_attending: viewerId ? attendingEventIds.has(row.event_id) : false,  // NEW: viewer has tickets
        };
      }

    const post = pMap.get(row.item_id);
    if (!post) return null;

    // ✅ FIX: Return simple media URLs array (not enhanced objects)
    // Frontend components expect string URLs, not metadata objects
    const mediaUrls = post.media_urls || [];

    // ✅ Extract badge from ticket_tiers join
    const badgeLabel = post.ticket_tiers?.badge_label ?? null;

    return {
      item_type: "post",
      sort_ts: sortTs,
      item_id: row.item_id,
      event_id: row.event_id,
      event_title: ev?.title ?? "Event",
      event_description: ev?.description ?? "",
      event_starts_at: ev?.start_at ?? null,
      event_cover_image: ev?.cover_image_url ?? "",
      event_organizer: organizerName,
      event_organizer_id: organizerId,
      event_created_by: eventCreatedBy,
      event_owner_context_type: ev?.owner_context_type ?? "individual",
      event_location: location,
      author_id: post.author_user_id ?? null,
      author_name: authorNamesMap.get(post.author_user_id) ?? null,
      author_username: authorUsernamesMap.get(post.author_user_id) ?? null,
      author_photo: authorPhotosMap.get(post.author_user_id) ?? null,
      author_badge: badgeLabel,
      author_social_links: authorLinksMap.get(post.author_user_id) ?? null,
      media_urls: mediaUrls,
      content: post.text ?? "",
      created_at: post.created_at ?? null,
      metrics: {
        likes: post.like_count ?? 0,
        comments: post.comment_count ?? 0,
        viewer_has_liked: includeViewerFields ? likedPostIds.has(row.item_id) : false,
        score: row.score ?? null,
      },
      sponsor: null,
      sponsors: null,
      is_attending_event: viewerId ? attendingEventIds.has(row.event_id) : false,  // NEW: viewer has tickets for this event
    };
    })
    .filter(Boolean);

  // 🔍 Debug: Log what metrics are being mapped
  return expandedRows;
}

/** ---------------------------
 *   FALLBACK (time-ordered)
 * ---------------------------- */
async function fetchFallbackRows({
  supabase,
  limit,
  cursor,
  viewerId,
}: {
  supabase: ReturnType<typeof createClient>;
  limit: number;
  cursor: { ts?: string | undefined } | null;
  viewerId: string | null;
}) {
  const query = supabase
    .from("events")  // Will use public.events view after migration
    .select("id, start_at, is_flashback")
    .eq("visibility", "public")
    .gte("start_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .or("is_flashback.is.null,is_flashback.eq.false")  // ✅ Exclude flashback events
    .order("start_at", { ascending: false })
    .limit(limit);

  if (cursor?.ts) {
    query.lt("start_at", cursor.ts);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []).map((event: any) => ({
    item_type: "event",
    item_id: event.id,
    event_id: event.id,
    score: 0.1,
    sort_ts: event.start_at ?? new Date().toISOString(),
  }));

  // Filter out events the viewer already has tickets for (consistent with ranked feed behavior)
  if (viewerId && rows.length) {
    const eventIds = rows.map((r) => r.event_id);

    const { data: tickets } = await supabase
      .from("tickets")
      .select("event_id")
      .eq("owner_user_id", viewerId)
      .in("event_id", eventIds)
      .in("status", ["issued", "transferred", "redeemed"]);

    const purchased = new Set((tickets ?? []).map((t: any) => t.event_id));
    rows = rows.filter((r) => !purchased.has(r.event_id));
  }

  return rows;
}