// components/ui/responsive-bottom-sheet.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

/**
 * Responsive Bottom Sheet component that adapts to different screen sizes
 * - Mobile: Full-height slide-up sheet
 * - Tablet: Modal dialog with responsive sizing
 * - Desktop: Centered modal dialog
 */
export function ResponsiveBottomSheet({
  isOpen,
  onClose,
  children,
  className,
  title,
  description,
}: ResponsiveBottomSheetProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 dialog-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Content */}
      <div
        className={cn(
          "fixed left-0 right-0 z-50",
          "dialog-responsive dialog-content-responsive",
          "bg-background border-t border-border",
          "transform transition-transform duration-300 ease-out",
          isVisible ? "translate-y-0" : "translate-y-full",
          // Mobile: full height sheet
          "h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)]",
          // Tablet and up: centered modal
          "sm:left-1/2 sm:right-auto sm:top-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:h-auto sm:max-h-[90vh] sm:border sm:border-border sm:rounded-lg",
          // Desktop: larger modal
          "lg:max-w-2xl",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "sheet-title" : undefined}
        aria-describedby={description ? "sheet-description" : undefined}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-center justify-between p-4 border-b border-border sm:p-6">
            <div className="flex-1">
              {title && (
                <h2 id="sheet-title" className="text-lg font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p id="sheet-description" className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 hover:bg-muted rounded-full transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Responsive Grid component for dashboard layouts
 */
export function ResponsiveGrid({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid-responsive", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Responsive Card component with device-specific optimizations
 */
export function ResponsiveCard({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        "p-4 sm:p-6",
        "transition-all duration-200",
        "hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
