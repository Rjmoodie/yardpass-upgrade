// Flashback Badge Component
// Displays "Flashback" pill on posts and events from past events

import { Clock, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FlashbackBadgeProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

export function FlashbackBadge({ variant = 'default', className }: FlashbackBadgeProps) {
  if (variant === 'minimal') {
    return (
      <Badge 
        variant="outline"
        className={cn(
          'bg-purple-500/10 text-purple-300 border-purple-500/30 backdrop-blur-sm',
          'text-xs font-medium',
          className
        )}
      >
        <Clock className="h-3 w-3 mr-1" />
        Flashback
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline"
      className={cn(
        'bg-gradient-to-r from-purple-500/90 to-purple-600/80',
        'text-white border-purple-400/50',
        'backdrop-blur-md shadow-2xl',
        'text-xs font-bold tracking-wide',
        'animate-in fade-in-50 zoom-in-95 duration-200',
        'ring-2 ring-purple-400/30',
        className
      )}
    >
      <History className="h-3.5 w-3.5 mr-1.5" />
      FLASHBACK
    </Badge>
  );
}

