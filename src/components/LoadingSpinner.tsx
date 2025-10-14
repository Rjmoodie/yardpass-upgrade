import { BrandedSpinner, PageSpinner } from './BrandedSpinner';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';
type SpinnerAppearance = 'primary' | 'inverted';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-[18px] w-[18px]',
  md: 'h-12 w-12',
  lg: 'h-16 w-16'
};

const INNER_SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-[12px] w-[12px]',
  md: 'h-9 w-9',
  lg: 'h-12 w-12'
};

const BORDER_WIDTH_CLASSES: Record<SpinnerSize, string> = {
  xs: 'border',
  sm: 'border-2',
  md: 'border-[3px]',
  lg: 'border-4'
};

interface YardpassSpinnerProps {
  size?: SpinnerSize;
  appearance?: SpinnerAppearance;
  showGlow?: boolean;
  showLogo?: boolean;
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return <BrandedSpinner size={size} className={`p-4 ${className}`} />;
}

export function PageLoadingSpinner() {
  return <PageSpinner text="Loading..." />;
}
