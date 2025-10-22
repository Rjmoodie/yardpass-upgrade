// supabase/functions/sponsorship-score-onchange/index.ts
// Deno + Supabase Edge Function
// Purpose: Queue recalculation when sponsor profiles or event insights change

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface QueueItem {
  event_id: string;
  sponsor_id: string;
  reason: string;
}

async function queueForSponsor(sponsor_id: string): Promise<number> {
  console.log(`[queueForSponsor] Queuing recalc for sponsor: ${sponsor_id}`);

  // Fetch all events that have insights
  const { data: events, error } = await sb
    .from("event_audience_insights")
    .select("event_id");

  if (error) {
    console.error("[queueForSponsor] Error fetching events:", error);
    throw error;
  }

  if (!events || events.length === 0) {
    console.log("[queueForSponsor] No events with insights found");
    return 0;
  }

  const rows: QueueItem[] = events.map((e) => ({
    event_id: e.event_id,
    sponsor_id,
    reason: "sponsor_profile_update",
  }));

  // Insert with upsert to avoid duplicates
  const { error: insertError } = await sb
    .from("fit_recalc_queue")
    .upsert(rows, {
      onConflict: "event_id,sponsor_id",
      ignoreDuplicates: false,
    });

  if (insertError) {
    console.error("[queueForSponsor] Error inserting queue items:", insertError);
    throw insertError;
  }

  console.log(`[queueForSponsor] Queued ${rows.length} recalculations`);
  return rows.length;
}

async function queueForEvent(event_id: string): Promise<number> {
  console.log(`[queueForEvent] Queuing recalc for event: ${event_id}`);

  // Fetch all sponsor profiles
  const { data: sponsors, error } = await sb
    .from("sponsor_profiles")
    .select("sponsor_id");

  if (error) {
    console.error("[queueForEvent] Error fetching sponsors:", error);
    throw error;
  }

  if (!sponsors || sponsors.length === 0) {
    console.log("[queueForEvent] No sponsor profiles found");
    return 0;
  }

  const rows: QueueItem[] = sponsors.map((s) => ({
    event_id,
    sponsor_id: s.sponsor_id,
    reason: "event_insight_update",
  }));

  // Insert with upsert to avoid duplicates
  const { error: insertError } = await sb
    .from("fit_recalc_queue")
    .upsert(rows, {
      onConflict: "event_id,sponsor_id",
      ignoreDuplicates: false,
    });

  if (insertError) {
    console.error("[queueForEvent] Error inserting queue items:", insertError);
    throw insertError;
  }

  console.log(`[queueForEvent] Queued ${rows.length} recalculations`);
  return rows.length;
}

async function queueBulkEvents(event_ids: string[]): Promise<number> {
  console.log(`[queueBulkEvents] Queuing recalc for ${event_ids.length} events`);

  let totalQueued = 0;
  for (const event_id of event_ids) {
    try {
      const count = await queueForEvent(event_id);
      totalQueued += count;
    } catch (e) {
      console.error(`[queueBulkEvents] Error for event ${event_id}:`, e);
    }
  }

  return totalQueued;
}

async function queueBulkSponsors(sponsor_ids: string[]): Promise<number> {
  console.log(`[queueBulkSponsors] Queuing recalc for ${sponsor_ids.length} sponsors`);

  let totalQueued = 0;
  for (const sponsor_id of sponsor_ids) {
    try {
      const count = await queueForSponsor(sponsor_id);
      totalQueued += count;
    } catch (e) {
      console.error(`[queueBulkSponsors] Error for sponsor ${sponsor_id}:`, e);
    }
  }

  return totalQueued;
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

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const {
      sponsor_id,
      event_id,
      sponsor_ids,
      event_ids,
    } = body as {
      sponsor_id?: string;
      event_id?: string;
      sponsor_ids?: string[];
      event_ids?: string[];
    };

    let totalQueued = 0;
    const operations: string[] = [];

    // Handle single sponsor
    if (sponsor_id) {
      const count = await queueForSponsor(sponsor_id);
      totalQueued += count;
      operations.push(`sponsor:${sponsor_id}`);
    }

    // Handle single event
    if (event_id) {
      const count = await queueForEvent(event_id);
      totalQueued += count;
      operations.push(`event:${event_id}`);
    }

    // Handle bulk sponsors
    if (sponsor_ids && Array.isArray(sponsor_ids) && sponsor_ids.length > 0) {
      const count = await queueBulkSponsors(sponsor_ids);
      totalQueued += count;
      operations.push(`bulk_sponsors:${sponsor_ids.length}`);
    }

    // Handle bulk events
    if (event_ids && Array.isArray(event_ids) && event_ids.length > 0) {
      const count = await queueBulkEvents(event_ids);
      totalQueued += count;
      operations.push(`bulk_events:${event_ids.length}`);
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        queued: totalQueued,
        operations,
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
    console.error("[sponsorship-score-onchange] Fatal error:", e);

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

