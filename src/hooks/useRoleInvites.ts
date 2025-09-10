import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RoleType } from '@/types/roles';

const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL;

function normalizePhone(e164?: string) {
  if (!e164) return undefined;
  // very light normalization: keep leading + and digits only
  const cleaned = e164.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : undefined;
}

function asErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    const parsed = JSON.parse(String(e));
    if (parsed?.error) return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
  } catch {}
  return String(e);
}

export function useRoleInvites() {
  const [loading, setLoading] = useState(false);

  const headers = useMemo(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  async function sendInvite(params: {
    eventId: string;
    role: RoleType;
    email?: string;
    phone?: string;
    expiresInHours?: number;
  }) {
    setLoading(true);
    try {
      if (!params.email && !params.phone) {
        throw new Error('Provide at least an email or phone.');
      }
      const email = params.email?.trim() || undefined;
      const phone = normalizePhone(params.phone);

      const resp = await fetch(`${EDGE_BASE}/functions/v1/send-role-invite`, {
        method: 'POST',
        headers: await headers,
        body: JSON.stringify({
          event_id: params.eventId,
          role: params.role,
          email,
          phone,
          expires_in_hours: params.expiresInHours ?? 72,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to send invite.');
      }
      return await resp.json();
    } catch (e) {
      throw new Error(asErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvite(token: string) {
    const { error } = await supabase.rpc('accept_role_invite', { p_token: token });
    if (error) throw new Error(error.message);
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase
      .from('role_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId);
    if (error) throw new Error(error.message);
  }

  // Optional helpers if you want to fetch elsewhere with consistent shapes
  async function listInvites(eventId: string) {
    const { data, error } = await supabase
      .from('role_invites')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function listMembers(eventId: string) {
    const { data, error } = await supabase
      .from('event_roles')
      .select(`
        id, user_id, role, status, created_by, created_at, event_id,
        user_profiles!inner(display_name)
      `)
      .eq('event_id', eventId)
      .eq('status', 'active');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  return {
    sendInvite,
    acceptInvite,
    revokeInvite,
    listInvites,
    listMembers,
    loading,
  };
}