// Live Match Calculator - Compute match scores on-demand
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeMatchScore } from "@/lib/sponsorship";
import { MatchScore, MetricBadge } from "@/components/ui/Match";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { MatchBreakdown } from "@/types/sponsorship-ai";

interface LiveMatchCalculatorProps {
  eventId: string;
  sponsorId: string;
  className?: string;
}

export function LiveMatchCalculator({ eventId, sponsorId, className }: LiveMatchCalculatorProps) {
  const [result, setResult] = useState<{ score: number; breakdown: MatchBreakdown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);
    
    try {
      const match = await computeMatchScore(eventId, sponsorId);
      setResult({
        score: match.score,
        breakdown: match.breakdown as MatchBreakdown
      });
      toast.success(`Match calculated: ${Math.round(match.score * 100)}%`);
    } catch (e: unknown) {
      console.error("Failed to compute match score:", e);
      const errorMessage = e instanceof Error ? e.message : "Failed to compute match score";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Live Match Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={calculate} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Match
            </>
          )}
        </Button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-brand-50 rounded-lg">
              <MatchScore score={result.score} className="text-2xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricBadge 
                label="Budget Fit" 
                value={result.breakdown.budget_fit} 
              />
              <MetricBadge 
                label="Audience" 
                value={result.breakdown.audience_overlap.combined} 
              />
              <MetricBadge 
                label="Geographic" 
                value={result.breakdown.geo_overlap} 
              />
              <MetricBadge 
                label="Engagement" 
                value={result.breakdown.engagement_quality} 
              />
            </div>

            {/* Detailed Breakdown */}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-neutral-700 mb-2">
                View Detailed Breakdown
              </summary>
              <pre className="bg-neutral-50 p-3 rounded overflow-auto text-xs">
                {JSON.stringify(result.breakdown, null, 2)}
              </pre>
            </details>

            {/* Weights */}
            <div className="text-xs text-neutral-500 bg-neutral-50 p-3 rounded">
              <p className="font-medium mb-2">Algorithm Weights:</p>
              <ul className="space-y-1">
                <li>• Budget: {Math.round((result.breakdown.weights?.budget || 0.25) * 100)}%</li>
                <li>• Audience: {Math.round((result.breakdown.weights?.audience || 0.35) * 100)}%</li>
                <li>• Geography: {Math.round((result.breakdown.weights?.geo || 0.15) * 100)}%</li>
                <li>• Engagement: {Math.round((result.breakdown.weights?.engagement || 0.15) * 100)}%</li>
                <li>• Objectives: {Math.round((result.breakdown.weights?.objectives || 0.10) * 100)}%</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveMatchCalculator;

