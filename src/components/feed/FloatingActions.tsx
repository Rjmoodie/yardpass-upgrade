import { Plus, Volume2, VolumeX, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { useState } from "react";
import { useEngagementActions } from "@/hooks/useEngagementActions";

interface FloatingActionsProps {
  postId?: string;
  eventId?: string;
  isMuted?: boolean;
  onMuteToggle?: () => void;
  onCreatePost?: () => void;
  onCommentModalOpen?: () => void;
  onSave?: () => void;
  initialLiked?: boolean;
  initialLikeCount?: number;
  initialCommentCount?: number;
  isSaved?: boolean;
}

export function FloatingActions({ 
  postId,
  eventId,
  isMuted: controlledMuted, 
  onMuteToggle,
  onCreatePost,
  onCommentModalOpen,
  onSave,
  initialLiked = false,
  initialLikeCount = 0,
  initialCommentCount = 0,
  isSaved = false,
}: FloatingActionsProps) {
  const [internalMuted, setInternalMuted] = useState(true);
  const isMuted = controlledMuted !== undefined ? controlledMuted : internalMuted;

  // Use engagement hook for like/comment/share - same as ActionRail
  const engagement = postId && eventId ? useEngagementActions(postId, eventId, {
    isLiked: initialLiked,
    likeCount: initialLikeCount,
    commentCount: initialCommentCount
  }) : null;

  // Get optimistic counts from engagement hook
  const likeCount = engagement?.likeCount ?? initialLikeCount;
  const commentCount = engagement?.commentCount ?? initialCommentCount;
  const isLiked = engagement?.isLiked ?? initialLiked;

  // Debug logging
  console.log('🎯 FloatingActions rendered:', {
    postId,
    eventId,
    hasEngagement: !!engagement,
    likeCount,
    commentCount,
    isLiked,
    isSaved
  });

  const handleMuteToggle = () => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setInternalMuted(!internalMuted);
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('❤️ Like button clicked!', { postId, eventId, hasEngagement: !!engagement });
    if (engagement) {
      engagement.handleLike();
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('💬 Comment button clicked!', { postId, eventId });
    if (engagement) {
      engagement.handleComment({ openCommentModal: onCommentModalOpen });
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔗 Share button clicked!', { postId, eventId });
    if (engagement) {
      engagement.handleShare();
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔖 Save button clicked!', { hasHandler: !!onSave });
    if (onSave) onSave();
  };

  const hasEngagement = !!postId && !!eventId;

  return (
    <div 
      className="fixed right-4 top-[37.5%] flex -translate-y-1/2 flex-col gap-2"
      style={{ 
        zIndex: 999999,
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
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-orange-500/60 hover:bg-orange-500/20 active:scale-95 cursor-pointer"
        aria-label="Create post"
      >
        <Plus className="h-5 w-5" />
      </button>
      
      {/* Divider */}
      <div className="mx-auto h-px w-6 bg-white/20" />
      
      {/* Like Button */}
      <button 
        onClick={handleLikeClick}
        disabled={!hasEngagement}
        style={{ pointerEvents: 'auto' }}
        className={`flex flex-col items-center gap-0.5 transition-all ${hasEngagement ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Like"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-xl backdrop-blur-xl transition-all hover:border-red-500/60 hover:bg-red-500/20">
          <Heart className={`h-5 w-5 transition-all ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </div>
        <span className="text-[11px] font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          {likeCount}
        </span>
      </button>
      
      {/* Comment Button */}
      <button 
        onClick={handleCommentClick}
        disabled={!hasEngagement}
        style={{ 
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 1
        }}
        className={`flex flex-col items-center gap-0.5 transition-all ${hasEngagement ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Comment"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-xl backdrop-blur-xl transition-all hover:border-blue-500/60 hover:bg-blue-500/20">
          <MessageCircle className="h-5 w-5 text-white pointer-events-none" />
        </div>
        <span className="text-[11px] font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] pointer-events-none">
          {commentCount}
        </span>
      </button>
      
      {/* Share Button */}
      <button 
        onClick={handleShareClick}
        disabled={!hasEngagement}
        style={{ pointerEvents: 'auto' }}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all ${hasEngagement ? 'hover:scale-110 hover:border-green-500/60 hover:bg-green-500/20 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Share"
      >
        <Share2 className="h-5 w-5" />
      </button>
      
      {/* Save Button */}
      <button 
        onClick={handleSaveClick}
        disabled={!onSave}
        style={{ pointerEvents: 'auto' }}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-xl backdrop-blur-xl transition-all ${onSave ? 'hover:scale-110 hover:border-orange-500/60 hover:bg-orange-500/20 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
        aria-label="Save"
      >
        <Bookmark className={`h-5 w-5 transition-all ${isSaved ? 'fill-orange-500 text-orange-500' : 'text-white'}`} />
      </button>
      
      {/* Divider */}
      <div className="mx-auto h-px w-6 bg-white/20" />
      
      {/* Sound Toggle Button */}
      <button 
        onClick={handleMuteToggle}
        style={{ pointerEvents: 'auto' }}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:border-white/40 hover:bg-white/20 active:scale-95 cursor-pointer"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
