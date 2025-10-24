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
      {/* Left side filter pills */}
      <div className="fixed left-3 top-4 z-40 flex gap-2 sm:left-4 sm:top-6 md:left-6">
        <button 
          onClick={onLocationClick}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black/70 active:scale-95 sm:px-4 sm:py-2"
        >
          <MapPin className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
          <span className="text-xs text-white sm:text-sm">{location}</span>
        </button>
        
        <button 
          onClick={onDateClick}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black/70 active:scale-95 sm:px-4 sm:py-2"
        >
          <Clock className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
          <span className="text-xs text-white sm:text-sm">{dateFilter}</span>
        </button>
      </div>

      {/* Right side filter button */}
      <div className="fixed right-3 top-4 z-40 sm:right-4 sm:top-6 md:right-6">
        <button
          onClick={onFiltersClick}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-12 sm:w-12"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4 text-white sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Center summary */}
      <div className="fixed left-1/2 top-[4.75rem] z-40 flex -translate-x-1/2 flex-col items-center gap-2 sm:top-[5.5rem]">
        <div className="pointer-events-none rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-[0.7rem] font-medium text-white shadow-xl backdrop-blur-md sm:px-6 sm:py-2 sm:text-xs">
          <span className="text-white/70">Exploring</span>{' '}
          <span className="font-semibold text-white">{location}</span>
          <span className="mx-1 text-white/30">•</span>
          <span className="font-semibold text-white">{dateFilter}</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white/80 shadow-lg transition-all hover:border-white/30 hover:text-white sm:px-4 sm:text-xs"
          >
            Clear Filters
          </button>
        )}
      </div>
    </>
  );
}

