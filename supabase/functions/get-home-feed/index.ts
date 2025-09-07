import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    console.log("Starting get-home-feed request");
    
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !user) {
      console.error("Authentication failed:", userErr);
      return createErrorResponse("not_authenticated", 401);
    }

    console.log("User authenticated:", user.id);

    const { posts_per_event = 3, sort_by_activity = false } = await req.json();

    // Get events where user is organizer or has tickets
    const [orgEvents, ticketEvents] = await Promise.all([
      sbUser.from('events').select('id').eq('created_by', user.id),
      sbUser.from('tickets').select('event_id').eq('user_id', user.id).eq('status', 'issued')
    ]);

    const eventIds = Array.from(new Set([
      ...(orgEvents.data || []).map(e => e.id),
      ...(ticketEvents.data || []).map(t => t.event_id)
    ]));

    if (eventIds.length === 0) {
      console.log("User not related to any events");
      return createResponse({ events: [], totalCount: 0 }, 200);
    }

    console.log(`Found ${eventIds.length} related events for user`);

    // Use service role for efficient querying
    const sbSrv = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Build the query with proper ordering
    let query = sbSrv
      .from('events')
      .select(`
        id, title, description, start_at, end_at, venue, city, category, cover_image_url, visibility, created_by,
        user_profiles!events_created_by_fkey ( id, display_name, avatar_url ),
        ticket_tiers!ticket_tiers_event_id_fkey ( id, name, price_cents, badge_label, quantity ),
        event_posts (
          id, content, created_at, media_type, media_url, thumbnail_url, like_count, comment_count,
          user_profiles!event_posts_author_id_fkey ( id, display_name, avatar_url )
        )
      `)
      .in('id', eventIds);

    // Add post ordering and limiting
    query = query
      .order('created_at', { foreignTable: 'event_posts', ascending: false })
      .limit(posts_per_event, { foreignTable: 'event_posts' });

    // Main event ordering
    if (sort_by_activity) {
      // For activity-based sorting, we'll do it client-side after fetching
      query = query.order('start_at', { ascending: true });
    } else {
      query = query.order('start_at', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Events query error:", error);
      throw error;
    }

    if (!data || !data.length) {
      return createResponse({ events: [], totalCount: 0 }, 200);
    }

    // Get real attendee counts for each event
    const attendeeCounts = await Promise.all(
      data.map(async (event: any) => {
        const { count } = await sbSrv
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'issued');
        return { eventId: event.id, count: count || 0 };
      })
    );

    const attendeeMap = new Map(attendeeCounts.map(ac => [ac.eventId, ac.count]));

    // Transform the data
    const transformed = data.map((e: any) => {
      const recentPosts = (e.event_posts || [])
        .filter((p: any) => p?.id)
        .map((post: any) => ({
          id: post.id,
          authorName: post.user_profiles?.display_name || 'Anonymous',
          authorBadge: post.user_profiles?.id === e.created_by ? 'ORGANIZER' : 'ATTENDEE',
          isOrganizer: post.user_profiles?.id === e.created_by,
          content: post.content || '',
          timestamp: new Date(post.created_at).toLocaleDateString(),
          likes: post.like_count || 0,
          mediaType: (post.media_type as 'image' | 'video') ?? undefined,
          mediaUrl: post.media_url,
          thumbnailUrl: post.thumbnail_url,
          commentCount: post.comment_count || 0
        }));

      // Calculate latest activity timestamp
      const latestPostTime = recentPosts.length > 0 
        ? Math.max(...recentPosts.map(p => new Date(p.timestamp).getTime()))
        : 0;
      const eventTime = new Date(e.start_at).getTime();
      const latestActivityAt = Math.max(latestPostTime, eventTime);

      return {
        id: e.id,
        title: e.title,
        description: e.description || '',
        organizer: e.user_profiles?.display_name || 'Organizer',
        organizerId: e.created_by,
        category: e.category || 'Event',
        startAtISO: e.start_at,
        endAtISO: e.end_at,
        dateLabel: new Date(e.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        location: e.city || e.venue || 'TBA',
        coverImage: e.cover_image_url || '/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png',
        ticketTiers: (e.ticket_tiers || []).map((t: any) => ({ 
          id: t.id, 
          name: t.name, 
          price: (t.price_cents||0)/100, 
          badge: t.badge_label, 
          available: t.quantity||0, 
          total: t.quantity||0 
        })),
        attendeeCount: attendeeMap.get(e.id) || 0, // Real attendee count
        likes: Math.floor(Math.random()*500)+10, // TODO: Replace with real likes
        shares: Math.floor(Math.random()*100)+5, // TODO: Replace with real shares
        isLiked: false,
        posts: recentPosts,
        latestActivityAt
      };
    });

    // Sort by activity if requested
    if (sort_by_activity) {
      transformed.sort((a, b) => b.latestActivityAt - a.latestActivityAt);
    }

    console.log(`Successfully processed ${transformed.length} events with posts`);

    return createResponse({ 
      events: transformed, 
      totalCount: transformed.length,
      sortByActivity: sort_by_activity
    }, 200);

  } catch (e) {
    console.error("get-home-feed error:", e);
    return createErrorResponse(e?.message ?? "unknown_error", 500);
  }
});
