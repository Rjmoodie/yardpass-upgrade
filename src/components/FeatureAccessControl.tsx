// Feature access control based on your strategic breakdown
// Implements the mobile vs web feature distribution strategy

import React from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Smartphone,
  Monitor,
  ExternalLink,
  Info,
  XCircle,
  AlertCircle,
  RefreshCcw,
  ArrowRightLeft
} from 'lucide-react';

interface FeatureAccessControlProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAccessInfo?: boolean;
}

type AccessLevel =
  | 'both'
  | 'web-only'
  | 'mobile-only'
  | 'limited'
  | 'read-approve'
  | 'minimal'
  | 'request'
  | 'summary'
  | 'view-only'
  | 'hidden';

type FeatureAccessDefinition = {
  mobile: AccessLevel;
  web: AccessLevel;
};

// Feature definitions based on your strategic breakdown
const FEATURE_ACCESS: Record<string, FeatureAccessDefinition> = {
  // Both platforms
  'event-discovery': { mobile: 'both', web: 'both' },
  'ticket-purchase': { mobile: 'both', web: 'both' },
  'user-profiles': { mobile: 'both', web: 'both' },
  'messaging': { mobile: 'both', web: 'both' },
  'notifications': { mobile: 'both', web: 'both' },

  // Mobile-only
  'qr-scanning': { mobile: 'mobile-only', web: 'hidden' },
  'deliverables-capture': { mobile: 'mobile-only', web: 'hidden' },
  'mobile-wallet': { mobile: 'mobile-only', web: 'hidden' },

  // Web-only
  'sponsorship-management': { mobile: 'hidden', web: 'web-only' },
  'analytics-dashboard': { mobile: 'hidden', web: 'web-only' },
  'admin-tools': { mobile: 'hidden', web: 'web-only' },
  'contract-management': { mobile: 'hidden', web: 'web-only' },
  'payout-management': { mobile: 'hidden', web: 'web-only' },

  // Limited on mobile, full on web
  'sponsorship-marketplace': { mobile: 'limited', web: 'web-only' },
  'proposals': { mobile: 'read-approve', web: 'web-only' },
  'reports': { mobile: 'minimal', web: 'web-only' },
  'wallets': { mobile: 'limited', web: 'web-only' },
  'refunds': { mobile: 'request', web: 'web-only' },
  'audience-insights': { mobile: 'summary', web: 'web-only' },
  'organizations': { mobile: 'view-only', web: 'web-only' },
  'event-series': { mobile: 'view-only', web: 'web-only' }
} as const;

const ACCESS_APPEARANCE: Record<AccessLevel, { label: string; description: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'; icon: React.ReactNode }> = {
  both: {
    label: 'Unified Experience',
    description: 'Full parity between mobile and web.',
    variant: 'success',
    icon: <ArrowRightLeft className="h-3.5 w-3.5" />
  },
  'web-only': {
    label: 'Web-First',
    description: 'Desktop provides the complete toolkit.',
    variant: 'secondary',
    icon: <Monitor className="h-3.5 w-3.5" />
  },
  'mobile-only': {
    label: 'Mobile-First',
    description: 'Optimized for on-the-go usage.',
    variant: 'secondary',
    icon: <Smartphone className="h-3.5 w-3.5" />
  },
  limited: {
    label: 'Limited Mobile',
    description: 'Streamlined actions for quick completion.',
    variant: 'warning',
    icon: <AlertCircle className="h-3.5 w-3.5" />
  },
  'read-approve': {
    label: 'Review & Approve',
    description: 'Mobile keeps approvals light and fast.',
    variant: 'warning',
    icon: <RefreshCcw className="h-3.5 w-3.5" />
  },
  minimal: {
    label: 'Summary View',
    description: 'High-level data for quick insight.',
    variant: 'outline',
    icon: <Info className="h-3.5 w-3.5" />
  },
  request: {
    label: 'Request Access',
    description: 'Capture intent and route to web for action.',
    variant: 'outline',
    icon: <Info className="h-3.5 w-3.5" />
  },
  summary: {
    label: 'Key Metrics',
    description: 'Digestible snapshots to stay informed.',
    variant: 'outline',
    icon: <Info className="h-3.5 w-3.5" />
  },
  'view-only': {
    label: 'View Only',
    description: 'Look up context, edit on desktop.',
    variant: 'outline',
    icon: <Info className="h-3.5 w-3.5" />
  },
  hidden: {
    label: 'Redirected',
    description: 'Access this experience on the alternate platform.',
    variant: 'destructive',
    icon: <XCircle className="h-3.5 w-3.5" />
  }
};

