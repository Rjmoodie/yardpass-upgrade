import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;
const ALLOWED_ORIGINS = [
  "https://app.yardpass.com",
  "https://staging.yardpass.com",
  "http://localhost:5173",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

const handler = withCORS(async (req) => {
  try {
    const isGet = req.method === "GET";
    const payload = isGet
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await safeJson(req);

    const limit = clampNumber(payload.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const userIdOverride = str(payload.user_id);
    const cursorInput = payload.cursor ?? {
      ts: payload.cursorTs ?? undefined,
      id: payload.cursorId ?? undefined,
      score: payload.cursorScore ?? undefined,
    };
    const cursor = normalizeCursor(cursorInput);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader
        ? { headers: { Authorization: authHeader } }
        : undefined,
    });

    const {
      data: { user } = { user: null },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError && userError.message !== "Auth session missing!") {
      console.warn("getUser warning", userError.message);
    }

    const viewerId = user?.id ?? userIdOverride ?? null;

    const rpcArgs = {
      p_user_id: viewerId,
      p_limit: limit + 1,
    };
    if (cursor?.id) rpcArgs.p_cursor_item_id = cursor.id;

    let ranked = [];
    const { data: rankedData, error: rankedError } = await supabase.rpc(
      "get_home_feed_ranked",
      rpcArgs,
    );

    if (!rankedError && Array.isArray(rankedData) && rankedData.length > 0) {
      ranked = rankedData;
    } else {
      if (rankedError) {
        console.warn(
          "get_home_feed_ranked error => falling back to basic:",
          rankedError.message,
        );
      }
      ranked = await fetchFallbackRows({ supabase, limit: limit + 1, cursor });
    }

    let nextCursor = null;
    if (ranked.length > limit) {
      const cursorRow = ranked.pop();
      nextCursor = {
        cursorTs: cursorRow?.sort_ts ?? new Date().toISOString(),
        cursorId: cursorRow?.item_id ?? "",
        cursorScore: cursorRow?.score ?? null,
      };
    }

    const items = await expandRows({ supabase, rows: ranked, viewerId });
    const promoted = await loadFeedPromotions({ supabase, limit, viewerId });
    const merged = mergePromotedItems(items, promoted);

    return json(200, { items: merged, nextCursor }, {
      "Cache-Control": "private, max-age=10",
    });
  } catch (err) {
    console.error("home-feed error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return json(500, { error: message });
  }
}, { allowOrigins: ALLOWED_ORIGINS });

Deno.serve(handler);

async function expandRows({ supabase, rows, viewerId }) {
  if (!rows.length) return [];

  const eventIds = dedupe(rows.map((r) => r.event_id));
  const postIds = rows.filter((r) => r.item_type === "post").map((r) => r.item_id);

  const [{ data: events, error: eventsError }, postsRes] = await Promise.all([
    supabase
      .from("events")
      .select(`
        id, title, description, cover_image_url, start_at, end_at, venue, city, created_at,
        created_by, owner_context_type, owner_context_id,
        user_profiles!events_created_by_fkey(display_name),
        organizations!events_owner_context_id_fkey(name)
      `)
      .in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
    postIds.length
      ? supabase
          .from("event_posts")
          .select(
            "id, event_id, text, media_urls, like_count, comment_count, author_user_id, created_at",
          )
          .in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (eventsError) throw eventsError;

  const posts = postsRes?.data ?? [];

  let viewerLikes = [];
  if (viewerId && postIds.length) {
    const { data } = await supabase
      .from("event_reactions")
      .select("post_id")
      .eq("user_id", viewerId)
      .eq("kind", "like")
      .in("post_id", postIds)
      .throwOnError(false);
    viewerLikes = data ?? [];
  }

  const likedPostIds = new Set(viewerLikes.map((l) => l.post_id));

  const authorIds = dedupe(posts.map((p) => p.author_user_id).filter(Boolean));
  const { data: profiles = [] } = authorIds.length
    ? await supabase
        .from("user_profiles")
        .select("user_id, display_name")
        .in("user_id", authorIds)
    : { data: [] };

  const eMap = new Map((events ?? []).map((e) => [e.id, e]));
  const pMap = new Map(posts.map((p) => [p.id, p]));
  const profMap = new Map(profiles.map((p) => [p.user_id, p]));

  return rows
    .map((row) => {
      const ev = eMap.get(row.event_id);
      if (!ev) return null;

      const organizerName = ev?.owner_context_type === "organization"
        ? ev?.organizations?.name ?? "Organizer"
        : ev?.user_profiles?.display_name ?? "Organizer";
      const organizerId = ev?.owner_context_type === "organization"
        ? ev?.owner_context_id ?? null
        : ev?.created_by ?? null;
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
          event_owner_context_type: ev?.owner_context_type ?? "individual",
          event_location: location,
          author_id: null,
          author_name: null,
          author_badge: null,
          author_social_links: null,
          media_urls: null,
          content: null,
          metrics: { likes: 0, comments: 0, viewer_has_liked: false },
          sponsor: null,
          sponsors: null,
        };
      }

      const post = pMap.get(row.item_id);
      if (!post) return null;

      const author = post.author_user_id ? profMap.get(post.author_user_id) : null;

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
        event_owner_context_type: ev?.owner_context_type ?? "individual",
        event_location: location,
        author_id: post.author_user_id ?? null,
        author_name: author?.display_name ?? null,
        author_badge: null,
        author_social_links: null,
        media_urls: Array.isArray(post.media_urls) ? post.media_urls.filter(Boolean) : [],
        content: post.text ?? "",
        metrics: {
          likes: post.like_count ?? 0,
          comments: post.comment_count ?? 0,
          viewer_has_liked: likedPostIds.has(row.item_id),
        },
        sponsor: null,
        sponsors: null,
      };
    })
    .filter(Boolean);
}

