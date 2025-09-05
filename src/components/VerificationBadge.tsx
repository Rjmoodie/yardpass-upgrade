import { Badge } from './ui/badge';
import { Shield, Crown, CheckCircle } from 'lucide-react';

interface VerificationBadgeProps {
  status: 'none' | 'verified' | 'pro' | 'premium';
  size?: 'sm' | 'md' | 'lg';
}

export function VerificationBadge({ status, size = 'sm' }: VerificationBadgeProps) {
  if (status === 'none') return null;

  const getBadgeConfig = () => {
    switch (status) {
      case 'verified':
        return {
          variant: 'secondary' as const,
          icon: Shield,
          text: 'Verified',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'pro':
        return {
          variant: 'default' as const,
          icon: Crown,
          text: 'Pro',
          className: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0'
        };
      case 'premium':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          text: 'Premium',
          className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0'
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  const Icon = config.icon;
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <Badge 
      variant={config.variant}
      className={`${config.className} ${sizeClasses[size]} flex items-center gap-1`}
    >
      <Icon className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'}`} />
      {config.text}
    </Badge>
  );
}