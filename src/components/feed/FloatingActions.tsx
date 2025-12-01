import { Plus, Volume2, VolumeX, Heart, MessageCircle, Share2, Bookmark, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import * as React from "react";
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
  onFiltersClick?: () => void; // ✅ Add filter button handler
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
  onFiltersClick,
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

  const [commentHighlighted, setCommentHighlighted] = React.useState(false);

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('💬 Comment button clicked!', { hasHandler: !!onComment, commentCount });
    triggerHaptic(ImpactStyle.Light); // ✅ Subtle haptic
    
    // ✅ Visual feedback: brief highlight pulse
    setCommentHighlighted(true);
    setTimeout(() => setCommentHighlighted(false), 300);
    
    if (onComment) {
      // ✅ Slight delay for visual feedback before opening modal
      setTimeout(() => onComment(), 100);
    }
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
      className="floating-actions"
      style={{ 
        position: 'fixed',
        right: '16px',
        top: '35%', // ✅ Moved higher to avoid event card overlap
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 50,
        pointerEvents: 'none',
        isolation: 'isolate',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        marginRight: 'max(0px, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Filter Button */}
      {onFiltersClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onFiltersClick) onFiltersClick();
          }}
          style={{ pointerEvents: 'auto' }}
          className="flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border bg-muted/20 text-foreground shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-primary/60 hover:bg-primary/20 active:scale-95 cursor-pointer touch-manipulation"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5" />
        </button>
      )}

      {/* Divider (only if filter button is shown) */}
      {onFiltersClick && <div className="mx-auto h-px w-6 bg-border" />}

      {/* Create Post Button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          console.log('➕ Create post clicked!');
          if (onCreatePost) onCreatePost();
        }}
        style={{ pointerEvents: 'auto' }}
        className="flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border bg-muted/20 text-foreground shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-primary/60 hover:bg-primary/20 active:scale-95 cursor-pointer touch-manipulation"
        aria-label="Create post"
      >
        <Plus className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5" />
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
        <div className="flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border bg-muted/20 shadow-xl backdrop-blur-xl transition-all hover:border-red-500/60 hover:bg-red-500/20 touch-manipulation">
          <Heart className={`h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5 transition-all ${isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
        </div>
        <span className="text-[10px] sm:text-xs md:text-sm font-extrabold text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,1)] bg-background/40 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full min-w-[18px] sm:min-w-[20px] text-center">
          {likeCount}
        </span>
      </button>
      
      {/* Comment Button - Enhanced for seamless detection */}
      <button 
        onClick={handleCommentClick}
        disabled={!onComment}
        style={{ pointerEvents: 'auto' }}
        className={`flex flex-col items-center gap-0.5 transition-all ${onComment ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Add a comment"
        title="Add a comment"
      >
        <div className={`
          flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border shadow-xl backdrop-blur-xl 
          transition-all duration-200 touch-manipulation
          ${commentHighlighted 
            ? 'border-blue-500 bg-blue-500/40 scale-110 ring-4 ring-blue-500/30' 
            : 'border-border bg-muted/20 hover:border-blue-500/60 hover:bg-blue-500/20'
          }
          ${commentCount > 0 ? 'border-blue-500/40 bg-blue-500/10' : ''}
        `}>
          <MessageCircle className={`h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5 pointer-events-none transition-colors ${
            commentHighlighted || commentCount > 0 ? 'text-blue-400' : 'text-foreground'
          }`} />
        </div>
        <span className={`
          text-[10px] sm:text-xs md:text-sm font-extrabold drop-shadow-[0_2px_12px_rgba(0,0,0,1)] px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full pointer-events-none transition-colors min-w-[18px] sm:min-w-[20px] text-center
          ${commentHighlighted || commentCount > 0 
            ? 'text-blue-400 bg-blue-500/20' 
            : 'text-foreground bg-background/40'
          }
        `}>
          {commentCount}
        </span>
      </button>
      
      {/* Share Button */}
      <button 
        onClick={handleShareClick}
        disabled={!onShare}
        style={{ pointerEvents: 'auto' }}
        className={`flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border bg-muted/20 text-foreground shadow-xl backdrop-blur-xl transition-all ${onShare ? 'hover:scale-110 hover:border-green-500/60 hover:bg-green-500/20 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Share"
      >
        <Share2 className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5" />
      </button>
      
      {/* Save Button */}
      <button 
        onClick={handleSaveClick}
        disabled={!onSave}
        style={{ pointerEvents: 'auto' }}
        className={`flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border bg-muted/20 shadow-xl backdrop-blur-xl transition-all ${onSave ? 'hover:scale-110 hover:border-primary/60 hover:bg-primary/20 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Save"
      >
        <Bookmark className={`h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5 transition-all ${isSaved ? 'fill-primary text-primary' : 'text-foreground'}`} />
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
        className={`flex h-8 w-8 min-[375px]:h-9 min-[375px]:w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-border shadow-xl backdrop-blur-xl transition-all hover:scale-110 active:scale-95 cursor-pointer touch-manipulation ${
          displayMuted 
            ? 'bg-muted/20 text-muted-foreground hover:border-muted-foreground/40' 
            : 'bg-primary/20 text-primary border-primary/60 hover:border-primary'
        } ${isToggling ? 'scale-95' : ''}`}
        aria-label={displayMuted ? "Unmute" : "Mute"}
        aria-pressed={!displayMuted}
      >
        {displayMuted ? (
          <VolumeX className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5 transition-all duration-150" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 sm:h-5 sm:w-5 transition-all duration-150" />
        )}
      </button>
    </div>
  );
}
