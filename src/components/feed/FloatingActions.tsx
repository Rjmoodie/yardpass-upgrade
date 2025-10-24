import { Plus, MessageSquare, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

interface FloatingActionsProps {
  isMuted?: boolean;
  onMuteToggle?: () => void;
  onCreatePost?: () => void;
  onOpenMessages?: () => void;
}

export function FloatingActions({ 
  isMuted: controlledMuted, 
  onMuteToggle,
  onCreatePost,
  onOpenMessages 
}: FloatingActionsProps) {
  const [internalMuted, setInternalMuted] = useState(true);
  const isMuted = controlledMuted !== undefined ? controlledMuted : internalMuted;

  const handleMuteToggle = () => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setInternalMuted(!internalMuted);
    }
  };

  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-3 sm:right-4 sm:gap-4 md:right-6">
      <button 
        onClick={onCreatePost}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-14 sm:w-14"
        aria-label="Create post"
      >
        <Plus className="h-5 w-5 text-white sm:h-6 sm:w-6" />
      </button>
      
      <button 
        onClick={onOpenMessages}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-14 sm:w-14"
        aria-label="Open messages"
      >
        <MessageSquare className="h-5 w-5 text-white sm:h-6 sm:w-6" />
      </button>
      
      <button 
        onClick={handleMuteToggle}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-black/70 active:scale-95 sm:h-14 sm:w-14"
        aria-label={isMuted ? "Unmute" : "Mute"}
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

