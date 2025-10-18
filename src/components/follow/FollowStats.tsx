import { useState, useMemo } from 'react';
import { useFollowCounts } from '@/hooks/useFollowGraph';
import { FollowListModal } from './FollowListModal';

interface FollowStatsProps {
  targetType: 'user' | 'organizer';
  targetId: string;
  enablePendingReview?: boolean;
}

export function FollowStats({ targetType, targetId, enablePendingReview = false }: FollowStatsProps) {
  const { counts } = useFollowCounts(targetType, targetId);
  const [modal, setModal] = useState<'followers' | 'following' | null>(null);

  const items = useMemo(() => {
    const data = [
      { key: 'followers' as const, label: 'Followers', value: counts.followerCount },
      { key: 'following' as const, label: 'Following', value: counts.followingCount },
    ];
    if (enablePendingReview && counts.pendingCount > 0) {
      data.unshift({ key: 'followers' as const, label: 'Requests', value: counts.pendingCount });
    }
    return data;
  }, [counts.followerCount, counts.followingCount, counts.pendingCount, enablePendingReview]);

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          onClick={() => setModal(item.key)}
          className="flex flex-col items-start text-left"
        >
          <span className="text-base sm:text-lg font-semibold">{item.value}</span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</span>
        </button>
      ))}

      <FollowListModal
        open={modal === 'followers'}
        onOpenChange={(open) => setModal(open ? 'followers' : null)}
        targetType={targetType}
        targetId={targetId}
        direction="followers"
        includePending={enablePendingReview}
      />

      <FollowListModal
        open={modal === 'following'}
        onOpenChange={(open) => setModal(open ? 'following' : null)}
        targetType={targetType}
        targetId={targetId}
        direction="following"
      />
    </div>
  );
}
