import { useState, useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useToast } from '@/hooks/use-toast';
import { startConversation, type ConversationTargetType } from '@/utils/messaging';
import { useMutualFollow } from '@/hooks/useFollowGraph';
import { useNavigate } from 'react-router-dom';

interface MessageButtonProps {
  targetType: ConversationTargetType;
  targetId: string;
  targetName: string;
  asOrganizationId?: string | null;
  variant?: 'ghost' | 'outline' | 'default';
}

export function MessageButton({
  targetType,
  targetId,
  targetName,
  asOrganizationId = null,
  variant = 'outline',
}: MessageButtonProps) {
  const { requireAuth } = useAuthGuard();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const { isMutual, outgoing, incoming } = useMutualFollow(targetType === 'user' ? targetId : null);

  const helperText = useMemo(() => {
    if (targetType !== 'user') return null;
    if (isMutual) return 'Direct message';
    if (outgoing === 'pending') return 'Awaiting approval';
    if (incoming === 'accepted') return 'Accept their request to DM';
    return 'Send request';
  }, [targetType, isMutual, outgoing, incoming]);

  const handleStartConversation = () =>
    requireAuth(async () => {
      try {
        setSending(true);
        const { requestStatus, conversationId } = await startConversation({
          targetType,
          targetId,
          asOrganizationId,
          metadata: { source: 'profile_action' },
          forceRequest: targetType === 'user' && !isMutual,
        });

        toast({
          title: requestStatus === 'pending' ? 'Message request sent' : 'Conversation started',
          description:
            requestStatus === 'pending'
              ? `${targetName} needs to approve before messages are delivered.`
              : `You're now chatting with ${targetName}.`,
        });
        navigate(`/messages?conversation=${conversationId}`);
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('messaging:open', { detail: { conversationId } }));
        }, 120);
      } catch (error: any) {
        toast({
          title: 'Unable to start conversation',
          description: error?.message ?? 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setSending(false);
      }
    }, 'Sign in to message');

  return (
    <Button onClick={handleStartConversation} variant={variant} size="sm" disabled={sending} className="flex items-center gap-1">
      <MessageCircle className="h-4 w-4" />
      <span>{targetType === 'organization' ? 'Message organizer' : 'Message'}</span>
      {helperText && <span className="sr-only">{helperText}</span>}
    </Button>
  );
}
