// src/hooks/useEventAccess.ts
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AccessState =
  | { status: 'loading' }
  | { status: 'allowed' }
  | { status: 'needs-login' }
  | { status: 'unlisted-key-required' }
  | { status: 'private-denied' };

export async function canUserViewEventServerSide(params:{
  eventId: string;
  userId?: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  linkTokenFromUrl?: string | null;
}): Promise<AccessState> {
  const { eventId, userId, visibility, linkTokenFromUrl } = params;

  if (visibility === 'public') return { status: 'allowed' };

  if (visibility === 'unlisted') {
    // Allow if token matches OR user is organizer
    if (!userId && !linkTokenFromUrl) return { status: 'unlisted-key-required' };

    // Organizer check
    if (userId) {
      const { data } = await supabase
        .from('events.events')
        .select('owner_context_type, owner_context_id, created_by')
        .eq('id', eventId)
        .single();

      // Individual owner check
      if (data?.created_by === userId) return { status: 'allowed' };

      // Organization member check
      if (data?.owner_context_type === 'organization' && data.owner_context_id) {
        const { data: m } = await supabase
          .from('organizations.org_memberships')
          .select('user_id')
          .eq('org_id', data.owner_context_id)
          .eq('user_id', userId)
          .maybeSingle();
        if (m) return { status: 'allowed' };
      }
    }

    // Token match?
    const { data: tokenRow } = await supabase
      .from('events.events')
      .select('link_token')
      .eq('id', eventId)
      .single();

    if (linkTokenFromUrl && tokenRow?.link_token && linkTokenFromUrl === tokenRow.link_token) {
      return { status: 'allowed' };
    }
    return userId ? { status: 'unlisted-key-required' } : { status: 'needs-login' };
  }

  // private
  if (!userId) return { status: 'needs-login' };

  // Organizer OR Ticket-holder OR Invitee can view
  const [{ data: ev }, { data: ticket }, { data: invite }] = await Promise.all([
    supabase
      .from('events.events')
      .select('owner_context_type, owner_context_id, created_by')
      .eq('id', eventId)
      .single(),
    supabase
      .from('ticketing.tickets')
      .select('id')
      .eq('event_id', eventId)
      .eq('owner_user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('events.event_invites')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  // Individual owner check
  if (ev?.created_by === userId) return { status: 'allowed' };

  const isOrgMember =
    ev?.owner_context_type === 'organization' && ev.owner_context_id
      ? !!(await supabase
          .from('organizations.org_memberships')
          .select('user_id')
          .eq('org_id', ev.owner_context_id)
          .eq('user_id', userId)
          .maybeSingle()).data
      : false;

  if (isOrgMember || ticket || invite) return { status: 'allowed' };
  return { status: 'private-denied' };
}

export function useEventAccess(params:{
  eventId?: string | null;
  visibility?: 'public'|'unlisted'|'private' | null;
  linkTokenFromUrl?: string | null;
}) {
  const [state, setState] = useState<AccessState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!params.eventId || !params.visibility) return;
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      const res = await canUserViewEventServerSide({
        eventId: params.eventId,
        userId,
        visibility: params.visibility,
        linkTokenFromUrl: params.linkTokenFromUrl ?? null,
      });
      if (mounted) setState(res);
    })();
    return () => { mounted = false; };
  }, [params.eventId, params.visibility, params.linkTokenFromUrl]);

  return state;
}