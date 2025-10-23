// Feature access control based on your strategic breakdown
// Implements the mobile vs web feature distribution strategy

import React from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Smartphone, 
  Monitor, 
  ExternalLink, 
  Info,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface FeatureAccessControlProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAccessInfo?: boolean;
}

// Feature definitions based on your strategic breakdown
const FEATURE_ACCESS = {
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
};

export const FeatureAccessControl: React.FC<FeatureAccessControlProps> = ({
  feature,
  children,
  fallback,
  showAccessInfo = true
}) => {
  const { isWeb, isMobile, platform } = usePlatform();
  
  const featureConfig = FEATURE_ACCESS[feature as keyof typeof FEATURE_ACCESS];
  
  if (!featureConfig) {
    console.warn(`Feature "${feature}" not found in access control configuration`);
    return <>{children}</>;
  }

  const getAccessLevel = () => {
    if (isWeb) return featureConfig.web;
    if (isMobile) return featureConfig.mobile;
    return 'hidden';
  };

  const accessLevel = getAccessLevel();

  // Determine if feature should be shown
  const shouldShow = () => {
    switch (accessLevel) {
      case 'both':
      case 'web-only':
      case 'mobile-only':
      case 'limited':
      case 'read-approve':
      case 'minimal':
      case 'request':
      case 'summary':
      case 'view-only':
        return true;
      case 'hidden':
        return false;
      default:
        return true;
    }
  };

  if (!shouldShow()) {
    return fallback ? <>{fallback}</> : null;
  }

  const getAccessInfo = () => {
    if (!showAccessInfo) return null;
    
    const getAccessDescription = (level: string) => {
      switch (level) {
        case 'both': return 'Available on both platforms';
        case 'web-only': return 'Full functionality on web';
        case 'mobile-only': return 'Mobile-optimized experience';
        case 'limited': return 'Limited functionality on mobile';
        case 'read-approve': return 'Read and approve on mobile';
        case 'minimal': return 'Minimal view on mobile';
        case 'request': return 'Request-only on mobile';
        case 'summary': return 'Summary view on mobile';
        case 'view-only': return 'View-only on mobile';
        case 'hidden': return 'Not available on this platform';
        default: return 'Available';
      }
    };

    const getAccessIcon = (level: string) => {
      switch (level) {
        case 'both': return <CheckCircle className="h-4 w-4 text-green-600" />;
        case 'web-only': return <Monitor className="h-4 w-4 text-blue-600" />;
        case 'mobile-only': return <Smartphone className="h-4 w-4 text-purple-600" />;
        case 'limited': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
        case 'hidden': return <XCircle className="h-4 w-4 text-red-600" />;
        default: return <Info className="h-4 w-4 text-gray-600" />;
      }
    };

    return (
      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
        {getAccessIcon(accessLevel)}
        <span>{getAccessDescription(accessLevel)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {children}
      {getAccessInfo()}
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
  limitation = "Limited functionality on this platform"
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
