import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';
type SpinnerAppearance = 'primary' | 'inverted';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-16 w-16'
};

const INNER_SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
  lg: 'h-12 w-12'
};

const BORDER_WIDTH_CLASSES: Record<SpinnerSize, string> = {
  xs: 'border',
  sm: 'border-2',
  md: 'border-[3px]',
  lg: 'border-4'
};

interface YardpassSpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'className'> {
  size?: SpinnerSize;
  appearance?: SpinnerAppearance;
  showGlow?: boolean;
  className?: string;
}

export function YardpassSpinner({
  size = 'md',
  appearance = 'primary',
  showGlow = true,
  className,
  ...spanProps
}: YardpassSpinnerProps) {
  const baseRing = appearance === 'inverted' ? 'border-white/20' : 'border-primary/20';
  const accentRing = appearance === 'inverted' ? 'border-t-white border-r-white/60' : 'border-t-primary border-r-secondary/60';
  const glowTone = appearance === 'inverted' ? 'bg-white/20' : 'bg-primary/25';
  const innerBackground = appearance === 'inverted' ? 'bg-white' : 'bg-white';
  const imageFilter = appearance === 'inverted' ? 'brightness-[0.85]' : 'brightness-100';

  return (
    <span
      role="status"
      aria-live="polite"
      {...spanProps}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center text-primary',
        SIZE_CLASSES[size],
        className
      )}
    >
      {showGlow && (
        <span className={cn('absolute inset-0 scale-125 rounded-full blur-lg', glowTone)} aria-hidden />
      )}
      <span
        className={cn('absolute inset-0 rounded-full border', baseRing, BORDER_WIDTH_CLASSES[size])}
        aria-hidden
      />
      <span
        className={cn(
          'absolute inset-0 rounded-full border-transparent border-l-transparent border-b-transparent animate-spin',
          accentRing,
          BORDER_WIDTH_CLASSES[size]
        )}
        aria-hidden
      />
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 overflow-hidden',
          INNER_SIZE_CLASSES[size],
          innerBackground
        )}
      >
        <img
          src="/yardpass-logo.png"
          alt="YardPass"
          className={cn('h-full w-full object-contain drop-shadow-sm', imageFilter)}
        />
      </span>
    </span>
  );
}

interface LoadingSpinnerProps extends YardpassSpinnerProps {
  label?: string;
  helperText?: string;
}

export function LoadingSpinner({
  size = 'md',
  label = 'Loading…',
  helperText,
  appearance,
  showGlow,
  className,
  ...rest
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', className)}>
      <YardpassSpinner
        size={size}
        appearance={appearance}
        showGlow={showGlow}
        {...rest}
      />
      {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      {helperText && (
        <p className="text-xs text-muted-foreground/80 max-w-[16rem]">{helperText}</p>
      )}
    </div>
  );
}

export function PageLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="text-center space-y-6">
        <div className="w-32 h-28 bg-white/95 backdrop-blur rounded-3xl flex items-center justify-center mx-auto shadow-xl ring-1 ring-primary/10">
          <img
            src="/yardpass-logo.png"
            alt="YardPass"
            className="w-full h-full object-contain drop-shadow"
          />
        </div>
        <LoadingSpinner
          size="lg"
          label="Loading your Yardpass experience…"
          helperText="Calibrating dashboards and personalizing content"
        />
      </div>
    </div>
  );
}
