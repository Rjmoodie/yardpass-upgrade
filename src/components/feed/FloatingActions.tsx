import { Plus, Volume2, VolumeX, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface FloatingActionsProps {
  isMuted?: boolean;
  onMuteToggle?: () => void;
  onCreatePost?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export function FloatingActions({ 
  isMuted: controlledMuted, 
  onMuteToggle,
  onCreatePost,
  onLike,
  onComment,
  onShare,
  onSave,
  likeCount = 0,
  commentCount = 0,
  isLiked = false,
  isSaved = false,
}: FloatingActionsProps) {
  const [internalMuted, setInternalMuted] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [optimisticMuted, setOptimisticMuted] = useState<boolean | null>(null);
  
  // ✅ Simple haptic helper (avoids circular dependency)
  const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style });
    } catch {
      // Silently fail if haptics not available
    }
  };
  
  // ✅ Use optimistic state for instant feedback, fall back to controlled/internal
  const displayMuted = optimisticMuted !== null ? optimisticMuted : 
    (controlledMuted !== undefined ? controlledMuted : internalMuted);

  const handleMuteToggle = (e: React.MouseEvent) => {
    // ✅ FIX: Prevent event bubbling and default behavior
    e.stopPropagation();
    e.preventDefault();
    
    // ✅ FIX: INSTANT optimistic UI update (before async state propagation)
    const nextMuted = !displayMuted;
    setOptimisticMuted(nextMuted);
    setIsToggling(true);
    
    console.log('🔊 Mute toggle clicked!', { from: displayMuted, to: nextMuted });
    
    // ✅ UPGRADED: Use Capacitor haptics (better than vibrate API)
    triggerHaptic(ImpactStyle.Light);
    
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setInternalMuted(nextMuted);
    }
    
    // Clear optimistic state after parent updates (smooth handoff)
    setTimeout(() => {
      setOptimisticMuted(null);
      setIsToggling(false);
    }, 300);
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('❤️ Like button clicked!', { hasHandler: !!onLike, likeCount });
    triggerHaptic(ImpactStyle.Medium); // ✅ Stronger haptic for emotional action
    if (onLike) onLike();
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('💬 Comment button clicked!', { hasHandler: !!onComment, commentCount });
    triggerHaptic(ImpactStyle.Light); // ✅ Subtle haptic
    if (onComment) onComment();
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔗 Share button clicked!', { hasHandler: !!onShare });
    triggerHaptic(ImpactStyle.Light); // ✅ Subtle haptic
    if (onShare) onShare();
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔖 Save button clicked!', { hasHandler: !!onSave });
    triggerHaptic(ImpactStyle.Medium); // ✅ Medium haptic for save action
    if (onSave) onSave();
  };

  return (
    <div 
      className="fixed right-4 top-[37.5%] flex -translate-y-1/2 flex-col gap-2"
      style={{ 
        zIndex: 50,  // ✅ Higher than video overlay (z-20) to prevent click interference
        pointerEvents: 'none',
        isolation: 'isolate'
      }}
    >
      {/* Create Post Button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          console.log('➕ Create post clicked!');
          if (onCreatePost) onCreatePost();
        }}
        style={{ pointerEvents: 'auto' }}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/20 text-foreground shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-primary/60 hover:bg-primary/20 active:scale-95 cursor-pointer"
        aria-label="Create post"
      >
        <Plus className="h-5 w-5" />
      </button>
      
      {/* Divider */}
      <div className="mx-auto h-px w-6 bg-border" />
      
      {/* Like Button */}
      <button 
        onClick={handleLikeClick}
        disabled={!onLike}
        style={{ pointerEvents: 'auto' }}
        className={`flex flex-col items-center gap-0.5 transition-all ${onLike ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Like"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/20 shadow-xl backdrop-blur-xl transition-all hover:border-red-500/60 hover:bg-red-500/20">
          <Heart className={`h-5 w-5 transition-all ${isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
        </div>
        <span className="text-sm font-extrabold text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,1)] bg-background/40 px-2 py-0.5 rounded-full">
          {likeCount}
        </span>
      </button>
      
      {/* Comment Button */}
      <button 
        onClick={handleCommentClick}
        disabled={!onComment}
        style={{ pointerEvents: 'auto' }}
        className={`flex flex-col items-center gap-0.5 transition-all ${onComment ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Comment"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/20 shadow-xl backdrop-blur-xl transition-all hover:border-blue-500/60 hover:bg-blue-500/20">
          <MessageCircle className="h-5 w-5 text-foreground pointer-events-none" />
        </div>
        <span className="text-sm font-extrabold text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,1)] bg-background/40 px-2 py-0.5 rounded-full pointer-events-none">
          {commentCount}
        </span>
      </button>
      
      {/* Share Button */}
      <button 
        onClick={handleShareClick}
        disabled={!onShare}
        style={{ pointerEvents: 'auto' }}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/20 text-foreground shadow-xl backdrop-blur-xl transition-all ${onShare ? 'hover:scale-110 hover:border-green-500/60 hover:bg-green-500/20 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Share"
      >
        <Share2 className="h-5 w-5" />
      </button>
      
      {/* Save Button */}
      <button 
        onClick={handleSaveClick}
        disabled={!onSave}
        style={{ pointerEvents: 'auto' }}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/20 shadow-xl backdrop-blur-xl transition-all ${onSave ? 'hover:scale-110 hover:border-primary/60 hover:bg-primary/20 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Save"
      >
        <Bookmark className={`h-5 w-5 transition-all ${isSaved ? 'fill-primary text-primary' : 'text-foreground'}`} />
      </button>
      
      {/* Divider */}
      <div className="mx-auto h-px w-6 bg-border" />
      
      {/* Sound Toggle Button - ✅ OPTIMIZED for smooth interaction */}
      <button 
        onClick={handleMuteToggle}
        style={{ 
          pointerEvents: 'auto',
          touchAction: 'manipulation', // ✅ Prevents double-tap zoom delay on mobile
        }}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-border shadow-xl backdrop-blur-xl transition-all hover:scale-110 active:scale-95 cursor-pointer ${
          displayMuted 
            ? 'bg-muted/20 text-muted-foreground hover:border-muted-foreground/40' 
            : 'bg-primary/20 text-primary border-primary/60 hover:border-primary'
        } ${isToggling ? 'scale-95' : ''}`}
        aria-label={displayMuted ? "Unmute" : "Mute"}
        aria-pressed={!displayMuted}
      >
        {displayMuted ? (
          <VolumeX className="h-5 w-5 transition-all duration-150" />
        ) : (
          <Volume2 className="h-5 w-5 transition-all duration-150" />
        )}
      </button>
    </div>
  );
}
