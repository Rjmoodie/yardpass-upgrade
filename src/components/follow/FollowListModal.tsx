import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFollowList } from '@/hooks/useFollowGraph';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FollowListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'user' | 'organizer';
  targetId: string;
  direction: 'followers' | 'following';
  includePending?: boolean;
}

export function FollowListModal({ open, onOpenChange, targetType, targetId, direction, includePending = false }: FollowListModalProps) {
  const { rows, loading, reload } = useFollowList({ targetType, targetId, direction, includePending, enabled: open });
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const title = useMemo(() => {
    if (direction === 'followers') return includePending ? 'Followers & Requests' : 'Followers';
    return 'Following';
  }, [direction, includePending]);

  const handleDecision = async (followId: string, status: 'accepted' | 'declined') => {
    try {
      setUpdating(followId);
      const { error } = await supabase
        .from('follows')
        .update({ status })
        .eq('id', followId);
      if (error) throw error;
      toast({
        title: status === 'accepted' ? 'Follow request approved' : 'Follow request declined',
      });
      await reload();
    } catch (err: any) {
      toast({
        title: 'Unable to update follow request',
        description: err?.message ?? 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] w-full max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            View and manage {direction === 'followers' ? 'followers' : 'following'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <div className="space-y-0 divide-y">
            {loading && (
              <div className="space-y-3 p-6">
                {[0, 1, 2].map(idx => (
                  <div key={idx} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && rows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {direction === 'followers'
                  ? 'No followers yet. Share your profile to grow your network.'
                  : 'Not following anyone yet.'}
              </div>
            )}

            {!loading && rows.length > 0 && (
              <ul className="divide-y">
                {rows.map(row => (
                  <li key={row.id} className="flex items-center gap-3 px-6 py-4">
                    <Avatar className="h-10 w-10">
                      {row.avatar_url ? <AvatarImage src={row.avatar_url} alt={row.display_name} /> : null}
                      <AvatarFallback>{row.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">{row.display_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{row.actor_type}</span>
                    </div>
                    {row.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updating === row.id}
                          onClick={() => handleDecision(row.id, 'declined')}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          disabled={updating === row.id}
                          onClick={() => handleDecision(row.id, 'accepted')}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (row.actor_type === 'organization') {
                          window.location.assign(`/org/${row.actor_id}`);
                        } else {
                          window.location.assign(`/u/${row.actor_id}`);
                        }
                      }}
                    >
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
