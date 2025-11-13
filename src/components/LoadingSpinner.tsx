import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 'md', className = '' }: { size?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}

export function PageLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="text-center space-y-6">
        <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
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
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
    </div>
  );
}