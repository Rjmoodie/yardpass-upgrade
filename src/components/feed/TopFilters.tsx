import { MapPin, Clock, SlidersHorizontal } from "lucide-react";

interface TopFiltersProps {
  location?: string;
  dateFilter?: string;
  onLocationClick?: () => void;
  onDateClick?: () => void;
  onFiltersClick?: () => void;
}

export function TopFilters({ 
  location = "Near Me", 
  dateFilter = "Anytime",
  onLocationClick,
  onDateClick,
  onFiltersClick
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
    </>
  );
}