async function fetchFallbackRows({ supabase, limit, cursor }) {
  const query = supabase
    .from("events")
    .select("id, start_at")
    .eq("visibility", "public")
    .gte("start_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: false })
    .limit(limit);

  if (cursor?.ts) {
    query.lt("start_at", cursor.ts);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((event) => ({
    item_type: "event",
    item_id: event.id,
    event_id: event.id,
    score: 0.1,
    sort_ts: event.start_at ?? new Date().toISOString(),
  }));
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function str(x) {
  if (typeof x === "string" && x.trim()) return x.trim();
  return undefined;
}

function clampNumber(x, fallback, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

function normalizeCursor(cursor) {
  if (!cursor) return null;
  const ts = typeof cursor.ts === "string" && cursor.ts ? cursor.ts : undefined;
  const id = typeof cursor.id === "string" && cursor.id ? cursor.id : undefined;
  const score = typeof cursor.score === "number" && Number.isFinite(cursor.score)
    ? cursor.score
    : undefined;
  if (!ts && !id && score == null) return null;
  return { ts, id, score };
}

async function loadFeedPromotions({ supabase, limit, viewerId }) {
  try {
    const maxPromotions = Math.max(1, Math.floor(limit / 2));
    const { data, error } = await supabase.rpc("get_active_campaign_creatives", {
      p_placement: "feed",
      p_limit: maxPromotions,
      p_user_id: viewerId ?? null,
    });

    if (error) {
      console.warn("get_active_campaign_creatives failed", error.message);
      return [];
    }

    let rows = Array.isArray(data) ? data : [];
    if (!rows.length) return [];

    const now = Date.now();
    const viewerCampaignIds = rows
      .filter((row) => row.frequency_cap_per_user && row.frequency_cap_period)
      .map((row) => row.campaign_id);

    if (viewerId && viewerCampaignIds.length) {
      const lookbackDays = rows.reduce((days, row) => {
        if (row.frequency_cap_period === "week") return Math.max(days, 7);
        if (row.frequency_cap_period === "day") return Math.max(days, 1);
        return days;
      }, 0);

      if (lookbackDays > 0) {
        const sinceIso = new Date(now - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
        const { data: impressions } = await supabase
          .from("ad_impressions")
          .select("campaign_id, created_at")
          .eq("placement", "feed")
          .eq("user_id", viewerId)
          .in("campaign_id", viewerCampaignIds)
          .gte("created_at", sinceIso);

        if (Array.isArray(impressions) && impressions.length) {
          const grouped = impressions.reduce((acc, row) => {
            const list = acc.get(row.campaign_id) ?? [];
            list.push(row.created_at);
            acc.set(row.campaign_id, list);
            return acc;
          }, new Map());

          rows = rows.filter((row) => {
            const cap = row.frequency_cap_per_user;
            const period = row.frequency_cap_period;
            if (!cap || !period) return true;
            const list = grouped.get(row.campaign_id) ?? [];
            if (!list.length) return true;
            const windowMs = period === "week"
              ? 7 * 24 * 60 * 60 * 1000
              : period === "day"
                ? 24 * 60 * 60 * 1000
                : 0;
            if (!windowMs) return true;
            const cutoff = now - windowMs;
            const count = list.filter((iso) => {
              const ts = new Date(iso).getTime();
              return Number.isFinite(ts) && ts >= cutoff;
            }).length;
            return count < cap;
          });
        }
      }
    }

    return rows
      .filter((row) => row?.event_id)
      .map((row) => toPromotionFeedItem(row))
      .filter((item) => item != null);
  } catch (err) {
    console.warn("loadFeedPromotions error", err);
    return [];
  }
}

function mergePromotedItems(organic, promotions) {
  if (!promotions?.length) return organic;

  const items = Array.isArray(organic) ? organic.map((item) => ({ ...item })) : [];
  const unmatched = [];

  const organicIndex = new Map();
  items.forEach((item, index) => {
    if (item.item_type === "event") {
      organicIndex.set(item.event_id, index);
    }
  });

  for (const promo of promotions) {
    if (!promo?.event_id) continue;
    if (organicIndex.has(promo.event_id)) {
      const idx = organicIndex.get(promo.event_id);
      const original = items[idx];
      items[idx] = {
        ...original,
        promotion: promo.promotion,
        is_promoted: true,
      };
    } else {
      unmatched.push(promo);
    }
  }

  if (!unmatched.length) {
    return items;
  }

  const interval = Math.max(3, Math.round(items.length / (unmatched.length + 1))) || 4;
  const merged = [];
  let promoIndex = 0;
  for (let i = 0; i < items.length; i++) {
    if (promoIndex < unmatched.length && i > 0 && i % interval === 0) {
      merged.push(unmatched[promoIndex++]);
    }
    merged.push(items[i]);
  }

  while (promoIndex < unmatched.length) {
    merged.push(unmatched[promoIndex++]);
  }

  return merged;
}

function toPromotionFeedItem(row) {
  if (!row?.event_id) return null;
  const sortTs = row.event_starts_at ?? new Date().toISOString();
  const promotion = {
    placement: "feed",
    campaignId: row.campaign_id,
    creativeId: row.creative_id ?? null,
    objective: row.objective ?? "",
    ctaLabel: row.cta_label ?? null,
    ctaUrl: row.cta_url ?? null,
    headline: row.headline ?? null,
    priority: typeof row.priority === "number" ? row.priority : null,
    frequencyCapPerUser: row.frequency_cap_per_user ?? null,
    frequencyCapPeriod: row.frequency_cap_period ?? null,
    targeting: row.targeting ?? null,
    rateModel: row.default_rate_model ?? "cpm",
    cpmRateCredits: row.cpm_rate_credits ?? null,
    cpcRateCredits: row.cpc_rate_credits ?? null,
    remainingCredits: row.remaining_credits ?? null,
    dailyRemainingCredits: row.daily_remaining ?? null,
  };

  return {
    item_type: "event",
    sort_ts: sortTs,
    item_id: row.creative_id ?? row.campaign_id,
    event_id: row.event_id,
    event_title: row.event_title ?? row.headline ?? "Promoted Event",
    event_description: row.event_description ?? row.body_text ?? "",
    event_starts_at: row.event_starts_at ?? null,
    event_cover_image: row.event_cover_image ?? "",
    event_organizer: row.organizer_name ?? "Organizer",
    event_organizer_id: row.organizer_id ?? null,
    event_owner_context_type: row.owner_context_type ?? "organization",
    event_location: row.event_location ?? row.event_city ?? "",
    author_id: null,
    author_name: null,
    author_badge: null,
    author_social_links: null,
    media_urls: null,
    content: null,
    metrics: { likes: 0, comments: 0, viewer_has_liked: false },
    sponsor: null,
    sponsors: null,
    promotion,
    is_promoted: true,
  };
}
