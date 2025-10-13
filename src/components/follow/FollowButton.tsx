import { Button } from '@/components/ui/button';
import { useFollow, type FollowTargetType } from '@/hooks/useFollow';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useRealtimeFollow } from '@/hooks/useRealtimeFollow';

export function FollowButton({
  targetType,
  targetId,
  size = 'sm'
}: {
  targetType: FollowTargetType;
  targetId: string;
  size?: 'sm' | 'default';
}) {
  const { state, toggle, loading } = useFollow({ type: targetType, id: targetId });
  const { requireAuth } = useAuthGuard();

  // Real-time follow updates
  const { getFollowState } = useRealtimeFollow();
  const realtimeFollowState = getFollowState(targetType, targetId);

  // Use real-time state if available, otherwise fall back to hook state
  const currentFollowState = realtimeFollowState !== undefined ? realtimeFollowState : state === 'accepted';

  const label = (() => {
    if (state === 'pending') return 'Requested';
    return currentFollowState ? 'Following' : 'Follow';
  })();

  return (
    <Button
      variant={currentFollowState || state === 'pending' ? 'secondary' : 'default'}
      size={size}
      disabled={loading}
      onClick={() => requireAuth(() => toggle(), 'Please sign in to follow')}
      className="h-6 px-2 text-xs"
    >
      {label}
    </Button>
  );
}