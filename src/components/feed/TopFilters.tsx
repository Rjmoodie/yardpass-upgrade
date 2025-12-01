import { MapPin, Clock, SlidersHorizontal } from "lucide-react";

interface TopFiltersProps {
  location?: string;
  dateFilter?: string;
  onLocationClick?: () => void;
  onDateClick?: () => void;
  onFiltersClick?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function TopFilters({
  location = "Near Me",
  dateFilter = "Anytime",
  onLocationClick,
  onDateClick,
  onFiltersClick,
  hasActiveFilters = false,
  onClearFilters
}: TopFiltersProps) {
  return (
    <>
      {/* Positioning styles - must exactly match FloatingActions calculations */}
      <style>{`
        /* Floating actions container top - EXACT match with FloatingActions.tsx */
        .floating-actions-container {
          top: clamp(60px, 12vh, 16vh);
        }
        @media (min-width: 375px) {
          .floating-actions-container {
            top: clamp(80px, 15vh, 20vh);
          }
        }
        
        /* Filter button container positioning */
        /* Position filter button so its bottom edge + gap = floating actions container top */
        /* Formula: filter container top = floating actions top - filter button height - gap */
        
        /* iPhone SE (< 375px): 
           - Floating actions top: clamp(60px, 12vh, 16vh)
           - Filter button: h-8 (2rem = 32px)
           - Gap: gap-1 (0.25rem = 4px) - matches FloatingActions gap-1
           - Result: top = clamp(60px, 12vh, 16vh) - 32px - 4px */
        .filter-button-container {
          top: calc(clamp(60px, 12vh, 16vh) - 32px - 4px);
        }
        
        /* Mobile (375px+):
           - Floating actions top: clamp(80px, 15vh, 20vh)
           - Filter button: h-9 (2.25rem = 36px)
           - Gap: gap-1.5 (0.375rem = 6px) - matches FloatingActions gap-1.5
           - Result: top = clamp(80px, 15vh, 20vh) - 36px - 6px */
        @media (min-width: 375px) {
          .filter-button-container {
            top: calc(clamp(80px, 15vh, 20vh) - 36px - 6px);
          }
        }
        
        /* Small screens (640px+):
           - Floating actions top: clamp(80px, 15vh, 20vh)
           - Filter button: h-10 (2.5rem = 40px)
           - Gap: gap-2 (0.5rem = 8px) - matches FloatingActions gap-2
           - Result: top = clamp(80px, 15vh, 20vh) - 40px - 8px */
        @media (min-width: 640px) {
          .filter-button-container {
            top: calc(clamp(80px, 15vh, 20vh) - 40px - 8px);
          }
        }
        
        /* Medium screens (768px+):
           - Floating actions top: clamp(80px, 15vh, 20vh)
           - Filter button: h-11 (2.75rem = 44px)
           - Gap: gap-2 (0.5rem = 8px) - matches FloatingActions gap-2
           - Result: top = clamp(80px, 15vh, 20vh) - 44px - 8px */
        @media (min-width: 768px) {
          .filter-button-container {
            top: calc(clamp(80px, 15vh, 20vh) - 44px - 8px);
          }
        }
        
        /* Horizontal alignment - move filter button slightly left to align with floating actions */
        .filter-button-container {
          transform: translateX(-1px);
        }
        @media (min-width: 375px) {
          .filter-button-container {
            transform: translateX(-1.5px);
          }
        }
        @media (min-width: 640px) {
          .filter-button-container {
            transform: translateX(-2px);
          }
        }
        @media (min-width: 768px) {
          .filter-button-container {
            transform: translateX(-2px);
          }
        }
      `}</style>
      {/* Filter button - positioned above floating actions with equal spacing */}
      <div 
        className="fixed right-1.5 min-[375px]:right-2 sm:right-4 z-50 flex flex-col filter-button-container"
        style={{ 
          paddingRight: 'env(safe-area-inset-right, 0px)',
          marginRight: 'max(0.375rem, env(safe-area-inset-right, 0px))',
          pointerEvents: 'none',
          isolation: 'isolate',
        }}
      >
        <button
          onClick={onFiltersClick}
          style={{ pointerEvents: 'auto' }}
          className="flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border bg-muted/20 text-foreground shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-primary/60 hover:bg-primary/20 active:scale-95 cursor-pointer touch-manipulation"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Hide all other filter UI elements - showing only the filter button */}
    </>
  );
}

