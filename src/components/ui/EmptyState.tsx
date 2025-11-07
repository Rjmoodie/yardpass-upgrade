/**
 * EmptyState Component
 * 
 * Reusable empty state component with consistent styling across the dashboard.
 * Displays an icon, title, description, and optional action button.
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  const ActionIcon = action?.icon;
  
  return (
    <div className={cn("text-center py-12 border rounded-lg", className)}>
      <Icon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Compact variant for smaller empty states (e.g., within cards)
 */
export function EmptyStateCompact({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  const ActionIcon = action?.icon;
  
  return (
    <div className={cn("text-center py-8", className)}>
      <Icon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground mb-3 max-w-sm mx-auto">{description}</p>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {ActionIcon && <ActionIcon className="mr-1 h-3 w-3" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

