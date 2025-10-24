import { MapPin, Compass, SlidersHorizontal } from "lucide-react";

export function FilterBar() {
  return (
    <header className="sticky top-0 z-30 px-3 pb-2 pt-1">
      <div className="mx-auto max-w-5xl">
        {/* Main filter container */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <span className="flex-1 text-white">Near Brooklyn</span>
          
          <button className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 transition-all hover:bg-white/20 active:scale-95">
            <SlidersHorizontal className="h-3 w-3 text-white" />
            <span className="text-[11px] text-white">Tune</span>
          </button>
        </div>

        {/* Filter pills */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex h-5 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2">
            <MapPin className="h-2.5 w-2.5 text-white/70" />
            <span className="text-[10px] text-white/70">Near Brooklyn</span>
          </div>
          
          <div className="flex h-5 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2">
            <Compass className="h-2.5 w-2.5 text-white/70" />
            <span className="text-[10px] text-white/70">This Weekend</span>
          </div>
        </div>
      </div>
    </header>
  );
}