const isVisibleLevel = (level: AccessLevel) => level !== 'hidden';

const describeAccessLevel = (level: AccessLevel) => ACCESS_APPEARANCE[level]?.description ?? 'Available';

const renderPlatformPanel = (platform: 'web' | 'mobile', level: AccessLevel) => {
  const appearance = ACCESS_APPEARANCE[level];
  const Icon = platform === 'web' ? Monitor : Smartphone;
  const heading = platform === 'web' ? 'Web Platform' : 'Mobile Platform';

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {heading}
      </div>
      <Badge
        variant={appearance.variant}
        className="w-fit items-center gap-1"
      >
        {appearance.icon}
        {appearance.label}
      </Badge>
      <p className="text-xs text-muted-foreground">{describeAccessLevel(level)}</p>
    </div>
  );
};

export const FeatureAccessControl: React.FC<FeatureAccessControlProps> = ({
  feature,
  children,
  fallback,
  showAccessInfo = true
}) => {
  const { isWeb, isMobile } = usePlatform();

  const featureConfig = FEATURE_ACCESS[feature as keyof typeof FEATURE_ACCESS];

  if (!featureConfig) {
    console.warn(`Feature "${feature}" not found in access control configuration`);
    return <>{children}</>;
  }

  const accessLevel: AccessLevel = isWeb
    ? featureConfig.web
    : isMobile
      ? featureConfig.mobile
      : 'hidden';

  if (!isVisibleLevel(accessLevel)) {
    return fallback ? <>{fallback}</> : null;
  }

  const renderAccessInfo = () => {
    if (!showAccessInfo) return null;

    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Badge variant={ACCESS_APPEARANCE[accessLevel].variant} className="inline-flex items-center gap-1">
            {ACCESS_APPEARANCE[accessLevel].icon}
            {ACCESS_APPEARANCE[accessLevel].label}
          </Badge>
          <span>{describeAccessLevel(accessLevel)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {renderPlatformPanel('web', featureConfig.web)}
          {renderPlatformPanel('mobile', featureConfig.mobile)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {children}
      {renderAccessInfo()}
    </div>
  );
};

// Convenience components for specific access patterns
export const WebOnlyFeature: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => {
  const { isWeb } = usePlatform();

  if (!isWeb) {
    return fallback ? <>{fallback}</> : (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Web-Only Feature</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This feature is available on the web platform for full functionality.
          </p>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open on Web
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export const MobileOnlyFeature: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => {
  const { isMobile } = usePlatform();

  if (!isMobile) {
    return fallback ? <>{fallback}</> : (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Mobile-Only Feature</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This feature is optimized for mobile devices.
          </p>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Download App
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export const LimitedFeature: React.FC<{
  children: React.ReactNode;
  fullVersion?: React.ReactNode;
  limitation?: string;
}> = ({
  children,
  fullVersion,
  limitation = 'Limited functionality on this platform'
}) => {
  const { isWeb } = usePlatform();

  return (
    <div className="space-y-2">
      {isWeb ? (fullVersion || children) : children}
      {!isWeb && (
        <div className="flex items-center space-x-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
          <AlertCircle className="h-4 w-4" />
          <span>{limitation}</span>
        </div>
      )}
    </div>
  );
};

export default FeatureAccessControl;
