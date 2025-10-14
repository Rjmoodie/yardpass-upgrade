import { BrandedSpinner, PageSpinner } from './BrandedSpinner';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return <BrandedSpinner size={size} className={`p-4 ${className}`} />;
}

export function PageLoadingSpinner() {
  return <PageSpinner text="Loading..." />;
}
