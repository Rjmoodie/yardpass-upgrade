import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="relative">
        <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
        <div className={`absolute inset-0 animate-ping text-primary/20 ${sizeClasses[size]}`}>
          <Loader2 className={sizeClasses[size]} />
        </div>
      </div>
    </div>
  );
}

export function PageLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="text-center space-y-6">
        <div className="w-36 h-32 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-pulse p-4">
          <img 
            src="/yardpass-logo.png" 
            alt="YardPass" 
            className="w-full h-full object-contain"
          />
        </div>
        <div className="space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground font-medium">Loading...</p>
          <p className="text-sm text-muted-foreground">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}
