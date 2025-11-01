// src/hooks/useEventAccess.ts
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Organization roles that can manage events
const ORG_EDITOR_ROLES = new Set(['editor', 'admin', 'owner']);

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
    // Allow if token matches OR user is organizer OR has event role
    if (!userId && !linkTokenFromUrl) return { status: 'unlisted-key-required' };

    // Organizer check
    if (userId) {
      const { data } = await supabase
        .from('events')
        .select('owner_context_type, owner_context_id, created_by')
        .eq('id', eventId)
        .single();

      // Individual owner check
      if (data?.created_by === userId) return { status: 'allowed' };

      // Event-specific role check (NEW!)
      const { data: eventRole } = await supabase
        .from('event_roles')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (eventRole) return { status: 'allowed' };

      // Organization member check (restricted to editors+)
      if (data?.owner_context_type === 'organization' && data.owner_context_id) {
        const { data: m } = await supabase
          .from('org_memberships')
          .select('user_id, role')
          .eq('org_id', data.owner_context_id)
          .eq('user_id', userId)
          .maybeSingle();
        if (m?.role && ORG_EDITOR_ROLES.has(m.role)) return { status: 'allowed' };
      }
    }

    // Token match?
    const { data: tokenRow } = await supabase
      .from('events')
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

  // Organizer OR Event Role OR Ticket-holder OR Invitee can view
  const [{ data: ev }, { data: ticket }, { data: invite }, { data: eventRole }] = await Promise.all([
    supabase
      .from('events')
      .select('owner_context_type, owner_context_id, created_by')
      .eq('id', eventId)
      .single(),
    supabase
      .from('tickets')
      .select('id')
      .eq('event_id', eventId)
      .eq('owner_user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('event_invites')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('event_roles')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  // Individual owner check
  if (ev?.created_by === userId) return { status: 'allowed' };

  // Organization editor+ check (restricted from viewer)
  let isOrgEditorOrAbove = false;
  if (ev?.owner_context_type === 'organization' && ev.owner_context_id) {
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', ev.owner_context_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (membership?.role && ORG_EDITOR_ROLES.has(membership.role)) {
      isOrgEditorOrAbove = true;
    }
  }

  // Allow if: org editor+, event role, ticket holder, or invitee
  if (isOrgEditorOrAbove || eventRole || ticket || invite) return { status: 'allowed' };
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
