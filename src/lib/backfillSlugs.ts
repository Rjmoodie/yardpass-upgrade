/**
 * Utility to backfill slugs for existing events
 * This can be run once to update events that don't have slugs
 */

import { supabase } from '@/integrations/supabase/client';
import { ensureAvailableSlug } from './slugUtils';

export async function backfillEventSlugs() {
  try {
    const { data: events, error } = await supabase
      .from('events.events')
      .select('id, title, slug')
      .or('slug.is.null,slug.eq.""');

    if (error) return { success: false, error: error.message };
    if (!events?.length) return { success: true, updated: 0 };

    let updated = 0;
    for (const ev of events) {
      const slug = await ensureAvailableSlug(ev.title, async (candidate) => {
        const { count, error: existsErr } = await supabase
          .from('events.events')
          .select('id', { head: true, count: 'exact' })
          .eq('slug', candidate);
        if (existsErr) return true;
        return !!count && count > 0;
      });

      const { error: updateError } = await supabase
        .from('events.events')
        .update({ slug })
        .eq('id', ev.id);

      if (!updateError) updated++;
    }
    return { success: true, updated };
  } catch (e) {
    return { success: false, error: 'Unexpected error' };
  }
}

// Helper function to manually run backfill (can be called from browser console)
export function runSlugBackfill() {
  backfillEventSlugs().then(result => {
    console.log('Backfill result:', result);
  });
}