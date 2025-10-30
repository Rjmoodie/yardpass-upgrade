// ==========================================
// AI Recommend Edge Function
// ==========================================
// Analyzes campaign performance and generates
// actionable spend optimization recommendations

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==========================================
// Types
// ==========================================

type RecAction =
  | { type: "increase_daily_budget"; amount_pct: number }
  | { type: "raise_cpm"; amount_pct: number }
  | { type: "shift_budget_to_creative"; creativeId: string; amount_pct: number }
  | { type: "increase_freq_cap"; from?: number; to: number };

type Recommendation = {
  title: string;
  rationale: string;
  expectedImpact: string;
  confidence: "low" | "medium" | "high";
  actions: RecAction[];
};

type ResponseBody = {
  campaignId: string;
  horizonDays: number;
  kpis: any[];
  recommendations: Recommendation[];
  summary?: string;
};

// ==========================================
// Main Handler
// ==========================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const { campaignId, horizonDays = 14 } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "campaignId required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-recommend] Analyzing campaign ${campaignId} (${horizonDays} days)`);

    // Use anon key + auth header to respect RLS (security!)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // ==========================================
    // 1. Load Campaign KPIs
    // ==========================================
    const since = new Date();
    since.setDate(since.getDate() - horizonDays);

    // Query public view (exposed via PostgREST with RLS)
    const { data: kpis, error: kpiErr } = await supabase
      .from("analytics_campaign_daily")
      .select("day, impressions, clicks, conversions, spend_credits")
      .eq("campaign_id", campaignId)
      .gte("day", since.toISOString().slice(0, 10))
      .order("day", { ascending: true });

    if (kpiErr) {
      console.error("[ai-recommend] KPI fetch error:", kpiErr);
      throw kpiErr;
    }

    if (!kpis || kpis.length === 0) {
      return new Response(
        JSON.stringify({
          campaignId,
          horizonDays,
          kpis: [],
          recommendations: [],
          summary: "Not enough data yet. Check back after your campaign has run for a few days.",
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // 2. Load Campaign Details via RPC (campaigns schema not exposed to PostgREST)
    // ==========================================
    const { data: campaignRows, error: campErr } = await supabase
      .rpc("get_campaign_for_ai", { p_campaign_id: campaignId });

    if (campErr) {
      console.error("[ai-recommend] Campaign fetch error:", campErr);
      // Try direct query as fallback (if campaigns table is in public schema)
      const { data: campaign2, error: campErr2 } = await supabase
        .from("campaigns")
        .select("id, name, daily_budget_credits, total_budget_credits, spent_credits, bidding, freq_cap, frequency_cap_per_user")
        .eq("id", campaignId)
        .single();
      
      if (campErr2 || !campaign2) {
        console.error("[ai-recommend] Fallback campaign fetch also failed:", campErr2);
        return new Response(
          JSON.stringify({ error: "Campaign not found or access denied" }),
          { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      
      var campaign = campaign2;
    } else {
      var campaign = campaignRows && campaignRows.length > 0 ? campaignRows[0] : null;
    }
    
    console.log(`[ai-recommend] Loaded campaign: ${campaign?.name || 'Unknown'}, budget: ${campaign?.daily_budget_credits}`);
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found or access denied" }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // 3. Calculate Aggregates (with NaN guards)
    // ==========================================
    // Helper to sanitize numbers
    const safe = (n: number) => (Number.isFinite(n) && !isNaN(n) ? n : 0);

    const impressions = kpis.reduce((a, r) => a + (Number(r.impressions) || 0), 0);
    const clicks = kpis.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
    const spend = kpis.reduce((a, r) => a + Number(r.spend_credits || 0), 0);
    const conversions = kpis.reduce((a, r) => a + (Number(r.conversions) || 0), 0);
    const ctr = safe(impressions > 0 ? (clicks / impressions) * 100 : 0);
    const cvr = safe(clicks > 0 ? (conversions / clicks) * 100 : 0);

    // Credits math: use cpm_credits directly (credits per 1000 impressions)
    // If bidding stores bid_cents, assume 1 credit = 1 cent, so cpm_credits = bid_cents
    const cpmCredits = Number(campaign?.bidding?.cpm_credits || campaign?.bidding?.bid_cents || 500);
    const estImpressionsPerDay = safe(
      campaign.daily_budget_credits > 0 && cpmCredits > 0
        ? Math.floor((campaign.daily_budget_credits * 1000) / cpmCredits)
        : 0
    );

    // Budget pacing
    const budgetUsedPct = safe(
      campaign.total_budget_credits > 0
        ? (campaign.spent_credits / campaign.total_budget_credits) * 100
        : 0
    );

    console.log(`[ai-recommend] Stats: ${impressions} imp, ${clicks} clicks, CTR ${ctr.toFixed(2)}%`);

    // ==========================================
    // 4. Load Category Benchmarks
    // ==========================================
    const { data: bench } = await supabase
      .from("category_benchmarks")
      .select("ctr_median, spend_median, sample_size")
      .limit(1);

    // CTR benchmark is stored as percentage (e.g., 2.3 = 2.3%)
    // Ensure consistent units with our calculated ctr
    const ctrBenchmark = safe(Number(bench?.[0]?.ctr_median || 0));
    const spendMedian = safe(Number(bench?.[0]?.spend_median || 0));
    const sampleSize = Number(bench?.[0]?.sample_size || 0);

    console.log(`[ai-recommend] Benchmarks: CTR median ${ctrBenchmark.toFixed(2)}% (n=${sampleSize})`);

    // ==========================================
    // 5. Generate Recommendations
    // ==========================================
    const recs: Recommendation[] = [];

    // Rec 1: High CTR → Increase budget
    if (ctrBenchmark > 0 && ctr >= ctrBenchmark * 1.15) {
      const outperformPct = Math.round(((ctr - ctrBenchmark) / ctrBenchmark) * 100);
      recs.push({
        title: "🎯 Capture outsized demand — increase budget",
        rationale: `Your CTR (${ctr.toFixed(2)}%) beats category median (${ctrBenchmark.toFixed(
          2
        )}%) by ${outperformPct}%. Users are highly engaged. More budget scales efficiently at this performance level.`,
        expectedImpact: "+15–25% impressions at current CTR",
        confidence: "high",
        actions: [{ type: "increase_daily_budget", amount_pct: 15 }],
      });
    }

    // Rec 2: Low daily reach
    if (estImpressionsPerDay < 500 && campaign.daily_budget_credits > 0) {
      recs.push({
        title: "📈 Low daily reach — raise budget",
        rationale: `Estimated ${estImpressionsPerDay} impressions/day at ${cpmCredits.toFixed(
          0
        )} credits CPM. This is below competitive threshold for meaningful impact. Increasing budget unlocks better delivery.`,
        expectedImpact: "2x daily reach",
        confidence: "medium",
        actions: [{ type: "increase_daily_budget", amount_pct: 30 }],
      });
    }

    // Rec 3: Strong viewability + average CTR → raise CPM
    const avgViewability = safe(
      kpis.length > 0
        ? kpis.reduce((a, k) => a + Number(k.viewability_rate || 0), 0) / kpis.length
        : 0
    );

    if (avgViewability >= 0.6 && ctrBenchmark > 0 && ctr < ctrBenchmark * 1.1 && ctr > 0) {
      recs.push({
        title: "⬆️ Raise CPM for premium placements",
        rationale: `Viewability is strong (${(avgViewability * 100).toFixed(
          0
        )}%) but CTR is near category median. A 10% CPM increase can shift you to premium inventory with higher engagement rates.`,
        expectedImpact: "+8–12% CTR from better positions",
        confidence: "medium",
        actions: [{ type: "raise_cpm", amount_pct: 10 }],
      });
    }

    // Rec 4: Good performance but slow spend → accelerate
    if (ctr >= ctrBenchmark * 0.9 && budgetUsedPct < 30 && campaign.spent_credits > 0) {
      recs.push({
        title: "🚀 Accelerate spend — performance is solid",
        rationale: `You've only used ${budgetUsedPct.toFixed(
          0
        )}% of budget but CTR is competitive. Your campaign is working. Increase daily budget to deploy capital while performance is strong.`,
        expectedImpact: "+40–60% budget utilization",
        confidence: "high",
        actions: [{ type: "increase_daily_budget", amount_pct: 25 }],
      });
    }

    // Rec 5: Top-performing creative
    const { data: creatives } = await supabase
      .from("analytics_creative_daily")
      .select("creative_id, day, impressions, clicks")
      .eq("campaign_id", campaignId)
      .gte("day", since.toISOString().slice(0, 10));

    if (creatives && creatives.length > 1) {
      const byCreative = rollupCreative(creatives);
      const sorted = byCreative.sort((a, b) => b.ctr - a.ctr);
      const best = sorted[0];
      const avg = byCreative.reduce((sum, c) => sum + c.ctr, 0) / byCreative.length;

      if (best && best.ctr > avg * 1.3 && best.impressions > 50) {
        recs.push({
          title: "🎨 Shift budget toward best creative",
          rationale: `Creative ${best.creative_id.slice(0, 8)} CTR ${(best.ctr * 100).toFixed(
            1
          )}% beats campaign avg ${(avg * 100).toFixed(
            1
          )}% by ${Math.round(((best.ctr - avg) / avg) * 100)}%. Reallocating spend maximizes efficiency.`,
          expectedImpact: "+15–30% conversions (estimated)",
          confidence: "high",
          actions: [
            { type: "shift_budget_to_creative", creativeId: best.creative_id, amount_pct: 25 },
          ],
        });
      }
    }

    // Rec 6: Frequency cap optimization
    // Use canonical field: freq_cap.impressions (JSONB) as primary, fallback to frequency_cap_per_user
    const currentFreqCap = Number(campaign.freq_cap?.impressions || campaign.frequency_cap_per_user || 0);
    if (currentFreqCap > 0 && currentFreqCap < 3 && impressions > 1000) {
      recs.push({
        title: "🔄 Increase frequency cap for more reach",
        rationale: `Current cap (${currentFreqCap} impressions/user) may limit unique reach. Your campaign has proven demand (${impressions.toLocaleString()} impressions). Raising to ${currentFreqCap + 2} can unlock new users.`,
        expectedImpact: "+10–20% unique users reached",
        confidence: "medium",
        actions: [{ type: "increase_freq_cap", from: currentFreqCap, to: currentFreqCap + 2 }],
      });
    }

    // ==========================================
    // 6. Generate Summary
    // ==========================================
    let summary = "";
    if (recs.length === 0) {
      summary = `Your campaign is performing well with ${impressions.toLocaleString()} impressions and ${ctr.toFixed(
        2
      )}% CTR. No immediate optimizations recommended. Check back in a few days as data accrues.`;
    } else {
      summary = `Analyzed ${horizonDays} days of data (${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks). Found ${
        recs.length
      } optimization ${recs.length === 1 ? "opportunity" : "opportunities"} to increase performance.`;
    }

    console.log(`[ai-recommend] Generated ${recs.length} recommendations`);

    // ==========================================
    // 7. Return Response
    // ==========================================
    const body: ResponseBody = {
      campaignId,
      horizonDays,
      kpis: kpis ?? [],
      recommendations: recs,
      summary,
    };

    return new Response(JSON.stringify(body), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-recommend] error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

// ==========================================
// Helper Functions
// ==========================================

function rollupCreative(rows: any[]) {
  const m = new Map<
    string,
    { creative_id: string; impressions: number; clicks: number; ctr: number }
  >();
  for (const r of rows) {
    const key = r.creative_id;
    const cur = m.get(key) ?? { creative_id: key, impressions: 0, clicks: 0, ctr: 0 };
    cur.impressions += Number(r.impressions || 0);
    cur.clicks += Number(r.clicks || 0);
    m.set(key, cur);
  }
  return [...m.values()].map((x) => ({
    ...x,
    ctr: x.impressions > 0 ? x.clicks / x.impressions : 0,
  }));
}

