import React from "react";
import { AlertTriangle, Wallet, Lightbulb, Activity } from "lucide-react";
import type { CampaignOverview } from "@/types/campaigns";

export type Insight = {
  title: string;
  detail: string;
  icon: React.ReactNode;
  cta?: { label: string; href: string };
};

export const PACING_THRESHOLDS = {
  slow: 2,        // < 2× daily budget per week = slow
  accelerating: 9 // > 9× daily budget per week = too fast
} as const;

type WalletState = {
  availableCredits: number;
  isFrozen: boolean;
  isLowBalance: boolean;
};

/**
 * Generate actionable campaign insights based on delivery performance and wallet state
 * @param campaigns - Array of campaign overview data with 7-day metrics
 * @param wallet - Current wallet state (credits, frozen, low balance)
 * @param orgId - Organization ID for constructing CTAs
 * @returns Array of up to 4 prioritized insights
 */
export function generateCampaignInsights(
  campaigns: CampaignOverview[],
  wallet: WalletState,
  orgId: string
): Insight[] {
  const list: Insight[] = [];

  // Priority 1: Wallet frozen (blocks all delivery)
  if (wallet.isFrozen) {
    list.push({
      title: "Wallet frozen",
      detail: "Delivery is paused until billing issues are resolved. Update payment details to unlock campaigns.",
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      cta: { label: "Resolve billing", href: `/wallet?org=${orgId}` },
    });
  } 
  // Priority 2: Low balance (delivery at risk)
  else if (wallet.isLowBalance) {
    list.push({
      title: "Low credits",
      detail: `Only ${wallet.availableCredits.toLocaleString()} credits remain. Top up to prevent delivery slowdowns across campaigns.`,
      icon: <Wallet className="h-4 w-4 text-primary" />,
      cta: { label: "Add credits", href: `/wallet?org=${orgId}` },
    });
  }

  // Priority 3: Campaign-specific issues
  campaigns.forEach((campaign) => {
    // No creatives = can't deliver
    if (campaign.delivery_status === "no-creatives") {
      list.push({
        title: `${campaign.name} needs creatives`,
        detail: "Add at least one active creative so the campaign can serve impressions.",
        icon: <Lightbulb className="h-4 w-4 text-primary" />,
        cta: { label: "Open Creative Manager", href: `#creatives` },
      });
    }

    // At risk = no spend in 7 days while active
    if (campaign.delivery_status === "at-risk") {
      list.push({
        title: `${campaign.name} is not spending credits`,
        detail: "No spend recorded in the last 7 days. Review targeting or creatives to restart delivery.",
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        cta: { label: "Review campaign", href: `#campaigns` },
      });
    }

    // Accelerating = spending too fast
    if (campaign.pacing_health === "accelerating") {
      list.push({
        title: `${campaign.name} is spending faster than plan`,
        detail: `Spend in the last week exceeded ${PACING_THRESHOLDS.accelerating}× the daily budget. Consider tightening targeting or pausing low performers.`,
        icon: <Activity className="h-4 w-4 text-primary" />,
        cta: { label: "Adjust pacing", href: `#campaigns` },
      });
    }

    // Stalled = zero spend for a week (but not due to missing creatives)
    if (campaign.pacing_health === "stalled" && campaign.delivery_status !== "no-creatives") {
      list.push({
        title: `${campaign.name} delivery stalled`,
        detail: "Spend has been zero for a week. Try new creatives or broaden targeting to restart momentum.",
        icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
        cta: { label: "Refresh creative", href: `#creatives` },
      });
    }
  });

  // Return top 4 most critical insights
  return list.slice(0, 4);
}

/**
 * Get badge variant for pacing health status
 */
export function getPacingVariant(
  pacing?: CampaignOverview["pacing_health"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (pacing) {
    case "stalled":
    case "slow":
      return "destructive";
    case "accelerating":
      return "default";
    case "complete":
      return "secondary";
    default:
      return "outline";
  }
}

