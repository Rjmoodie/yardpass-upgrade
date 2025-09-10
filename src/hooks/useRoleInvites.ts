import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RoleType } from '@/types/roles';

export function useRoleInvites() {
  const [loading, setLoading] = useState(false);

  async function sendInvite(params: {
    eventId: string;
    role: RoleType;
    email?: string;
    phone?: string;
    expiresInHours?: number;
  }) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-role-invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: params.eventId,
          role: params.role,
          email: params.email,
          phone: params.phone,
          expires_in_hours: params.expiresInHours ?? 72,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvite(token: string) {
    const { error } = await supabase.rpc('accept_role_invite', { p_token: token });
    if (error) throw error;
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase
      .from('role_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId);
    if (error) throw error;
  }

  return { 
    sendInvite, 
    acceptInvite, 
    revokeInvite, 
    loading 
  };
}