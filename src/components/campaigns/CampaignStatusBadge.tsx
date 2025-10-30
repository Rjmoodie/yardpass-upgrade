import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CampaignWithStatus, DerivedCampaignStatus, NotServableReason } from '@/types/campaigns-lifecycle';
import { STATUS_CONFIG, REASON_DESCRIPTIONS } from '@/types/campaigns-lifecycle';
import { AlertCircle, CheckCircle2, Clock, Pause, XCircle } from 'lucide-react';

interface CampaignStatusBadgeProps {
  campaign: CampaignWithStatus | {
    derived_status: DerivedCampaignStatus;
    not_servable_reasons?: NotServableReason[];
    is_servable?: boolean;
  };
  showIcon?: boolean;
  showTooltip?: boolean;
}

export function CampaignStatusBadge({ 
  campaign, 
  showIcon = true, 
  showTooltip = true 
}: CampaignStatusBadgeProps) {
  const config = STATUS_CONFIG[campaign.derived_status];
  
  // Determine badge color/variant
  const variant = (() => {
    switch (config.color) {
      case 'success': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
      case 'info': return 'outline';
      default: return 'outline';
    }
  })();

  // Status icon
  const StatusIcon = (() => {
    switch (campaign.derived_status) {
      case 'active': return CheckCircle2;
      case 'paused': return Pause;
      case 'scheduled': return Clock;
      case 'ended':
      case 'budget_exhausted': return XCircle;
      default: return AlertCircle;
    }
  })();

  const badgeContent = (
    <Badge variant={variant} className="gap-1.5">
      {showIcon && <StatusIcon className="h-3 w-3" />}
      <span>{config.label}</span>
    </Badge>
  );

  // If not servable and has reasons, show tooltip
  if (showTooltip && campaign.not_servable_reasons && campaign.not_servable_reasons.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-semibold">{config.description}</p>
              <p className="text-xs text-muted-foreground">Not serving ads because:</p>
              <ul className="text-xs space-y-0.5">
                {campaign.not_servable_reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{REASON_DESCRIPTIONS[reason]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // If servable or no reasons, show simple badge with tooltip
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
            {campaign.is_servable && (
              <p className="text-xs text-green-500 mt-1">✓ Currently serving ads</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

