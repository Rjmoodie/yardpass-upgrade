import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  Send,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  UserPlus,
  Search,
  Phone,
  Video,
  Paperclip,
  Smile,
} from 'lucide-react';
import { BrandedSpinner } from '../BrandedSpinner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { handleUserFriendlyError } from '@/utils/errorMessages';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { featureFlags } from '@/config/featureFlags';
import { UserSearchModal } from '@/components/follow/UserSearchModal';
import { startConversation } from '@/utils/messaging';

interface RawParticipant {
  participant_type: 'user' | 'organization';
  participant_user_id?: string | null;
  participant_org_id?: string | null;
  joined_at: string;
  last_read_at?: string | null;
}

interface InboxRow {
  id: string;
  subject: string | null;
  request_status: 'open' | 'pending' | 'accepted' | 'declined';
  last_message_at: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
  participants: RawParticipant[];
}

interface ConversationParticipant extends RawParticipant {
  displayName: string;
  avatarUrl: string | null;
}

interface ConversationListItem {
  id: string;
  subject: string | null;
  request_status: InboxRow['request_status'];
  last_message_at: string | null;
  created_at: string;
  participants: ConversationParticipant[];
}

interface DirectMessageRow {
  id: string;
  body: string;
  created_at: string;
  sender_type: 'user' | 'organization';
  sender_user_id: string | null;
  sender_org_id: string | null;
  status: string;
}

type IdentityOption =
  | { type: 'user'; id: string; label: string }
  | { type: 'organization'; id: string; label: string };

const MAX_MESSAGE_LENGTH = 1000;

