// src/hooks/useMessaging.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageChannel, RoleType } from '@/types/roles';

type Segment =
  | { type: 'all_attendees' }
  | { type: 'roles'; roles?: RoleType[] }
  | { type: 'import_list'; listId: string };

export function useMessaging() {
  const [loading, setLoading] = useState(false);

  function validateVars(text?: string) {
    if (!text) return { ok: true };
    // sanity-check unreplaced handlebars (optional)
    const leftover = text.match(/{{\s*[^}]+\s*}}/g);
    // Allow our known variables, warn on others
    const allowed = new Set(['{{event_title}}','{{event_date}}','{{first_name}}']);
    const unknown = (leftover ?? []).filter(v => !allowed.has(v));
    if (unknown.length) {
      console.warn('[useMessaging] Unknown template vars:', unknown);
    }
    return { ok: true };
  }

  async function createJob(input: {
    eventId: string;
    orgId?: string;
    channel: MessageChannel;
    templateId?: string;
    subject?: string;
    body?: string;
    smsBody?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    scheduledAt?: string | null;
    segment: Segment;
    batchSize?: number;
    dryRun?: boolean; // if true, don't hit the queue—return counts only
  }) {
    console.log('[useMessaging] Creating job with input:', input);
    setLoading(true);
    try {
      // basic validation
      if (input.channel === 'email' && !input.subject?.trim()) {
        throw new Error('Subject is required for email');
      }
      if (!(input.body?.trim() || input.smsBody?.trim())) {
        throw new Error('Message body is required');
      }
      validateVars(input.body);
      validateVars(input.smsBody);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('[useMessaging] Creating job for user:', user.id);

      // 1) Create job
      const { data: job, error } = await supabase
        .from('message_jobs')
        .insert({
          event_id: input.eventId,
          channel: input.channel,
          template_id: input.templateId ?? null,
          subject: input.subject ?? null,
          body: input.body ?? null,
          sms_body: input.smsBody ?? null,
          from_name: input.fromName ?? null,
          from_email: input.fromEmail ?? null,
          reply_to: input.replyTo ?? null,
          batch_size: input.batchSize ?? 200,
          status: input.dryRun ? 'draft' : 'queued',
          scheduled_at: input.scheduledAt ?? null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('[useMessaging] Job creation error:', error);
        throw error;
      }

      console.log('[useMessaging] Job created:', job);

      // 2) Build recipients
      let recipients: Array<{ user_id?: string | null; email?: string | null; phone?: string | null }> = [];

      console.log('[useMessaging] Building recipients for segment:', input.segment);

      if (input.segment.type === 'all_attendees') {
        // Fetch only user IDs from tickets to avoid FK join requirements
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('owner_user_id')
          .eq('event_id', input.eventId)
          .eq('status', 'issued');

        if (ticketsError) {
          console.error('[useMessaging] Error fetching tickets:', ticketsError);
          throw ticketsError;
        }

        const userIds = [...new Set((tickets || []).map(t => t.owner_user_id))];
        console.log('[useMessaging] Found tickets:', tickets?.length || 0, 'unique users:', userIds.length);

        if (input.channel === 'email') {
          // For email, pass user_id only; the edge function will fetch email from auth.users
          recipients = userIds.map(userId => ({ user_id: userId, email: null, phone: null }));
        } else {
          // For SMS, fetch phones from user_profiles in a separate query
          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('user_id, phone')
            .in('user_id', userIds);
          if (profilesError) {
            console.error('[useMessaging] Error fetching user profiles for phones:', profilesError);
          }
          const seen = new Set<string>();
          recipients = (profiles || [])
            .map((p: any) => ({ user_id: p.user_id, email: null, phone: p.phone }))
            .filter(r => {
              if (!r.phone || seen.has(r.phone)) return false;
              seen.add(r.phone);
              return true;
            });
        }
      } else if (input.segment.type === 'roles') {
        // Roles segment: fetch role user IDs first
        const { data: roleUsers, error: rolesError } = await supabase
          .from('event_roles')
          .select('user_id')
          .eq('event_id', input.eventId)
          .in('role', input.segment.roles ?? []);

        if (rolesError) {
          console.error('[useMessaging] Error fetching role users:', rolesError);
          throw rolesError;
        }

        const userIds = [...new Set((roleUsers || []).map((r: any) => r.user_id))];
        console.log('[useMessaging] Found role users:', userIds.length);

        if (input.channel === 'email') {
          recipients = userIds.map(userId => ({ user_id: userId, email: null, phone: null }));
        } else {
          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('user_id, phone')
            .in('user_id', userIds);
          if (profilesError) {
            console.error('[useMessaging] Error fetching user profiles for phones:', profilesError);
          }
          recipients = (profiles || []).map((p: any) => ({ user_id: p.user_id, email: null, phone: p.phone }));
        }
      } else if (input.segment.type === 'import_list') {
        console.log('[useMessaging] Using imported contact list:', input.segment.listId);
        const { data: contacts, error: contactsError } = await supabase
          .from('org_contact_import_entries')
          .select('email, phone')
          .eq('import_id', input.segment.listId);

        if (contactsError) {
          console.error('[useMessaging] Error fetching import list contacts:', contactsError);
          throw contactsError;
        }

        const emailSeen = new Set<string>();
        const phoneSeen = new Set<string>();

        recipients = (contacts || []).map((contact: any) => ({
          user_id: null,
          email: contact.email,
          phone: contact.phone,
        })).filter((recipient) => {
          if (input.channel === 'email') {
            if (!recipient.email) return false;
            const key = recipient.email.toLowerCase();
            if (emailSeen.has(key)) return false;
            emailSeen.add(key);
            return true;
          }
          if (!recipient.phone) return false;
          if (phoneSeen.has(recipient.phone)) return false;
          phoneSeen.add(recipient.phone);
          return true;
        });
      }

      // Filter: email needs either user binding or explicit email; sms needs phone
      const filtered = recipients.filter(r => (input.channel === 'email' ? !!(r.user_id || r.email) : !!r.phone));

      console.log('[useMessaging] Recipients before filtering:', recipients.length);
      console.log('[useMessaging] Recipients after filtering:', filtered.length);

      if (filtered.length) {
        console.log('[useMessaging] Inserting recipients in chunks...');
        // Chunk inserts
        const size = 1000;
        for (let i = 0; i < filtered.length; i += size) {
          const chunk = filtered.slice(i, i + size).map(r => ({
            job_id: job.id,
            user_id: r.user_id ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
          }));
          const { error: insertError } = await supabase.from('message_job_recipients').insert(chunk);
          if (insertError) {
            console.error('[useMessaging] Error inserting recipients chunk:', insertError);
            throw insertError;
          }
          console.log('[useMessaging] Inserted chunk of', chunk.length, 'recipients');
        }
      }

      if (input.dryRun) {
        console.log('[useMessaging] Dry run complete. Recipients:', filtered.length);
        // Do not enqueue
        return { job, enqueued: false, recipientCount: filtered.length };
      }

      console.log('[useMessaging] Triggering queue processing...');
      // 3) Trigger processing
      const { data: queueResult, error: queueError } = await supabase.functions.invoke('messaging-queue', {
        body: { job_id: job.id, batch_size: input.batchSize ?? 200 }
      });
      
      if (queueError) {
        console.error('[useMessaging] Queue trigger error:', queueError);
        throw new Error(queueError.message);
      }

      console.log('[useMessaging] Queue processing triggered:', queueResult);
      return { job, enqueued: true, recipientCount: filtered.length };
    } catch (error: any) {
      console.error('[useMessaging] createJob error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function getRecipientCount(eventId: string, segment: Segment) {
    try {
      if (segment.type === 'all_attendees') {
        const { count } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'issued');
        return count || 0;
      } else if (segment.type === 'roles') {
        const { count } = await supabase
          .from('event_roles')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .in('role', segment.roles ?? []);
        return count || 0;
      } else {
        const { count } = await supabase
          .from('org_contact_import_entries')
          .select('*', { count: 'exact', head: true })
          .eq('import_id', segment.listId);
        return count || 0;
      }
    } catch (e) {
      console.error('[useMessaging] getRecipientCount error', e);
      return 0;
    }
  }

  async function retryJob(jobId: string, batchSize = 200) {
    const { error } = await supabase.functions.invoke('messaging-queue', { body: { job_id: jobId, batch_size: batchSize } });
    if (error) throw new Error(error.message);
  }

  return { createJob, getRecipientCount, retryJob, loading };
}
