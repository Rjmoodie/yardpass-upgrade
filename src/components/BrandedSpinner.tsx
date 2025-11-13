import { Loader2 } from 'lucide-react';

interface BrandedSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLogo?: boolean;
  text?: string;
}

export function BrandedSpinner({ 
  size = 'md', 
  className = '', 
  showLogo = false,
  text 
}: BrandedSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const logoSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12', 
    xl: 'w-16 h-16'
  };

  if (showLogo) {
    return (
      <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
        <div className="relative">
          <div className={`${logoSizeClasses[size]} bg-white rounded-2xl flex items-center justify-center shadow-lg animate-pulse`}>
            <img 
              src="/liventix-logo.png" 
              alt="Liventix" 
              className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : size === 'lg' ? 'w-8 h-8' : 'w-12 h-12'} object-contain`}
            />
          </div>
          <div className="absolute inset-0 animate-ping">
            <div className={`${logoSizeClasses[size]} bg-primary/20 rounded-2xl`}></div>
          </div>
        </div>
        {text && (
          <p className="text-sm text-muted-foreground font-medium">{text}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
        <div className={`absolute inset-0 animate-ping text-primary/20 ${sizeClasses[size]}`}>
          <Loader2 className={sizeClasses[size]} />
        </div>
      </div>
      {text && (
        <span className="ml-2 text-sm text-muted-foreground">{text}</span>
      )}
    </div>
  );
}

// Convenience components for common use cases
export function InlineSpinner({ text, size = 'sm' }: { text?: string; size?: 'sm' | 'md' }) {
  return <BrandedSpinner size={size} text={text} />;
}

export function ButtonSpinner({ text }: { text?: string }) {
  return <BrandedSpinner size="sm" text={text} />;
}

export function PageSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <BrandedSpinner size="xl" showLogo text={text} />
    </div>
  );
}