export function MessagingCenter() {
  const { user, profile } = useAuth();
  const { organizations } = useOrganizations(user?.id);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageRow[]>([]);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeIdentity, setActiveIdentity] = useState<IdentityOption | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  // Unread counts per conversation (conversation_id -> count)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Pagination state: cursor for loading older messages
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // ✅ FEATURE FLAG CHECK
  if (!featureFlags.messaging.enabled) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Messaging
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Messaging is coming soon! Check back later to connect with other attendees and organizers.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            💡 <strong>Developers:</strong> Enable locally with{' '}
            <code className="bg-muted px-2 py-1 rounded">
              localStorage.setItem('feature_messaging', 'true')
            </code>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Reset state when user logs out
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setSelectedId(null);
      setMessages([]);
      setLoading(false);
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: conversationsRaw, error: conversationsError } = await supabase
        .from('direct_conversations')
        .select(
          `
          id,
          subject,
          request_status,
          last_message_at,
          created_at,
          metadata,
          conversation_participants (
            participant_type,
            participant_user_id,
            participant_org_id,
            joined_at,
            last_read_at
          )
        `,
        )
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      const rows = (conversationsRaw ?? []) as any[];
      const orgIds = new Set((organizations ?? []).map((o) => o.id));

      // Filter conversations where the user (or their org) is a participant
      const filtered = rows.filter((row) =>
        row.conversation_participants?.some((participant: any) => {
          if (participant.participant_type === 'user') {
            return participant.participant_user_id === user.id;
          }
          return participant.participant_org_id
            ? orgIds.has(participant.participant_org_id)
            : false;
        }),
      );

      const userIds = new Set<string>();
      const organizationIds = new Set<string>();

      filtered.forEach((row) => {
        row.conversation_participants?.forEach((participant: any) => {
          if (participant.participant_type === 'user' && participant.participant_user_id) {
            userIds.add(participant.participant_user_id);
          }
          if (participant.participant_type === 'organization' && participant.participant_org_id) {
            organizationIds.add(participant.participant_org_id);
          }
        });
      });

      const [userProfiles, orgRows] = await Promise.all([
        userIds.size
          ? supabase
              .from('user_profiles')
              .select('user_id,display_name,photo_url')
              .in('user_id', Array.from(userIds))
          : Promise.resolve({ data: [] as any[], error: null }),
        organizationIds.size
          ? supabase
              .from('organizations')
              .select('id,name,logo_url')
              .in('id', Array.from(organizationIds))
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (userProfiles.error) throw userProfiles.error;
      if (orgRows.error) throw orgRows.error;

      const userMap = new Map<string, { display_name: string; photo_url: string | null }>();
      (userProfiles.data ?? []).forEach((row: any) => {
        userMap.set(row.user_id, {
          display_name: row.display_name ?? 'Member',
          photo_url: row.photo_url ?? null,
        });
      });

      const orgMap = new Map<string, { display_name: string; photo_url: string | null }>();
      (orgRows.data ?? []).forEach((row: any) => {
        orgMap.set(row.id, {
          display_name: row.name ?? 'Organization',
          photo_url: row.logo_url ?? null,
        });
      });

      // Calculate unread counts: messages where created_at > last_read_at (single source of truth)
      const unreadCountsMap: Record<string, number> = {};
      
      // Batch query unread counts for all conversations
      const conversationIds = filtered.map(row => row.id);
      if (conversationIds.length > 0) {
        // For each conversation, find user's last_read_at and count unread messages
        await Promise.all(
          filtered.map(async (row) => {
            const conversationId = row.id;
            // Find current user's participant record (single source of truth)
            const userParticipant = (row.conversation_participants || []).find((p: any) => 
              p.participant_type === 'user' && p.participant_user_id === user.id
            );
            
            const lastReadAt = userParticipant?.last_read_at 
              ? userParticipant.last_read_at
              : null;
            
            // Query unread messages: created_at > last_read_at AND not sent by current user
            const { count, error: countError } = await supabase
              .from('direct_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conversationId)
              .gt('created_at', lastReadAt || '1970-01-01')
              .neq('sender_user_id', user.id); // Don't count own messages
            
            if (!countError && count !== null) {
              unreadCountsMap[conversationId] = count;
            }
          })
        );
      }
      
      setUnreadCounts(unreadCountsMap);

      const mapped = filtered.map<ConversationListItem>((row) => ({
        id: row.id,
        subject: row.subject,
        request_status: row.request_status,
        last_message_at: row.last_message_at,
        created_at: row.created_at,
        participants: (row.conversation_participants || []).map((participant: any) => {
          if (participant.participant_type === 'organization' && participant.participant_org_id) {
            const details =
              orgMap.get(participant.participant_org_id) ?? {
                display_name: 'Organization',
                photo_url: null,
              };
            return {
              ...participant,
              displayName: details.display_name,
              avatarUrl: details.photo_url,
            } satisfies ConversationParticipant;
          }
          const details = participant.participant_user_id
            ? userMap.get(participant.participant_user_id)
            : { display_name: 'Member', photo_url: null };
          return {
            ...participant,
            displayName: details?.display_name ?? 'Member',
            avatarUrl: details?.photo_url ?? null,
          } satisfies ConversationParticipant;
        }),
      }));

      setConversations(mapped);

      // Auto-select first conversation if nothing selected
      if (!selectedId && mapped.length) {
        setSelectedId(mapped[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations', err);

      const { message } = handleUserFriendlyError(err, {
        feature: 'messaging',
        action: 'load conversations',
      });

      if (err?.message?.includes('does not exist')) {
        console.log('Messaging system not available - showing empty state');
        setConversations([]);
      } else {
        toast({
          title: 'Unable to load messages',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [organizations, selectedId, toast, user]);

  // Cursor-based pagination: load messages (newest first, load older on scroll)
  const loadMessages = useCallback(
    async (conversationId: string, cursor?: string, append = false) => {
      try {
        setLoadingMoreMessages(true);
        
        // Cursor-based query: if cursor provided, load messages older than cursor
        let query = supabase
          .from('direct_messages')
          .select('id,body,created_at,sender_type,sender_user_id,sender_org_id,status')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false }) // Newest first
          .limit(50); // Load 50 messages per page
        
        // If cursor provided, load older messages (created_at < cursor)
        if (cursor) {
          query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;

        if (error) {
          if (error.message?.includes('does not exist')) {
            console.log('Messaging system not available');
            setMessages([]);
            setHasMoreMessages(false);
            return;
          }
          throw error;
        }

        const newMessages = (data ?? []) as DirectMessageRow[];
        
        // Reverse to show oldest first in UI (newest at bottom)
        const sortedMessages = [...newMessages].reverse();
        
        if (append) {
          // Append older messages to beginning of list
          setMessages(prev => [...sortedMessages, ...prev]);
        } else {
          // Initial load: replace all messages
          setMessages(sortedMessages);
        }
        
        // Check if there are more messages to load
        setHasMoreMessages(newMessages.length === 50);
        
        // Update last_read_at when conversation is opened (mark as read)
        if (!cursor && !append) {
          await updateLastReadAt(conversationId);
        }
      } catch (err: any) {
        console.error('Failed to load messages', err);

        const { message } = handleUserFriendlyError(err, {
          feature: 'messaging',
          action: 'load messages',
        });

        toast({
          title: 'Unable to load messages',
          description: message,
          variant: 'destructive',
        });
        if (!append) {
          setMessages([]);
        }
        setHasMoreMessages(false);
      } finally {
        setLoadingMoreMessages(false);
      }
    },
    [toast],
  );

  // Update last_read_at when conversation is opened or scrolled to bottom (read receipts)
  const updateLastReadAt = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      // Find user's participant record
      const { data: participant, error: findError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, participant_type, participant_user_id')
        .eq('conversation_id', conversationId)
        .eq('participant_type', 'user')
        .eq('participant_user_id', user.id)
        .single();
      
      if (findError || !participant) {
        console.warn('Could not find participant record for read receipt');
        return;
      }
      
      // Update last_read_at to now() (single source of truth for read receipts)
      const { error: updateError } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('participant_type', 'user')
        .eq('participant_user_id', user.id);
      
      if (updateError) {
        console.error('Failed to update last_read_at:', updateError);
      } else {
        // Update unread count for this conversation (should be 0 now)
        setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
      }
    } catch (err) {
      console.error('Error updating last_read_at:', err);
    }
  }, [user]);

  // Load older messages when scrolling up (cursor-based pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!selectedId || !hasMoreMessages || loadingMoreMessages) return;
    
    // Get oldest currently loaded message as cursor
    const oldestMessage = messages[0];
    if (!oldestMessage) return;
    
    await loadMessages(selectedId, oldestMessage.created_at, true);
  }, [selectedId, hasMoreMessages, loadingMoreMessages, messages, loadMessages]);

  // Initial conversations load
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!selectedId) return;
    void (async () => {
      try {
        await loadMessages(selectedId);
      } catch (err: any) {
        console.error('Failed to load messages', err);

        const { message } = handleUserFriendlyError(err, {
          feature: 'messaging',
          action: 'load conversation',
        });

        toast({
          title: 'Unable to load conversation',
          description: message,
          variant: 'destructive',
        });
      }
    })();
  }, [selectedId, loadMessages, toast]);

  // Scoped real-time subscription for new messages (per conversation, with cleanup)
  useEffect(() => {
    if (!selectedId) return;
    
    // Create scoped channel for this conversation only
    const channel = supabase
      .channel(`conversation:${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${selectedId}`, // Scoped to this conversation
        },
        (payload) => {
          // Add new message to list
          const newMessage = payload.new as DirectMessageRow;
          setMessages(prev => [...prev, newMessage]);
          
          // Auto-mark as read if conversation is active
          updateLastReadAt(selectedId).catch(err => {
            console.error('Failed to update last_read_at on new message:', err);
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Messaging] Subscribed to conversation:${selectedId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Messaging] Subscription error for conversation:${selectedId}`);
        }
      });

    // Cleanup: unsubscribe when conversation changes or component unmounts
    return () => {
      console.log(`[Messaging] Cleaning up subscription for conversation:${selectedId}`);
      supabase.removeChannel(channel);
    };
  }, [selectedId, updateLastReadAt]);

  // Listen for external "open conversation" events
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { conversationId?: string };
      if (!detail?.conversationId) return;
      setSelectedId(detail.conversationId);
      void loadConversations();
    };
    window.addEventListener('messaging:open', handler as EventListener);
    return () => window.removeEventListener('messaging:open', handler as EventListener);
  }, [loadConversations]);

  // Set default active identity
  useEffect(() => {
    if (!user) return;
    setActiveIdentity({
      type: 'user',
      id: user.id,
      label: profile?.display_name || 'You',
    });
  }, [profile?.display_name, user]);

  const selectedConversation = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const identityOptions = useMemo<IdentityOption[]>(() => {
    const options: IdentityOption[] = [];
    if (user) {
      options.push({
        type: 'user',
        id: user.id,
        label: profile?.display_name || 'You',
      });
    }
    if (selectedConversation) {
      const participantOrgIds = selectedConversation.participants
        .filter((p) => p.participant_type === 'organization' && p.participant_org_id)
        .map((p) => p.participant_org_id as string);
      organizations
        ?.filter((org) => participantOrgIds.includes(org.id))
        .forEach((org) =>
          options.push({
            type: 'organization',
            id: org.id,
            label: `${org.name} (org)`,
          }),
        );
    }
    return options;
  }, [organizations, profile?.display_name, selectedConversation, user]);

  // Keep active identity in sync with available options
  useEffect(() => {
    if (!identityOptions.length) {
      setActiveIdentity(null);
      return;
    }
    if (!activeIdentity) {
      setActiveIdentity(identityOptions[0]);
    } else if (
      !identityOptions.some(
        (opt) => opt.type === activeIdentity.type && opt.id === activeIdentity.id,
      )
    ) {
      setActiveIdentity(identityOptions[0]);
    }
  }, [identityOptions, activeIdentity]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, selectedId]);

  const sendMessage = useCallback(async () => {
    if (!selectedId || !activeIdentity) return;
    if (!draft.trim()) return;
    if (selectedConversation?.request_status === 'pending') return;

    try {
      setSending(true);
      const payload: Record<string, unknown> = {
        conversation_id: selectedId,
        body: draft.trim(),
        sender_type: activeIdentity.type,
        sender_user_id: activeIdentity.type === 'user' ? activeIdentity.id : null,
        sender_org_id: activeIdentity.type === 'organization' ? activeIdentity.id : null,
      };

      const { error } = await supabase.from('direct_messages').insert(payload);
      if (error) {
        // Log failed message send for monitoring
        console.error('[Messaging] Failed to send message:', {
          conversationId: selectedId,
          error: error.message,
          code: error.code,
          details: error.details,
        });
        
        if (error.message?.includes('does not exist')) {
          console.log('[Messaging] Messaging system not available');
          toast({
            title: 'Messaging not available',
            description: 'The messaging system is not set up yet.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }
      setDraft('');
      await loadMessages(selectedId);
    } catch (err: any) {
      // Enhanced error logging for monitoring
      console.error('[Messaging] Failed to send message:', {
        conversationId: selectedId,
        error: err?.message,
        code: err?.code,
        stack: err?.stack,
      });

      const { message } = handleUserFriendlyError(err, {
        feature: 'messaging',
        action: 'send message',
      });

      toast({
        title: 'Unable to send message',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }, [activeIdentity, draft, loadMessages, selectedConversation?.request_status, selectedId, toast]);

  const acceptRequest = useCallback(
    async (conversationId: string) => {
      try {
        const { error } = await supabase
          .from('direct_conversations')
          .update({ request_status: 'accepted' })
          .eq('id', conversationId);
        if (error) throw error;
        await loadConversations();
        toast({
          title: 'Request accepted',
          description: 'You can now exchange messages.',
        });
      } catch (err: any) {
        toast({
          title: 'Unable to accept request',
          description: err?.message ?? 'Please try again later.',
          variant: 'destructive',
        });
      }
    },
    [loadConversations, toast],
  );

  const declineRequest = useCallback(
    async (conversationId: string) => {
      try {
        const { error } = await supabase
          .from('direct_conversations')
          .update({ request_status: 'declined' })
          .eq('id', conversationId);
        if (error) throw error;
        await loadConversations();
        toast({ title: 'Request declined' });
      } catch (err: any) {
        toast({
          title: 'Unable to decline request',
          description: err?.message ?? 'Please try again later.',
          variant: 'destructive',
        });
      }
    },
    [loadConversations, toast],
  );

  const handleStartConversation = useCallback(
    async (userId: string) => {
      try {
        const { conversationId } = await startConversation({
          targetType: 'user',
          targetId: userId,
          subject: null,
        });

        // Reload conversations and select the new one
        await loadConversations();
        setSelectedId(conversationId);
        setShowUserSearch(false);

        toast({
          title: 'Conversation started',
          description: 'You can now send messages.',
        });
      } catch (err: any) {
        console.error('Failed to start conversation', err);

        const { message } = handleUserFriendlyError(err, {
          feature: 'messaging',
          action: 'start conversation',
        });

        toast({
          title: 'Unable to start conversation',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [loadConversations, toast],
  );

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;

    const term = searchTerm.toLowerCase();
    return conversations.filter((conversation) => {
      const participantNames = conversation.participants
        .map((p) => p.displayName.toLowerCase())
        .join(' ');
      const subject = conversation.subject?.toLowerCase() ?? '';
      return participantNames.includes(term) || subject.includes(term);
    });
  }, [conversations, searchTerm]);

  const renderConversationList = () => {
    if (loading) {
      return (
        <div className="space-y-3 px-4 py-6">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/80 p-3"
            >
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!conversations.length) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-medium">No conversations yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Start a new conversation
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            className="gap-2 rounded-full px-5"
            onClick={() => setShowUserSearch(true)}
          >
            <UserPlus className="h-4 w-4" />
            New Message
          </Button>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <div className="space-y-3 border-b border-border/40 bg-background px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations"
              className="h-10 rounded-full border-0 bg-background/90 pl-10 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Stay connected with your network and keep every conversation in one place.
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 px-3 py-4">
            {filteredConversations.length === 0 && searchTerm.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No results found</p>
              <p className="text-xs text-muted-foreground">Try a different search term</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const otherParticipants = conversation.participants.filter((participant) => {
                if (participant.participant_type === 'user') {
                  return participant.participant_user_id !== user?.id;
                }
                return true;
              });
              const title = otherParticipants.length
                ? otherParticipants.map((p) => p.displayName).join(', ')
                : conversation.subject || 'Conversation';

              const primaryParticipant = otherParticipants[0];
              const isActive = selectedId === conversation.id;
              // Use last_read_at as single source of truth for unread counts
              const unreadCount = unreadCounts[conversation.id] || 0;
              const hasUnread = unreadCount > 0;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border text-left transition-all duration-200 ${
                    isActive
                      ? 'border-primary/30 bg-primary/10 shadow-sm shadow-primary/10'
                      : 'border-transparent bg-background/80 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-sm'
                  } p-3`}
                >
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={primaryParticipant?.avatarUrl || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20">
                        {primaryParticipant?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {hasUnread && (
                      <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-primary rounded-full flex items-center justify-center px-1">
                        <span className="text-[10px] text-primary-foreground font-medium">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center justify-between">
                      <h4 className="truncate text-sm font-semibold">{title}</h4>
                      {conversation.last_message_at && (
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatDistanceToNow(
                            new Date(conversation.last_message_at),
                            { addSuffix: true },
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="flex-1 truncate text-xs text-muted-foreground">
                        {conversation.request_status === 'pending'
                          ? 'Follow request pending...'
                          : 'Tap to open conversation'}
                      </p>

                      {conversation.request_status !== 'accepted' && (
                        <Badge
                          variant="warning"
                          className="ml-2 rounded-full px-2 text-[10px] uppercase tracking-wide"
                        >
                          {conversation.request_status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </button>
              );
            })
          )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // ✅ Dedicated empty state (clean, single-purpose)
  const renderEmptyState = () => (
    <div className="h-[80vh] w-full bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-background">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-xs text-muted-foreground">
            Catch up with your latest conversations
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowUserSearch(true)}
            aria-label="New message"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      </header>
      {/* Centered empty state */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No conversations yet</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Find people you know and start a conversation
        </p>
        <Button
          variant="default"
          size="default"
          className="rounded-full px-6 gap-2"
          onClick={() => setShowUserSearch(true)}
        >
          <UserPlus className="h-4 w-4" />
          New Message
        </Button>
      </main>
    </div>
  );

  const renderMessages = () => {
    if (!selectedConversation) {
      return (
        <div className="flex h-full flex-1 items-center justify-center bg-background">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Select a conversation</h3>
            <p className="text-sm text-muted-foreground">
              Choose a conversation from the sidebar to begin messaging.
            </p>
          </div>
        </div>
      );
    }

    const otherParticipants = selectedConversation.participants.filter((participant) =>
      participant.participant_type === 'user'
        ? participant.participant_user_id !== user?.id
        : true,
    );
    const conversationTitle =
      otherParticipants.map((p) => p.displayName).join(', ') || 'Conversation';
    const primaryParticipant = otherParticipants[0];

    return (
      <div className="flex h-full flex-1 flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={primaryParticipant?.avatarUrl || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20">
                {primaryParticipant?.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold leading-tight">{conversationTitle}</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-muted-foreground">
                    Usually responds within a day
                  </span>
                </div>
                {selectedConversation.request_status === 'pending' && (
                  <Badge variant="warning" className="text-[10px] uppercase">
                    Pending approval
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action buttons for pending requests */}
        {selectedConversation.request_status === 'pending' && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  This conversation is pending approval
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => declineRequest(selectedConversation.id)}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => acceptRequest(selectedConversation.id)}
                >
                  Accept
                </Button>
              </div>
            </div>
          </div>
        )}

        <ScrollArea 
          className="flex-1 px-4 py-6 sm:px-6"
          ref={messagesContainerRef}
          onScrollCapture={(e) => {
            // Load older messages when scrolling near top
            const target = e.currentTarget;
            if (target.scrollTop < 100 && hasMoreMessages && !loadingMoreMessages) {
              loadOlderMessages();
            }
          }}
        >
          {hasMoreMessages && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadOlderMessages}
                disabled={loadingMoreMessages}
              >
                {loadingMoreMessages ? 'Loading...' : 'Load older messages'}
              </Button>
            </div>
          )}
          <div className="space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                  <MessageSquare className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-base font-medium">Start the conversation</h3>
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  Send your first message below
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isSelf =
                  (message.sender_type === 'user' &&
                    message.sender_user_id === user?.id) ||
                  (message.sender_type === 'organization' &&
                    organizations?.some((org) => org.id === message.sender_org_id));

                const label = (() => {
                  if (message.sender_type === 'organization') {
                    const org = organizations?.find(
                      (org) => org.id === message.sender_org_id,
                    );
                    return org?.name ?? 'Organization';
                  }
                  if (message.sender_user_id === user?.id) {
                    return profile?.display_name || 'You';
                  }
                  const participant = selectedConversation.participants.find(
                    (p) =>
                      p.participant_type === 'user' &&
                      p.participant_user_id === message.sender_user_id,
                  );
                  return participant?.displayName ?? 'Member';
                })();

                const prevMessage = index > 0 ? messages[index - 1] : null;
                const showAvatar =
                  !prevMessage || prevMessage.sender_user_id !== message.sender_user_id;
                const showTimestamp =
                  index === messages.length - 1 ||
                  (index < messages.length - 1 &&
                    new Date(messages[index + 1].created_at).getTime() -
                      new Date(message.created_at).getTime() >
                      5 * 60 * 1000);

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isSelf && (
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={
                                selectedConversation.participants.find(
                                  (p) =>
                                    p.participant_user_id === message.sender_user_id,
                                )?.avatarUrl || ''
                              }
                            />
                            <AvatarFallback className="text-xs">
                              {label.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </div>
                    )}

                    <div
                      className={`flex max-w-[80%] flex-col ${
                        isSelf ? 'items-end' : 'items-start'
                      }`}
                    >
                      {!isSelf && showAvatar && (
                        <span className="text-xs font-medium text-muted-foreground mb-1">
                          {label}
                        </span>
                      )}

                      <div
                        className={`group relative rounded-2xl px-4 py-2.5 text-sm transition-all ${
                          isSelf
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/80'
                        }`}
                      >
                        <div className="whitespace-pre-line break-words">{message.body}</div>

                        <div
                          className={`mt-2 flex items-center gap-1 text-[11px] ${
                            isSelf
                              ? 'justify-end text-primary-foreground/80'
                              : 'justify-start text-muted-foreground'
                          }`}
                        >
                          <span>
                            {formatDistanceToNow(new Date(message.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                          {/* Read receipt: show CheckCheck if read, Check if delivered */}
                          {isSelf && (() => {
                            // Check if message is read: recipient's last_read_at >= message.created_at
                            const recipientParticipant = selectedConversation.participants.find(
                              p => p.participant_type === 'user' && p.participant_user_id !== user?.id
                            );
                            const isRead = recipientParticipant?.last_read_at 
                              ? new Date(recipientParticipant.last_read_at) >= new Date(message.created_at)
                              : false;
                            
                            return isRead ? (
                              <CheckCheck className="h-3 w-3 text-primary-foreground/80" title="Read" />
                            ) : (
                              <Check className="h-3 w-3 text-primary-foreground/60" title="Delivered" />
                            );
                          })()}
                        </div>
                      </div>

                      {showTimestamp && (
                        <div
                          className={`mt-2 text-[10px] uppercase tracking-wide text-muted-foreground ${
                            isSelf ? 'text-right' : 'text-left'
                          }`}
                        >
                          {new Date(message.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input Area */}
        <div className="border-t border-border/40 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
          {identityOptions.length > 1 && activeIdentity && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Message as:
                </span>
                <Select
                  value={`${activeIdentity.type}:${activeIdentity.id}`}
                  onValueChange={(value) => {
                    const [type, id] = value.split(':');
                    if (type === 'organization') {
                      const org = organizations?.find((o) => o.id === id);
                      setActiveIdentity({
                        type: 'organization',
                        id,
                        label: org?.name ?? 'Organization',
                      });
                    } else {
                      setActiveIdentity({
                        type: 'user',
                        id,
                        label: profile?.display_name || 'You',
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-48">
                    <SelectValue placeholder="Message as" />
                  </SelectTrigger>
                  <SelectContent>
                    {identityOptions.map((option) => (
                      <SelectItem
                        key={`${option.type}:${option.id}`}
                        value={`${option.type}:${option.id}`}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="flex items-end gap-2 rounded-3xl border border-border/50 bg-muted/40 p-3 transition-all duration-200 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1">
                <Textarea
                  placeholder={
                    selectedConversation.request_status === 'pending'
                      ? 'Messages will send once this request is accepted...'
                      : 'Write a message...'
                  }
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
                  }
                  className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim() && !sending) {
                        void sendMessage();
                      }
                    }
                  }}
                />
              </div>

              <Button
                type="button"
                onClick={() => void sendMessage()}
                disabled={
                  sending ||
                  !draft.trim() ||
                  selectedConversation.request_status === 'pending'
                }
                size="sm"
                className="h-9 rounded-full px-4"
              >
                {sending ? <BrandedSpinner size="sm" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span>
                {selectedConversation.request_status === 'pending'
                  ? 'Messages will send once this request is accepted.'
                  : 'Press Enter to send, Shift + Enter for new line'}
              </span>
              <span>
                {draft.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* If we're still loading, keep the existing skeleton UI */}
      {loading ? (
        <div className="h-[80vh] w-full overflow-hidden rounded-2xl border border-border/40 bg-background shadow-sm">
          <div className="flex h-full flex-col lg:flex-row">
            {/* Just reuse your existing sidebar skeleton */}
            <div className="w-full border-b border-border/40 bg-background lg:w-[22rem] lg:border-b-0 lg:border-r">
              <div className="border-b border-border/40 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Inbox</h2>
                    <p className="text-xs text-muted-foreground">
                      Catch up with your latest conversations
                    </p>
                  </div>
                </div>
              </div>
              {renderConversationList()}
            </div>
            <div className="flex flex-1">{renderMessages()}</div>
          </div>
        </div>
      ) : conversations.length === 0 ? (
        // ✅ Clean single empty state
        <div className="rounded-2xl border border-border/40 bg-background shadow-sm">
          {renderEmptyState()}
        </div>
      ) : (
        // ✅ Normal 2-pane layout once you actually have conversations
        <div className="h-[80vh] w-full overflow-hidden rounded-2xl border border-border/40 bg-background shadow-sm">
          <div className="flex h-full flex-col lg:flex-row">
            {/* Conversation Sidebar */}
            <div className="w-full border-b border-border/40 bg-background lg:w-[22rem] lg:border-b-0 lg:border-r">
              <div className="border-b border-border/40 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Inbox</h2>
                    <p className="text-xs text-muted-foreground">
                      Catch up with your latest conversations
                    </p>
                  </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowUserSearch(true)}
                  aria-label="New message"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
                </div>
              </div>
              {renderConversationList()}
            </div>

            {/* Messages Area */}
            <div className="flex flex-1">{renderMessages()}</div>
          </div>
        </div>
      )}

      {/* User Search Modal for Starting New Conversations */}
      <UserSearchModal
        open={showUserSearch}
        onOpenChange={setShowUserSearch}
        onSelectUser={handleStartConversation}
      />
    </>
  );
}
