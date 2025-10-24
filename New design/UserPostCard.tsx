import { Heart, MessageCircle, Share, MoreVertical } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { VideoPlayer } from "./VideoPlayer";
import { useState } from "react";

interface UserPostCardProps {
  post: {
    id: string;
    user: {
      name: string;
      avatar: string;
    };
    eventName: string;
    timestamp: string;
    caption: string;
    media: {
      type: "image" | "video";
      url: string;
      thumbnail?: string;
    };
    likes: number;
    comments: number;
  };
}

export function UserPostCard({ post }: UserPostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showFullCaption, setShowFullCaption] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const truncatedCaption = post.caption.length > 120 
    ? post.caption.slice(0, 120) + "..." 
    : post.caption;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-white/[0.12] bg-white/[0.05] shadow-[0_40px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {/* Inner glow */}
      <div className="absolute inset-0 -z-10 opacity-70" style={{
        background: 'radial-gradient(circle at top, rgba(255,255,255,0.16) 0%, transparent 55%)'
      }} />

      <div className="flex h-full flex-col">
        {/* Post Header */}
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/20">
            <ImageWithFallback
              src={post.user.avatar}
              alt={post.user.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex-1">
            <div className="text-white">{post.user.name}</div>
            <div className="text-sm text-white/60">
              {post.eventName} • {post.timestamp}
            </div>
          </div>

          <button className="rounded-full p-2 transition-colors hover:bg-white/10">
            <MoreVertical className="h-5 w-5 text-white/70" />
          </button>
        </div>

        {/* Media Area */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
          {post.media.type === "video" ? (
            <VideoPlayer src={post.media.url} poster={post.media.thumbnail} />
          ) : (
            <div className="relative w-full overflow-hidden rounded-xl" style={{ maxHeight: "60vh" }}>
              <ImageWithFallback
                src={post.media.url}
                alt="Post media"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="px-4 py-3">
          <p className="text-sm text-white/90">
            {showFullCaption ? post.caption : truncatedCaption}
            {post.caption.length > 120 && (
              <button
                onClick={() => setShowFullCaption(!showFullCaption)}
                className="ml-2 text-white/60 hover:text-white"
              >
                {showFullCaption ? "less" : "more"}
              </button>
            )}
          </p>
        </div>

        {/* Action Rail */}
        <div className="flex items-center justify-around border-t border-white/10 p-4">
          <button
            onClick={handleLike}
            className="flex min-w-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                liked ? "fill-red-600 text-red-600" : "text-white"
              }`}
            />
            <span className="text-sm text-white/80">{likeCount}</span>
          </button>

          <button className="flex min-w-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95">
            <MessageCircle className="h-5 w-5 text-white" />
            <span className="text-sm text-white/80">{post.comments}</span>
          </button>

          <button className="flex min-w-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95">
            <Share className="h-5 w-5 text-white" />
            <span className="text-sm text-white/80">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}
