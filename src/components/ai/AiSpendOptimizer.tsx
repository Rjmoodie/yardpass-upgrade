// ==========================================
// AI Spend Optimizer Component
// ==========================================
// Displays AI-powered recommendations to help
// advertisers spend smarter and see better ROI

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Sparkles, TrendingUp, Zap, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  _telemetryId?: string;
};

// ==========================================
// Styling Constants
// ==========================================

const CONFIDENCE_COLORS = {
  low: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

// ==========================================
// Main Component
// ==========================================

export function AiSpendOptimizer({ campaignId }: { campaignId: string }) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId) {
      loadRecommendations();
    }
  }, [campaignId]);

  // ==========================================
  // Load Recommendations from Edge Function
  // ==========================================

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("[AI Optimizer] Fetching recommendations for campaign:", campaignId);

      // Get the user's session token (required for RLS)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-recommend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${session.access_token}`, // Use user's token, not anon key!
          },
          body: JSON.stringify({ campaignId, horizonDays: 14 }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("[AI Optimizer] Edge function error:", res.status, errText);
        try {
          const errData = JSON.parse(errText);
          throw new Error(errData.error || errData.message || "Failed to fetch recommendations");
        } catch {
          throw new Error(`Edge function error (${res.status}): ${errText}`);
        }
      }

      const payload = await res.json();
      console.log("[AI Optimizer] Received recommendations:", payload.recommendations?.length || 0);

      setSummary(payload.summary || "");

      // Log telemetry for each recommendation
      const enriched = await Promise.all(
        (payload.recommendations || []).map(async (r: Recommendation) => {
          try {
            const { data, error } = await supabase.rpc("log_ai_recommendation", {
              p_campaign_id: campaignId,
              p_rec_type: r.actions[0]?.type || "unknown",
              p_rec_title: r.title,
              p_actions: r.actions as any,
              p_confidence: r.confidence,
              p_expected_impact: r.expectedImpact,
            });

            if (!error && data) {
              r._telemetryId = data;
            }
          } catch (telemetryErr) {
            console.warn("[AI Optimizer] Telemetry logging failed:", telemetryErr);
            // Non-fatal, continue
          }

          return r;
        })
      );

      setRecs(enriched);
    } catch (err) {
      console.error("[AI Optimizer] Error loading recommendations:", err);
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
      toast({
        title: "Error",
        description: "Failed to load AI recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Apply Recommendation
  // ==========================================

  const applyRecommendation = async (rec: Recommendation) => {
    setApplying(rec.title);

    try {
      console.log("[AI Optimizer] Applying recommendation:", rec.title);

      for (const action of rec.actions) {
        if (action.type === "increase_daily_budget") {
          const { error } = await supabase.rpc("campaign_increase_daily_budget", {
            p_campaign_id: campaignId,
            p_amount_pct: action.amount_pct,
          });
          if (error) throw error;
          console.log(`[AI Optimizer] Budget increased by ${action.amount_pct}%`);
        }

        if (action.type === "raise_cpm") {
          const { error } = await supabase.rpc("campaign_raise_cpm", {
            p_campaign_id: campaignId,
            p_amount_pct: action.amount_pct,
          });
          if (error) throw error;
          console.log(`[AI Optimizer] CPM raised by ${action.amount_pct}%`);
        }

        if (action.type === "increase_freq_cap") {
          const { error } = await supabase.rpc("campaign_update_freq_cap", {
            p_campaign_id: campaignId,
            p_new_impressions: action.to,
            p_new_period_hours: 24,
          });
          if (error) throw error;
          console.log(`[AI Optimizer] Frequency cap updated to ${action.to}`);
        }

        // Note: shift_budget_to_creative not yet implemented
        // Would need per-creative budget allocation feature
      }

      // Mark as applied in telemetry
      if (rec._telemetryId) {
        await supabase.rpc("mark_ai_rec_applied", { p_rec_id: rec._telemetryId });
      }

      toast({
        title: "✅ Recommendation Applied",
        description: rec.expectedImpact,
      });

      // Remove applied recommendation from list
      setRecs((prev) => prev.filter((r) => r.title !== rec.title));
    } catch (err) {
      console.error("[AI Optimizer] Error applying recommendation:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to apply recommendation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(null);
    }
  };

  // ==========================================
  // Render: Loading State
  // ==========================================

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing campaign performance...</p>
        </CardContent>
      </Card>
    );
  }

  // ==========================================
  // Render: Error State
  // ==========================================

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" onClick={loadRecommendations} className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // ==========================================
  // Render: No Recommendations
  // ==========================================

  if (!recs.length) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">No optimization opportunities right now</p>
          <p className="text-xs text-muted-foreground">{summary || "Your campaign is running well!"}</p>
        </CardContent>
      </Card>
    );
  }

  // ==========================================
  // Render: Recommendations
  // ==========================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">AI Recommendations</h3>
        <Badge variant="secondary" className="ml-auto">
          {recs.length} {recs.length === 1 ? "opportunity" : "opportunities"}
        </Badge>
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{summary}</p>
      )}

      {/* Recommendation Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {recs.map((rec, idx) => (
          <Card
            key={idx}
            className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-l-4"
            style={{
              borderLeftColor:
                rec.confidence === "high"
                  ? "#10b981"
                  : rec.confidence === "medium"
                  ? "#3b82f6"
                  : "#f59e0b",
            }}
          >
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-2 text-base">
                <span className="flex-1 leading-snug">{rec.title}</span>
                <Badge className={CONFIDENCE_COLORS[rec.confidence]} variant="secondary">
                  {rec.confidence.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{rec.rationale}</p>

              <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 p-2 rounded-lg">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs">{rec.expectedImpact}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => applyRecommendation(rec)}
                  disabled={applying === rec.title}
                  className="flex-1 touch-manipulation"
                  size="sm"
                >
                  {applying === rec.title ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    "Apply Recommendation"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(rec, null, 2));
                    toast({ title: "Copied to clipboard" });
                  }}
                  className="touch-manipulation"
                >
                  📋
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

