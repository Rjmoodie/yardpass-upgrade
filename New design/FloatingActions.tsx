import { Plus, MessageSquare, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

export function FloatingActions() {
  const [isMuted, setIsMuted] = useState(true);

  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-3 sm:right-4 sm:gap-4 md:right-6">
      <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-14 sm:w-14">
        <Plus className="h-5 w-5 text-white sm:h-6 sm:w-6" />
      </button>
      
      <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-14 sm:w-14">
        <MessageSquare className="h-5 w-5 text-white sm:h-6 sm:w-6" />
      </button>
      
      <button 
        onClick={() => setIsMuted(!isMuted)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-14 sm:w-14"
      >
        {isMuted ? (
          <VolumeX className="h-5 w-5 text-white sm:h-6 sm:w-6" />
        ) : (
          <Volume2 className="h-5 w-5 text-white sm:h-6 sm:w-6" />
        )}
      </button>
    </div>
  );
}