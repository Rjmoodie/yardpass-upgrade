import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface ShareEventRequest {
  event_id: string;
  platform?: 'twitter' | 'facebook' | 'instagram' | 'whatsapp' | 'email' | 'copy';
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { event_id, platform = 'copy' }: ShareEventRequest = await req.json();

    // Get event details
    const { data: event, error } = await supabase
      .from('events')
      .select('id, title, description, start_at, location')
      .eq('id', event_id)
      .single();

    if (error || !event) {
      return createErrorResponse('Event not found', 404);
    }

    // Create share URL
    const baseUrl = req.headers.get('origin') || 'https://liventix.app';
    const shareUrl = `${baseUrl}/event/${event.id}`;
    
    // Create share text
    const shareText = `Check out ${event.title} on Liventix! ${event.description ? event.description.slice(0, 100) + '...' : ''}`;

    // Platform-specific URLs
    const platformUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      email: `mailto:?subject=${encodeURIComponent(`${event.title} on Liventix`)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
      copy: shareUrl
    };

    // Track share event (optional analytics)
    try {
      await supabase
        .from('event_reactions')
        .insert({
          post_id: null, // This is a direct event share, not a post share
          user_id: null, // Anonymous sharing allowed
          kind: 'share',
          metadata: { platform, event_id }
        });
    } catch (analyticsError) {
      console.log('Analytics tracking failed:', analyticsError);
      // Don't fail the request if analytics fails
    }

    return createResponse({
      event: {
        id: event.id,
        title: event.title,
        url: shareUrl
      },
      share: {
        text: shareText,
        url: platformUrls[platform as keyof typeof platformUrls] || shareUrl,
        platform
      }
    });

  } catch (error) {
    console.error('Share event error:', error);
    return createErrorResponse((error as any).message);
  }
});