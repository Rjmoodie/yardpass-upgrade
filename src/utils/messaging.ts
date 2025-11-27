import { supabase } from '@/integrations/supabase/client';

/**
 * Type of conversation target (user or organization)
 */
export type ConversationTargetType = 'user' | 'organization';

/**
 * Options for starting a new conversation
 */
interface StartConversationOptions {
  /** Type of target (user or organization) */
  targetType: ConversationTargetType;
  /** ID of the target user or organization */
  targetId: string;
  /** Optional subject line for the conversation */
  subject?: string;
  /** Optional organization ID to send as (for organization-to-organization messaging) */
  asOrganizationId?: string | null;
  /** If true, creates conversation with 'pending' status (requires approval) */
  forceRequest?: boolean;
  /** Additional metadata to store with the conversation */
  metadata?: Record<string, unknown>;
}

/**
 * Starts a new direct conversation with a user or organization.
 * 
 * Creates a conversation record and adds both participants. The conversation
 * can be sent as the current user or on behalf of an organization.
 * 
 * **RLS Policy Requirements:**
 * - `created_by` must equal `auth.uid()` for RLS to allow the insert
 * - User must be authenticated
 * 
 * @param options - Configuration options for the conversation
 * @returns Promise resolving to conversation ID and request status
 * @throws Error if user is not authenticated or conversation creation fails
 * 
 * @example
 * ```typescript
 * // Start a conversation with a user
 * const { conversationId } = await startConversation({
 *   targetType: 'user',
 *   targetId: 'user-uuid-123',
 *   subject: 'Event collaboration'
 * });
 * 
 * // Start as an organization
 * const { conversationId } = await startConversation({
 *   targetType: 'user',
 *   targetId: 'user-uuid-123',
 *   asOrganizationId: 'org-uuid-456',
 *   subject: 'Partnership inquiry'
 * });
 * ```
 */
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
      created_by: currentUser.id, // ✅ Required by RLS policy: auth.uid() = created_by
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
