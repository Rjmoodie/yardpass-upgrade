import React from 'react';
import { cn } from '@/lib/utils';

interface SlugDisplayProps {
  slug: string;
  variant?: 'default' | 'compact' | 'elegant' | 'minimal';
  showIndicator?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: {
    container: [
      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
      'bg-slate-950/80 text-slate-50 ring-1 ring-black/30 shadow-lg backdrop-blur-sm transition-colors duration-200',
      'dark:bg-slate-900/80 dark:text-white dark:ring-white/30'
    ].join(' '),
    indicator: 'h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 shadow-sm',
    text: 'tracking-wide font-semibold'
  },
  compact: {
    container: [
      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
      'bg-slate-950/75 text-slate-100 ring-1 ring-black/30 backdrop-blur-sm shadow-md',
      'dark:bg-slate-900/75 dark:text-white/90 dark:ring-white/25'
    ].join(' '),
    indicator: 'h-1 w-1 rounded-full bg-gradient-to-r from-brand-300 to-brand-500',
    text: 'tracking-tight'
  },
  elegant: {
    container: [
      'inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold',
      'bg-slate-950/85 text-white ring-1 ring-black/40 shadow-xl backdrop-blur-md transition-all duration-300',
      'hover:ring-black/50 hover:shadow-2xl',
      'dark:bg-slate-900/85 dark:text-white dark:ring-white/35 dark:hover:ring-white/45'
    ].join(' '),
    indicator: 'h-2 w-2 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-400 shadow-sm animate-pulse',
    text: 'tracking-wider font-semibold'
  },
  minimal: {
    container: [
      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
      'bg-slate-900/70 text-slate-200 ring-1 ring-black/40 backdrop-blur-sm',
      'dark:bg-slate-900/70 dark:text-white/90 dark:ring-white/25'
    ].join(' '),
    indicator: 'h-1 w-1 rounded-full bg-white/70 dark:bg-white/70',
    text: 'tracking-normal'
  }
};

const sizeStyles = {
  sm: 'text-xs px-2 py-1',
  md: 'text-xs px-3 py-1.5',
  lg: 'text-sm px-4 py-2'
};

export function SlugDisplay({ 
  slug, 
  variant = 'default', 
  showIndicator = true, 
  className,
  size = 'md'
}: SlugDisplayProps) {
  const styles = variantStyles[variant];
  const sizeClass = sizeStyles[size];
  
  return (
    <div className={cn(
      styles.container,
      sizeClass,
      className
    )}>
      {showIndicator && (
        <span className={styles.indicator} aria-hidden="true" />
      )}
      <span className={styles.text}>
        {slug}
      </span>
    </div>
  );
}

// Convenience component for event slugs specifically
interface EventSlugDisplayProps {
  slug: string;
  className?: string;
}

export function EventSlugDisplay({ slug, className }: EventSlugDisplayProps) {
  return (
    <SlugDisplay 
      slug={slug} 
      variant="elegant" 
      size="md"
      className={className}
    />
  );
}
