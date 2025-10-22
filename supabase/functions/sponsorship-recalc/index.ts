// supabase/functions/sponsorship-recalc/index.ts
// Deno + Supabase Edge Function
// Purpose: Drain fit_recalc_queue, compute match scores, upsert to sponsorship_matches

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// === SCORING ALGORITHM ===

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

interface EventInsights {
  event_id: string;
  attendee_count?: number;
  avg_dwell_time_ms?: number;
  geo_distribution?: Record<string, number>;
  age_segments?: Record<string, number>;
  engagement_score?: number;
  ticket_conversion_rate?: number;
  social_mentions?: number;
  sentiment_score?: number;
}

interface SponsorProfile {
  sponsor_id: string;
  industry?: string;
  company_size?: string;
  annual_budget_cents?: number;
  brand_objectives?: Record<string, unknown>;
  target_audience?: Record<string, unknown>;
  preferred_categories: string[];
  regions: string[];
  activation_preferences?: Record<string, unknown>;
}

interface Event {
  id: string;
  category?: string;
  city?: string;
  country?: string;
}

interface ScoringResult {
  score: number;
  overlap_metrics: {
    budget_fit: number;
    audience_overlap: {
      categories: number;
      geo: number;
    };
    geo_fit: number;
    engagement_quality: number;
    objectives_similarity: number;
  };
}

async function fetchEventInsights(event_id: string): Promise<EventInsights | null> {
  const { data, error } = await sb
    .from("event_audience_insights")
    .select("*")
    .eq("event_id", event_id)
    .single();

  if (error) {
    console.error(`[fetchEventInsights] Error for event ${event_id}:`, error);
    return null;
  }
  return data;
}

async function fetchSponsorProfile(sponsor_id: string): Promise<SponsorProfile | null> {
  const { data, error } = await sb
    .from("sponsor_profiles")
    .select("*")
    .eq("sponsor_id", sponsor_id)
    .single();

  if (error) {
    console.error(`[fetchSponsorProfile] Error for sponsor ${sponsor_id}:`, error);
    return null;
  }
  return data;
}

async function fetchEvent(event_id: string): Promise<Event | null> {
  const { data, error } = await sb
    .from("events")
    .select("id, category, city, country")
    .eq("id", event_id)
    .single();

  if (error) {
    console.error(`[fetchEvent] Error for event ${event_id}:`, error);
    return null;
  }
  return data;
}

function computeScore(
  ins: EventInsights,
  sp: SponsorProfile,
  evt: Event
): ScoringResult {
  // --- 1. Budget Fit (placeholder: normalize by budget if available) ---
  const budget_fit = sp.annual_budget_cents
    ? clamp01(sp.annual_budget_cents / (sp.annual_budget_cents + 100000))
    : 0.5;

  // --- 2. Audience Overlap ---
  // Category match
  const prefCats = sp.preferred_categories || [];
  const eventCats = evt.category ? [evt.category] : [];
  const catOverlap = prefCats.length > 0
    ? prefCats.filter((c) => eventCats.includes(c)).length / prefCats.length
    : 0.5;

  // Geographic match
  const sponsorRegions = sp.regions || [];
  const eventRegions = [evt.country, evt.city].filter(Boolean);
  const geoDistKeys = Object.keys(ins.geo_distribution || {});
  const allEventGeo = [...new Set([...eventRegions, ...geoDistKeys])];
  const geoOverlap = sponsorRegions.length > 0
    ? sponsorRegions.filter((r) => allEventGeo.includes(r)).length / sponsorRegions.length
    : 0.5;

  const audience_overlap = clamp01(0.6 * catOverlap + 0.4 * geoOverlap);

  // --- 3. Geographic Fit (standalone weight) ---
  const geo_fit = geoOverlap;

  // --- 4. Engagement Quality ---
  const engagement = clamp01(Number(ins.engagement_score ?? 0));
  const conversion = clamp01(Number(ins.ticket_conversion_rate ?? 0));
  const engagement_quality = clamp01(0.7 * engagement + 0.3 * conversion);

  // --- 5. Objectives Similarity (placeholder: 0.5 baseline, wire NLP/embeddings later) ---
  const objectives_similarity = 0.5;

  // --- Final Score ---
  const score = clamp01(
    0.25 * budget_fit +
    0.35 * audience_overlap +
    0.15 * geo_fit +
    0.15 * engagement_quality +
    0.10 * objectives_similarity
  );

  return {
    score: Number(score.toFixed(4)),
    overlap_metrics: {
      budget_fit: Number(budget_fit.toFixed(4)),
      audience_overlap: {
        categories: Number(catOverlap.toFixed(4)),
        geo: Number(geoOverlap.toFixed(4)),
      },
      geo_fit: Number(geo_fit.toFixed(4)),
      engagement_quality: Number(engagement_quality.toFixed(4)),
      objectives_similarity: Number(objectives_similarity.toFixed(4)),
    },
  };
}

async function upsertMatch(
  event_id: string,
  sponsor_id: string,
  score: number,
  overlap_metrics: Record<string, unknown>
): Promise<void> {
  const { error } = await sb
    .from("sponsorship_matches")
    .upsert(
      {
        event_id,
        sponsor_id,
        score,
        overlap_metrics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,sponsor_id" }
    );

  if (error) {
    console.error(`[upsertMatch] Error for (${event_id}, ${sponsor_id}):`, error);
    throw error;
  }
}

async function drainQueue(limit = 100): Promise<number> {
  // Fetch pending queue items
  const { data: queue, error } = await sb
    .from("fit_recalc_queue")
    .select("id, event_id, sponsor_id, reason")
    .is("processed_at", null)
    .order("queued_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[drainQueue] Error fetching queue:", error);
    throw error;
  }

  if (!queue?.length) {
    console.log("[drainQueue] No pending items in queue");
    return 0;
  }

  console.log(`[drainQueue] Processing ${queue.length} items`);

  let processed = 0;
  const processedIds: number[] = [];

  for (const row of queue) {
    try {
      // Fetch required data
      const [ins, sp, evt] = await Promise.all([
        fetchEventInsights(row.event_id),
        fetchSponsorProfile(row.sponsor_id),
        fetchEvent(row.event_id),
      ]);

      if (!ins || !sp || !evt) {
        console.warn(
          `[drainQueue] Missing data for (${row.event_id}, ${row.sponsor_id}), skipping`
        );
        processedIds.push(row.id);
        continue;
      }

      // Compute score
      const { score, overlap_metrics } = computeScore(ins, sp, evt);

      // Upsert match
      await upsertMatch(row.event_id, row.sponsor_id, score, overlap_metrics);

      processedIds.push(row.id);
      processed++;
    } catch (e) {
      console.error(
        `[drainQueue] Error processing (${row.event_id}, ${row.sponsor_id}):`,
        e
      );
      // Mark as processed to avoid infinite retry (consider a retry_count field for production)
      processedIds.push(row.id);
    }
  }

  // Mark items as processed
  if (processedIds.length > 0) {
    const { error: updateError } = await sb
      .from("fit_recalc_queue")
      .update({ processed_at: new Date().toISOString() })
      .in("id", processedIds);

    if (updateError) {
      console.error("[drainQueue] Error marking items as processed:", updateError);
    }
  }

  console.log(`[drainQueue] Successfully processed ${processed} items`);
  return processed;
}

// === EDGE FUNCTION HANDLER ===

serve(async (req) => {
  const startTime = Date.now();

  try {
    // Optional: validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Process queue
    const processed = await drainQueue(100);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error("[sponsorship-recalc] Fatal error:", e);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(e),
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

