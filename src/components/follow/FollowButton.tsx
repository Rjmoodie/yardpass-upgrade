import React from 'react';
import { Button } from '@/components/ui/button';
import { useFollow, type FollowTargetType, type FollowState } from '@/hooks/useFollow';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useFollowRealtime } from '@/contexts/FollowRealtimeContext';
import { handleUserFriendlyError } from '@/utils/errorMessages';
import { useToast } from '@/hooks/use-toast';

interface FollowButtonProps {
  targetType: FollowTargetType;
  targetId: string;
  size?: 'sm' | 'default';
  onFollowUpdate?: (status: string) => void;
  /** Optional follow state from batch query. If provided, skips individual query. */
  followState?: FollowState;
  /** Optional loading state when using batch mode */
  isLoading?: boolean;
}

const FollowButtonComponent = ({
  targetType,
  targetId,
  size = 'sm',
  onFollowUpdate,
  followState: batchFollowState,
  isLoading: batchLoading
}: FollowButtonProps) => {
  // If followState is provided from batch, use it; otherwise query individually
  const followHook = useFollow({ type: targetType, id: targetId });
  const { state: hookState, toggle, loading: hookLoading } = followHook;
  
  // Use batch state if provided, otherwise fall back to hook state
  const state = batchFollowState !== undefined ? batchFollowState : hookState;
  const loading = batchLoading !== undefined ? batchLoading : hookLoading;
  
  const { requireAuth } = useAuthGuard();
  const { toast } = useToast();

  // Real-time follow updates (uses shared context subscription, not per-button subscription)
  const { isFollowing: realtimeIsFollowing } = useFollowRealtime();
  const realtimeFollowState = realtimeIsFollowing(targetType, targetId);

  // Use real-time state if available, otherwise fall back to hook/batch state
  const currentFollowState = realtimeFollowState !== undefined ? realtimeFollowState : state === 'accepted';

  const handleToggle = async () => {
    try {
      // If using batch mode, we still need to use the hook's toggle
      // (the hook manages the actual follow/unfollow logic)
      await toggle();
      // Notify parent component of follow status change
      if (onFollowUpdate) {
        const newStatus = state === 'accepted' || state === 'pending' ? 'none' : 'accepted';
        onFollowUpdate(newStatus);
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
      
      const { message } = handleUserFriendlyError(error, { 
        feature: 'follow', 
        action: 'follow' 
      });
      
      toast({ 
        title: 'Unable to follow', 
        description: message, 
        variant: 'destructive' 
      });
    }
  };

  const label = (() => {
    if (state === 'pending') return 'Requested';
    return currentFollowState ? 'Following' : 'Follow';
  })();

  // Size classes that respect the size prop
  const sizeClasses = size === 'default' 
    ? 'min-h-[44px] px-5 text-sm font-medium min-w-[110px]' 
    : 'h-8 px-3 text-xs min-w-[80px]';

  return (
    <Button
      variant={currentFollowState || state === 'pending' ? 'secondary' : 'default'}
      size={size}
      disabled={loading}
      onClick={() => requireAuth(() => handleToggle(), 'Please sign in to follow')}
      className={sizeClasses}
    >
      {label}
    </Button>
  );
};

// 🚀 PERF: Memoize to prevent unnecessary re-renders when parent re-renders
export const FollowButton = React.memo(FollowButtonComponent, (prev, next) => {
  // Only re-render if props actually changed
  return (
    prev.targetType === next.targetType &&
    prev.targetId === next.targetId &&
    prev.size === next.size &&
    prev.onFollowUpdate === next.onFollowUpdate &&
    prev.followState === next.followState &&
    prev.isLoading === next.isLoading
  );
});