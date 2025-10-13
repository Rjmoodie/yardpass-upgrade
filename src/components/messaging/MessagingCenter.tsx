import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

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

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messaging_inbox')
        .select('*')
        .order('last_message_at', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as InboxRow[];
      const orgIds = new Set((organizations ?? []).map((o) => o.id));

      const filtered = rows.filter((row) =>
        row.participants.some((participant) => {
          if (participant.participant_type === 'user') {
            return participant.participant_user_id === user.id;
          }
          return participant.participant_org_id ? orgIds.has(participant.participant_org_id) : false;
        }),
      );

      const userIds = new Set<string>();
      const organizationIds = new Set<string>();
      filtered.forEach((row) => {
        row.participants.forEach((participant) => {
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

      const mapped = filtered.map<ConversationListItem>((row) => ({
        id: row.id,
        subject: row.subject,
        request_status: row.request_status,
        last_message_at: row.last_message_at,
        created_at: row.created_at,
        participants: row.participants.map((participant) => {
          if (participant.participant_type === 'organization' && participant.participant_org_id) {
            const details = orgMap.get(participant.participant_org_id) ?? { display_name: 'Organization', photo_url: null };
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
      if (!selectedId && mapped.length) {
        setSelectedId(mapped[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations', err);
      toast({ title: 'Unable to load messages', description: err?.message ?? 'Please try again later.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [organizations, selectedId, toast, user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('id,body,created_at,sender_type,sender_user_id,sender_org_id,status')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    setMessages((data ?? []) as DirectMessageRow[]);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    void (async () => {
      try {
        await loadMessages(selectedId);
      } catch (err: any) {
        console.error('Failed to load messages', err);
        toast({ title: 'Unable to load conversation', description: err?.message ?? 'Please try again later.', variant: 'destructive' });
      }
    })();
  }, [selectedId, loadMessages, toast]);

  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`messages-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${selectedId}` },
        () => {
          void loadMessages(selectedId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, loadMessages]);

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

  useEffect(() => {
    if (!user) return;
    setActiveIdentity({ type: 'user', id: user.id, label: profile?.display_name || 'You' });
  }, [profile?.display_name, user]);

  const selectedConversation = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const identityOptions = useMemo<IdentityOption[]>(() => {
    const options: IdentityOption[] = [];
    if (user) {
      options.push({ type: 'user', id: user.id, label: profile?.display_name || 'You' });
    }
    if (selectedConversation) {
      const participantOrgIds = selectedConversation.participants
        .filter((p) => p.participant_type === 'organization' && p.participant_org_id)
        .map((p) => p.participant_org_id as string);
      organizations
        ?.filter((org) => participantOrgIds.includes(org.id))
        .forEach((org) => options.push({ type: 'organization', id: org.id, label: `${org.name} (org)` }));
    }
    return options;
  }, [organizations, profile?.display_name, selectedConversation, user]);

  useEffect(() => {
    if (!identityOptions.length) {
      setActiveIdentity(null);
      return;
    }
    if (!activeIdentity) {
      setActiveIdentity(identityOptions[0]);
    } else if (!identityOptions.some((opt) => opt.type === activeIdentity.type && opt.id === activeIdentity.id)) {
      setActiveIdentity(identityOptions[0]);
    }
  }, [identityOptions, activeIdentity]);

  const sendMessage = async () => {
    if (!selectedId || !activeIdentity) return;
    if (!draft.trim()) return;

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
      if (error) throw error;
      setDraft('');
      await loadMessages(selectedId);
    } catch (err: any) {
      console.error('Failed to send message', err);
      toast({ title: 'Unable to send message', description: err?.message ?? 'Please try again later.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const acceptRequest = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('direct_conversations')
        .update({ request_status: 'accepted' })
        .eq('id', conversationId);
      if (error) throw error;
      await loadConversations();
      toast({ title: 'Request accepted', description: 'You can now exchange messages.' });
    } catch (err: any) {
      toast({ title: 'Unable to accept request', description: err?.message ?? 'Please try again later.', variant: 'destructive' });
    }
  };

  const declineRequest = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('direct_conversations')
        .update({ request_status: 'declined' })
        .eq('id', conversationId);
      if (error) throw error;
      await loadConversations();
      toast({ title: 'Request declined' });
    } catch (err: any) {
      toast({ title: 'Unable to decline request', description: err?.message ?? 'Please try again later.', variant: 'destructive' });
    }
  };

  const renderConversationList = () => {
    if (loading) {
      return (
        <div className="space-y-4 p-4">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
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
        <div className="p-6 text-center text-sm text-muted-foreground">
          <MessageSquare className="mx-auto mb-3 h-6 w-6" />
          <p>No conversations yet. Start messaging from a profile to begin.</p>
        </div>
      );
    }

    return (
      <ul className="space-y-1 p-2">
        {conversations.map((conversation) => {
          const otherParticipants = conversation.participants.filter((participant) => {
            if (participant.participant_type === 'user') {
              return participant.participant_user_id !== user?.id;
            }
            return true;
          });
          const title = otherParticipants.length
            ? otherParticipants.map((p) => p.displayName).join(', ')
            : conversation.subject || 'Conversation';

          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  selectedId === conversation.id ? 'bg-muted text-foreground' : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">
                    {conversation.last_message_at
                      ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true })}
                  </span>
                </div>
                {conversation.request_status === 'pending' && (
                  <Badge variant="outline" className="mt-1 text-[10px] uppercase">
                    Pending approval
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderMessages = () => {
    if (!selectedConversation) {
      return (
        <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a conversation to view messages.
        </div>
      );
    }

    return (
      <div className="flex h-full flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {selectedConversation.participants
                .filter((participant) =>
                  participant.participant_type === 'user'
                    ? participant.participant_user_id !== user?.id
                    : true,
                )
                .map((participant) => participant.displayName)
                .join(', ') || 'Conversation'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedConversation.request_status === 'pending'
                ? 'Message request pending approval'
                : 'Direct conversation'}
            </p>
          </div>
          {selectedConversation.request_status === 'pending' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => declineRequest(selectedConversation.id)}>
                Decline
              </Button>
              <Button size="sm" onClick={() => acceptRequest(selectedConversation.id)}>
                Accept
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => {
              const isSelf =
                (message.sender_type === 'user' && message.sender_user_id === user?.id) ||
                (message.sender_type === 'organization' && organizations?.some((org) => org.id === message.sender_org_id));

              const label = (() => {
                if (message.sender_type === 'organization') {
                  const org = organizations?.find((org) => org.id === message.sender_org_id);
                  return org?.name ?? 'Organization';
                }
                if (message.sender_user_id === user?.id) {
                  return profile?.display_name || 'You';
                }
                const participant = selectedConversation.participants.find(
                  (p) => p.participant_type === 'user' && p.participant_user_id === message.sender_user_id,
                );
                return participant?.displayName ?? 'Member';
              })();

              return (
                <div key={message.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      isSelf ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    <div className="mb-1 text-xs font-semibold opacity-80">{label}</div>
                    <div className="whitespace-pre-line">{message.body}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-wide opacity-70">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="border-t bg-background/70 px-6 py-4">
          {identityOptions.length > 1 && activeIdentity && (
            <div className="mb-2 w-48">
              <Select
                value={`${activeIdentity.type}:${activeIdentity.id}`}
                onValueChange={(value) => {
                  const [type, id] = value.split(':');
                  if (type === 'organization') {
                    const org = organizations?.find((o) => o.id === id);
                    setActiveIdentity({ type: 'organization', id, label: org?.name ?? 'Organization' });
                  } else {
                    setActiveIdentity({ type: 'user', id, label: profile?.display_name || 'You' });
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Message as" />
                </SelectTrigger>
                <SelectContent>
                  {identityOptions.map((option) => (
                    <SelectItem key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              placeholder="Write a message..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedConversation.request_status === 'pending'
                  ? 'Messages will send once this request is accepted.'
                  : 'Press enter to send, shift + enter for newline.'}
              </span>
              <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-[80vh] w-full overflow-hidden">
      <CardContent className="flex h-full gap-0 p-0">
        <div className="w-full border-r lg:w-72">{renderConversationList()}</div>
        <div className="hidden flex-1 lg:flex">{renderMessages()}</div>
        <div className="flex w-full flex-1 lg:hidden">{renderMessages()}</div>
      </CardContent>
    </Card>
  );
}
