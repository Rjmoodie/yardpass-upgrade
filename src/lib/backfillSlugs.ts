/**
 * Utility to backfill slugs for existing events
 * This can be run once to update events that don't have slugs
 */

import { supabase } from '@/integrations/supabase/client';
import { createEventSlug } from './slugUtils';

export async function backfillEventSlugs() {
  try {
    // Get all events without slugs
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, slug')
      .or('slug.is.null,slug.eq.""');

    if (error) {
      console.error('Error fetching events:', error);
      return { success: false, error: error.message };
    }

    if (!events || events.length === 0) {
      console.log('No events need slug backfill');
      return { success: true, updated: 0 };
    }

    console.log(`Backfilling slugs for ${events.length} events...`);

    // Update each event with a generated slug
    let updated = 0;
    for (const event of events) {
      const slug = createEventSlug(event.title);
      const { error: updateError } = await supabase
        .from('events')
        .update({ slug })
        .eq('id', event.id);

      if (updateError) {
        console.error(`Error updating event ${event.id}:`, updateError);
      } else {
        updated++;
      }
    }

    console.log(`Successfully backfilled slugs for ${updated} events`);
    return { success: true, updated };

  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

// Helper function to manually run backfill (can be called from browser console)
export function runSlugBackfill() {
  backfillEventSlugs().then(result => {
    console.log('Backfill result:', result);
  });
}