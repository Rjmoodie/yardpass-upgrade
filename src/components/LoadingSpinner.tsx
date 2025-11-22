import { BrandedSpinner } from './BrandedSpinner';

export function LoadingSpinner({ size = 'md', className = '' }: { size?: string; className?: string }) {
  const sizeMap: Record<string, 'sm' | 'md' | 'lg' | 'xl'> = {
    xs: 'sm',
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl'
  };
  
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <BrandedSpinner size={sizeMap[size as string] || 'md'} showLogo />
    </div>
  );
}

export function PageLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <BrandedSpinner size="xl" showLogo text="Loading..." />
    </div>
  );
}

// Legacy export for backward compatibility
export function LiventixSpinner({ size = 'md', className = '', showGlow = false, showLogo = false }: { 
  size?: string; 
  className?: string; 
  showGlow?: boolean; 
  showLogo?: boolean; 
}) {
  const sizeMap: Record<string, 'sm' | 'md' | 'lg' | 'xl'> = {
    xs: 'sm',
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl'
  };
  
  return (
    <div className={className}>
      <BrandedSpinner size={sizeMap[size as string] || 'md'} showLogo={showLogo} />
    </div>
  );
}