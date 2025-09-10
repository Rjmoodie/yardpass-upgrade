import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageChannel, RoleType } from '@/types/roles';

const EDGE_BASE = "https://yieslxnrfeqchbcmgavz.supabase.co";

export function useMessaging() {
  const [loading, setLoading] = useState(false);

  async function createJob(input: {
    eventId: string;
    channel: MessageChannel;
    templateId?: string;
    subject?: string;
    body?: string;
    smsBody?: string;
    fromName?: string;
    fromEmail?: string;
    scheduledAt?: string | null;
    segment: { type: 'all_attendees' | 'roles'; roles?: RoleType[] };
    batchSize?: number;
  }) {
    setLoading(true);
    try {
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1) Create job
      const { data: job, error } = await supabase
        .from('message_jobs')
        .insert({
          event_id: input.eventId,
          channel: input.channel,
          template_id: input.templateId ?? null,
          subject: input.subject,
          body: input.body,
          sms_body: input.smsBody,
          from_name: input.fromName,
          from_email: input.fromEmail,
          batch_size: input.batchSize ?? 200,
          status: 'queued',
          scheduled_at: input.scheduledAt ?? null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // 2) Build recipient rows
      let recipients: Array<{ 
        user_id?: string | null; 
        email?: string | null; 
        phone?: string | null; 
      }> = [];

      if (input.segment.type === 'all_attendees') {
        // Get all ticket holders for this event
        const { data: tickets } = await supabase
          .from('tickets')
          .select(`
            owner_user_id,
            user_profiles!inner(email, phone)
          `)
          .eq('event_id', input.eventId)
          .eq('status', 'issued');

        // Dedupe recipients by email/phone
        const seen = new Set<string>();
        recipients = (tickets || [])
          .map((t: any) => ({
            user_id: t.owner_user_id,
            email: t.user_profiles?.email,
            phone: t.user_profiles?.phone,
          }))
          .filter(r => {
            const key = input.channel === 'email' ? r.email : r.phone;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      } else if (input.segment.type === 'roles' && input.segment.roles?.length) {
        // Get users with specific roles for this event
        const { data: roleUsers } = await supabase
          .from('event_roles')
          .select(`
            user_id,
            user_profiles!inner(email, phone)
          `)
          .eq('event_id', input.eventId)
          .in('role', input.segment.roles);

        recipients = (roleUsers || []).map((r: any) => ({
          user_id: r.user_id,
          email: r.user_profiles?.email,
          phone: r.user_profiles?.phone,
        }));
      }

      // Filter recipients based on channel
      const filteredRecipients = recipients.filter(r => {
        if (input.channel === 'email') return r.email;
        if (input.channel === 'sms') return r.phone;
        return false;
      });

      // Insert recipients in chunks
      if (filteredRecipients.length) {
        const chunks: typeof filteredRecipients[] = [];
        const size = 1000;
        for (let i = 0; i < filteredRecipients.length; i += size) {
          chunks.push(filteredRecipients.slice(i, i + size));
        }
        
        for (const chunk of chunks) {
          const payload = chunk.map(r => ({
            job_id: job.id,
            user_id: r.user_id ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
          }));
          
          await supabase.from('message_job_recipients').insert(payload);
        }
      }

      // 3) Trigger processing
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${EDGE_BASE}/functions/v1/messaging-queue`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ job_id: job.id, batch_size: input.batchSize ?? 200 }),
        }).catch(console.error);
      }

      return job;
    } finally {
      setLoading(false);
    }
  }

  async function getRecipientCount(eventId: string, segment: { type: 'all_attendees' | 'roles'; roles?: RoleType[] }) {
    try {
      if (segment.type === 'all_attendees') {
        const { count } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'issued');
        return count || 0;
      } else if (segment.type === 'roles' && segment.roles?.length) {
        const { count } = await supabase
          .from('event_roles')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .in('role', segment.roles);
        return count || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting recipient count:', error);
      return 0;
    }
  }

  return { createJob, getRecipientCount, loading };
}