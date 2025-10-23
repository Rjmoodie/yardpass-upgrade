// src/lib/emailHelpers.ts
// Helper functions to fetch org and event data for email templates

import { supabase } from '@/integrations/supabase/client';
import type { OrgInfo, EventInfo } from '@/components/EmailTemplates';

/**
 * Fetches organization info for email templates
 */
export async function getOrgInfoForEmail(orgId: string): Promise<OrgInfo | undefined> {
  try {
    const { data: org, error } = await supabase
      .from('organizations.organizations')
      .select('name, logo_url, handle, support_email')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      console.warn('[emailHelpers] Failed to fetch org info:', error);
      return undefined;
    }

    return {
      name: org.name,
      logoUrl: org.logo_url || undefined,
      websiteUrl: org.handle ? `https://yardpass.tech/org/${org.handle}` : undefined,
      supportEmail: org.support_email || 'support@yardpass.tech',
    };
  } catch (err) {
    console.error('[emailHelpers] Error fetching org info:', err);
    return undefined;
  }
}

/**
 * Fetches event info for email templates
 */
export async function getEventInfoForEmail(eventId: string): Promise<EventInfo | undefined> {
  try {
    const { data: event, error } = await supabase
      .from('events.events')
      .select('title, start_at, venue, city, cover_image_url, description')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      console.warn('[emailHelpers] Failed to fetch event info:', error);
      return undefined;
    }

    return {
      title: event.title,
      date: event.start_at,
      location: event.city || event.venue || 'TBA',
      venue: event.venue || undefined,
      coverImageUrl: event.cover_image_url || undefined,
      description: event.description || undefined,
    };
  } catch (err) {
    console.error('[emailHelpers] Error fetching event info:', err);
    return undefined;
  }
}

/**
 * Fetches both org and event info for a given event
 */
export async function getEmailContext(eventId: string): Promise<{
  orgInfo?: OrgInfo;
  eventInfo?: EventInfo;
}> {
  try {
    const { data: event } = await supabase
      .from('events.events')
      .select(`
        title,
        start_at,
        venue,
        city,
        cover_image_url,
        description,
        owner_context_type,
        owner_context_id
      `)
      .eq('id', eventId)
      .single();

    if (!event) {
      return {};
    }

    const eventInfo: EventInfo = {
      title: event.title,
      date: event.start_at,
      location: event.city || event.venue || 'TBA',
      venue: event.venue || undefined,
      coverImageUrl: event.cover_image_url || undefined,
      description: event.description || undefined,
    };

    let orgInfo: OrgInfo | undefined;
    
    if (event.owner_context_type === 'organization' && event.owner_context_id) {
      orgInfo = await getOrgInfoForEmail(event.owner_context_id);
    }

    return { orgInfo, eventInfo };
  } catch (err) {
    console.error('[emailHelpers] Error fetching email context:', err);
    return {};
  }
}
