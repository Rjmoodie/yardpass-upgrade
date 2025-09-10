import { Button } from '@/components/ui/button';
import { useFollow } from '@/hooks/useFollow';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export function FollowButton({
  targetType,
  targetId,
  size = 'sm'
}: {
  targetType: 'organizer' | 'event';
  targetId: string;
  size?: 'sm' | 'default';
}) {
  const { isFollowing, toggle, loading } = useFollow({ type: targetType, id: targetId });
  const { requireAuth } = useAuthGuard();

  return (
    <Button
      variant={isFollowing ? 'secondary' : 'default'}
      size={size}
      disabled={loading}
      onClick={() => requireAuth(() => toggle(), 'Please sign in to follow')}
      className="h-6 px-2 text-xs"
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}