import { supabase } from '@/integrations/supabase/client';

export type ConversationTargetType = 'user' | 'organization';

interface StartConversationOptions {
  targetType: ConversationTargetType;
  targetId: string;
  subject?: string;
  asOrganizationId?: string | null;
  forceRequest?: boolean;
  metadata?: Record<string, unknown>;
}

export async function startConversation({
  targetType,
  targetId,
  subject,
  asOrganizationId,
  forceRequest = false,
  metadata = {},
}: StartConversationOptions) {
  const { data: auth } = await supabase.auth.getUser();
  const currentUser = auth?.user;
  if (!currentUser) throw new Error('You must be signed in to message.');

  const actorType = asOrganizationId ? 'organization' : 'user';
  const actorUserId = asOrganizationId ? null : currentUser.id;
  const actorOrgId = asOrganizationId ?? null;

  const requestStatus = forceRequest ? 'pending' : 'accepted';

  const { data: conversation, error: convoError } = await supabase
    .from('direct_conversations')
    .insert({
      subject: subject ?? null,
      request_status: requestStatus,
      metadata: {
        created_by: currentUser.id,
        created_by_type: actorType,
        target_type: targetType,
        target_id: targetId,
        ...metadata,
      },
    })
    .select('id,request_status')
    .maybeSingle();

  if (convoError) throw convoError;
  const conversationId = conversation?.id;
  if (!conversationId) throw new Error('Failed to create conversation.');

  const participantRows = [
    {
      conversation_id: conversationId,
      participant_type: actorType,
      participant_user_id: actorUserId,
      participant_org_id: actorOrgId,
    },
    {
      conversation_id: conversationId,
      participant_type: targetType,
      participant_user_id: targetType === 'user' ? targetId : null,
      participant_org_id: targetType === 'organization' ? targetId : null,
    },
  ];

  const { error: participantError } = await supabase
    .from('conversation_participants')
    .insert(participantRows);

  if (participantError) throw participantError;

  return { conversationId, requestStatus: conversation?.request_status ?? requestStatus };
}
