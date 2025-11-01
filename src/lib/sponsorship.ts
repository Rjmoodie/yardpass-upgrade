// Sponsorship Utilities - Functions for interacting with sponsorship system
import { supabase } from "@/integrations/supabase/client";
import { env } from "@/config/env";

/**
 * Compute a live match score between an event and sponsor
 */
export async function computeMatchScore(eventId: string, sponsorId: string) {
  const { data, error } = await supabase.rpc("fn_compute_match_score", {
    p_event_id: eventId,
    p_sponsor_id: sponsorId,
  });

  if (error) throw error;

  // Normalize response - might be array or object depending on Postgres version
  const row = Array.isArray(data) ? data[0] : data;
  
  return { 
    score: row?.score as number, 
    breakdown: row?.breakdown as Record<string, unknown>
  };
}

/**
 * Trigger recalculation of match scores via Edge Function
 */
export async function triggerRecalculation(params: {
  sponsor_id?: string;
  event_id?: string;
  sponsor_ids?: string[];
  event_ids?: string[];
}) {
  const url = `${env.supabaseUrl}/functions/v1/sponsorship-score-onchange`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recalc failed (${res.status}): ${text}`);
  }
  
  return res.json();
}

/**
 * Process the sponsorship match queue manually
 */
export async function processMatchQueue(batchSize: number = 100) {
  const { data, error } = await supabase.rpc("process_match_queue", {
    p_batch_size: batchSize
  });

  if (error) throw error;
  
  return data as number; // Returns count of processed items
}

/**
 * Upsert a single match score (computes and stores)
 */
export async function upsertMatch(eventId: string, sponsorId: string) {
  const { error } = await supabase.rpc("fn_upsert_match", {
    p_event_id: eventId,
    p_sponsor_id: sponsorId,
  });

  if (error) throw error;
}

/**
 * Refresh sponsorship materialized views
 */
export async function refreshSponsorshipMVs(concurrent: boolean = false) {
  const { data, error } = await supabase.rpc("refresh_sponsorship_mvs", {
    concurrent
  });

  if (error) throw error;
  
  return data;
}

/**
 * Get queue status (pending items count)
 */
export async function getQueueStatus() {
  const { count, error } = await supabase
    .from("fit_recalc_queue")
    .select("*", { count: "exact", head: true })
    .is("processed_at", null);

  if (error) throw error;
  
  return { pendingCount: count || 0 };
}

/**
 * Helper to queue recalculation after profile update
 */
export async function handleProfileUpdate(sponsorId: string) {
  await triggerRecalculation({ sponsor_id: sponsorId });
}

/**
 * Helper to queue recalculation after event insight update
 */
export async function handleEventInsightUpdate(eventId: string) {
  await triggerRecalculation({ event_id: eventId });
}

