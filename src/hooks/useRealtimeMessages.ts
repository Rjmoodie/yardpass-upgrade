import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to manage realtime subscriptions for messaging.
 * 
 * Features:
 * - Auto-subscribe to new messages in selected conversation
 * - Auto-subscribe to conversation updates (last_message_at, request_status)
 * - Proper cleanup on unmount
 * - Handles conversation switching
 * 
 * @example
 * const { subscribeToConversation, subscribeToConversations } = useRealtimeMessages({
 *   onNewMessage: (message) => {
 *     setMessages(prev => [...prev, message]);
 *   },
 *   onConversationUpdate: (conversation) => {
 *     // Refresh conversation list
 *   }
 * });
 * 
 * // When user selects a conversation:
 * useEffect(() => {
 *   if (selectedConversationId) {
 *     return subscribeToConversation(selectedConversationId);
 *   }
 * }, [selectedConversationId]);
 */

interface UseRealtimeMessagesOptions {
  /**
   * Callback fired when a new message is received in the active conversation
   */
  onNewMessage?: (message: any) => void;
  
  /**
   * Callback fired when a conversation is updated (e.g., new message, status change)
   */
  onConversationUpdate?: (conversation: any) => void;
  
  /**
   * Callback fired when a conversation is deleted
   */
  onConversationDeleted?: (conversationId: string) => void;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

export function useRealtimeMessages({
  onNewMessage,
  onConversationUpdate,
  onConversationDeleted,
  debug = false,
}: UseRealtimeMessagesOptions = {}) {
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug || (import.meta.env.DEV && localStorage.getItem('verbose_messaging') === 'true')) {
      console.log(`[RealtimeMessages] ${message}`, ...args);
    }
  }, [debug]);

  /**
   * Subscribe to messages in a specific conversation
   */
  const subscribeToConversation = useCallback((conversationId: string) => {
    // Cleanup existing subscription
    if (messageChannelRef.current) {
      log('Unsubscribing from previous conversation');
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }

    currentConversationIdRef.current = conversationId;
    log('Subscribing to conversation:', conversationId);

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'messaging',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          log('New message received:', payload.new);
          onNewMessage?.(payload.new);
        }
      )
      .subscribe((status) => {
        log('Message channel status:', status);
      });

    messageChannelRef.current = channel;

    // Return unsubscribe function
    return () => {
      log('Unsubscribing from conversation:', conversationId);
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
      currentConversationIdRef.current = null;
    };
  }, [onNewMessage, log]);

  /**
   * Subscribe to conversation list updates
   */
  const subscribeToConversations = useCallback(() => {
    // Cleanup existing subscription
    if (conversationChannelRef.current) {
      log('Unsubscribing from conversations list');
      supabase.removeChannel(conversationChannelRef.current);
      conversationChannelRef.current = null;
    }

    log('Subscribing to conversations list');

    const channel = supabase
      .channel('conversations:all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'messaging',
          table: 'direct_conversations',
        },
        (payload) => {
          log('New conversation created:', payload.new);
          onConversationUpdate?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'messaging',
          table: 'direct_conversations',
        },
        (payload) => {
          log('Conversation updated:', payload.new);
          onConversationUpdate?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'messaging',
          table: 'direct_conversations',
        },
        (payload) => {
          log('Conversation deleted:', payload.old);
          onConversationDeleted?.((payload.old as any).id);
        }
      )
      .subscribe((status) => {
        log('Conversations channel status:', status);
      });

    conversationChannelRef.current = channel;

    // Return unsubscribe function
    return () => {
      log('Unsubscribing from conversations list');
      if (conversationChannelRef.current) {
        supabase.removeChannel(conversationChannelRef.current);
        conversationChannelRef.current = null;
      }
    };
  }, [onConversationUpdate, onConversationDeleted, log]);

  /**
   * Cleanup all subscriptions on unmount
   */
  useEffect(() => {
    return () => {
      log('Cleaning up all messaging subscriptions');
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
      if (conversationChannelRef.current) {
        supabase.removeChannel(conversationChannelRef.current);
        conversationChannelRef.current = null;
      }
    };
  }, [log]);

  return {
    /**
     * Subscribe to messages in a specific conversation.
     * Returns unsubscribe function.
     */
    subscribeToConversation,

    /**
     * Subscribe to conversation list updates (new, updated, deleted).
     * Returns unsubscribe function.
     */
    subscribeToConversations,
    
    /**
     * Currently subscribed conversation ID
     */
    currentConversationId: currentConversationIdRef.current,
  };
}

/**
 * Helper: Mark conversation as read (update last_read_at)
 * 
 * @example
 * await markConversationAsRead(conversationId, 'user', userId);
 */
export async function markConversationAsRead(
  conversationId: string,
  participantType: 'user' | 'organization',
  participantId: string
) {
  const { error } = await supabase
    .schema('messaging')
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('participant_type', participantType)
    .eq(
      participantType === 'user' ? 'participant_user_id' : 'participant_org_id',
      participantId
    );

  if (error) {
    console.error('[markConversationAsRead] Error:', error);
    throw error;
  }
}


