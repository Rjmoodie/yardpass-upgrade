import { supabase } from '@/integrations/supabase/client';

type CanView = { allowed: boolean; reason?: 'not-found' | 'auth' | 'forbidden' };

export async function canViewEvent(eventId: string, userId?: string): Promise<CanView> {
  const { data: ev, error } = await supabase
    .from('events')
    .select('id, visibility, owner_context_type, owner_context_id, created_by')
    .eq('id', eventId)
    .single();

  if (error || !ev) return { allowed: false, reason: 'not-found' };
  if (ev.visibility === 'public' || ev.visibility === 'unlisted') return { allowed: true };

  // private requires auth
  if (!userId) return { allowed: false, reason: 'auth' };

  // individual owner
  if (ev.owner_context_type === 'individual' && ev.owner_context_id === userId) {
    return { allowed: true };
  }

  // org membership
  const { data: m } = await supabase
    .from('org_memberships')
    .select('id, role')
    .eq('org_id', ev.owner_context_id)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin', 'editor'])
    .limit(1);
  if (m && m.length) return { allowed: true };

  // invited
  const { data: inv } = await supabase
    .from('event_invites')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .limit(1);
  if (inv && inv.length) return { allowed: true };

  // ticket holder
  const { data: t } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', eventId)
    .eq('owner_user_id', userId)
    .in('status', ['issued', 'transferred', 'redeemed'])
    .limit(1);
  if (t && t.length) return { allowed: true };

  return { allowed: false, reason: 'forbidden' };
}