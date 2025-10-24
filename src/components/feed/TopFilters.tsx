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
      {/* Right side filter button - ONLY show this */}
      <div className="fixed right-3 top-4 z-40 sm:right-4 sm:top-6 md:right-6">
        <button
          onClick={onFiltersClick}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-12 sm:w-12"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4 text-white sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Hide all other filter UI elements - showing only the filter button */}
    </>
  );
}

