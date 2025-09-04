import { Badge } from './ui/badge';
import { Shield, Star, Crown, CheckCircle } from 'lucide-react';

interface VerificationBadgeProps {
  status: 'none' | 'pending' | 'verified' | 'pro';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const verificationConfig = {
  none: {
    label: 'Unverified',
    icon: null,
    variant: 'secondary' as const,
    className: 'text-muted-foreground'
  },
  pending: {
    label: 'Pending',
    icon: Shield,
    variant: 'outline' as const,
    className: 'text-yellow-600 border-yellow-200'
  },
  verified: {
    label: 'Verified',
    icon: CheckCircle,
    variant: 'secondary' as const,
    className: 'text-green-600 bg-green-50 border-green-200'
  },
  pro: {
    label: 'Pro Organizer',
    icon: Crown,
    variant: 'default' as const,
    className: 'text-purple-600 bg-purple-50 border-purple-200'
  }
};

export function VerificationBadge({ status, size = 'md', showLabel = true }: VerificationBadgeProps) {
  const config = verificationConfig[status];
  const Icon = config.icon;

  if (status === 'none' && !showLabel) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${sizeClasses[size]} flex items-center gap-1`}
    >
      {Icon && <Icon className={iconSizes[size]} />}
      {showLabel && config.label}
    </Badge>
  );
}