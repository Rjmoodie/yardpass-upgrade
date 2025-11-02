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
      {/* Right side filter button - matches engagement button style but more visible at top */}
      <div className="fixed right-3 top-4 z-50 sm:right-4 sm:top-6 md:right-6">
        <button
          onClick={onFiltersClick}
          className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl min-h-[48px] min-w-[48px] text-foreground bg-background/40 backdrop-blur-sm border border-border hover:bg-muted/30 active:scale-95 transition-all duration-200 shadow-lg"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Hide all other filter UI elements - showing only the filter button */}
    </>
  );
}

