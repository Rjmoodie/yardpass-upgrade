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
    container: 'inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-white/10 via-white/5 to-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm shadow-sm hover:border-white/30 transition-colors duration-200',
    indicator: 'h-1.5 w-1.5 rounded-full bg-gradient-to-r from-orange-400 to-pink-400 shadow-sm',
    text: 'tracking-wide font-medium'
  },
  compact: {
    container: 'inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur-sm',
    indicator: 'h-1 w-1 rounded-full bg-gradient-to-r from-blue-400 to-purple-400',
    text: 'tracking-tight'
  },
  elegant: {
    container: 'inline-flex items-center gap-2.5 rounded-xl border border-white/25 bg-gradient-to-br from-white/15 via-white/8 to-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md shadow-lg hover:shadow-xl hover:border-white/35 transition-all duration-300',
    indicator: 'h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-sm animate-pulse',
    text: 'tracking-wider font-semibold'
  },
  minimal: {
    container: 'inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-xs font-normal text-white/70',
    indicator: 'h-1 w-1 rounded-full bg-white/40',
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
