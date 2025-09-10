import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RoleType } from '@/types/roles';

const EDGE_BASE = "https://yieslxnrfeqchbcmgavz.supabase.co";

function normalizePhone(e164?: string) {
  if (!e164) return undefined;
  // E.164 normalization: must start with + and contain only digits
  const cleaned = e164.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') && cleaned.length >= 10 ? cleaned : undefined;
}

function validateEmail(email?: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
      
      // Input validation
      if (email && !validateEmail(email)) {
        throw new Error('Invalid email format.');
      }
      if (params.phone && !phone) {
        throw new Error('Invalid phone format. Use E.164 format (+1234567890).');
      }

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
    const { data, error } = await supabase.rpc('accept_role_invite', { p_token: token });
    if (error) throw new Error(error.message);
    return data; // Returns the status info from RPC
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

  // Realtime subscription for live updates
  function subscribeToUpdates(eventId: string, onUpdate: () => void) {
    const channel = supabase
      .channel(`role_updates_${eventId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'role_invites', filter: `event_id=eq.${eventId}` },
        onUpdate
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_roles', filter: `event_id=eq.${eventId}` },
        onUpdate
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  return {
    sendInvite,
    acceptInvite,
    revokeInvite,
    listInvites,
    listMembers,
    subscribeToUpdates,
    loading,
  };
}