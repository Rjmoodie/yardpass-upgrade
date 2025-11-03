import { Button } from '@/components/ui/button';
import { useFollow, type FollowTargetType } from '@/hooks/useFollow';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useRealtimeFollow } from '@/hooks/useRealtimeFollow';
import { handleUserFriendlyError } from '@/utils/errorMessages';
import { useToast } from '@/hooks/use-toast';

export function FollowButton({
  targetType,
  targetId,
  size = 'sm',
  onFollowUpdate
}: {
  targetType: FollowTargetType;
  targetId: string;
  size?: 'sm' | 'default';
  onFollowUpdate?: (status: string) => void;
}) {
  const { state, toggle, loading } = useFollow({ type: targetType, id: targetId });
  const { requireAuth } = useAuthGuard();
  const { toast } = useToast();

  // Real-time follow updates
  const { getFollowState } = useRealtimeFollow();
  const realtimeFollowState = getFollowState(targetType, targetId);

  // Use real-time state if available, otherwise fall back to hook state
  const currentFollowState = realtimeFollowState !== undefined ? realtimeFollowState : state === 'accepted';

  const handleToggle = async () => {
    try {
      await toggle();
      // Notify parent component of follow status change
      if (onFollowUpdate) {
        const newStatus = state === 'accepted' ? 'none' : 'accepted';
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
}