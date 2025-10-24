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
      {/* Create Post Button */}
      <div className="group relative">
        <button 
          onClick={onCreatePost}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-orange-500/60 hover:bg-orange-500/20 active:scale-95"
          aria-label="Create post"
        >
          <Plus className="h-6 w-6" />
        </button>
        <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100">
          <span className="whitespace-nowrap rounded-lg bg-black/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
            Create Post
          </span>
        </div>
      </div>
      
      {/* Messages Button */}
      <div className="group relative">
        <button 
          onClick={onOpenMessages}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-blue-500/60 hover:bg-blue-500/20 active:scale-95"
          aria-label="Open messages"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
        <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100">
          <span className="whitespace-nowrap rounded-lg bg-black/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
            Messages
          </span>
        </div>
      </div>
      
      {/* Global Sound Toggle Button */}
      <div className="group relative">
        <button 
          onClick={handleMuteToggle}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-white/40 hover:bg-white/20 active:scale-95"
          aria-label={isMuted ? "Unmute all" : "Mute all"}
        >
          {isMuted ? (
            <VolumeX className="h-6 w-6" />
          ) : (
            <Volume2 className="h-6 w-6" />
          )}
        </button>
        <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100">
          <span className="whitespace-nowrap rounded-lg bg-black/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
            {isMuted ? "Unmute All" : "Mute All"}
          </span>
        </div>
      </div>
    </div>
  );
}

