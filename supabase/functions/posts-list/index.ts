import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

/**
 * Enrich posts with:
 * - liked_by_me: whether current user has liked the post
 * - is_organizer: whether author is event organizer or org member
 * - Flattened author/event/tier data
 */
async function enrichPosts(posts: any[], currentUserId: string | undefined, supabase: any, orgMembersMap: Map<string, Set<string>>) {
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map(p => p.id);

  // Batch fetch: Check which posts current user has liked
  let likedPostIds = new Set<string>();
  if (currentUserId) {
    const { data: reactions } = await supabase
      .from('event_reactions')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', currentUserId)
      .eq('kind', 'like');
    
    likedPostIds = new Set(reactions?.map((r: any) => r.post_id) || []);
  }

  // Transform and enrich each post
  return posts.map(post => {
    const author = post.user_profiles || {};
    const event = post.events || {};
    const tier = post.ticket_tiers || {};

    // Check if author is organizer
    let isOrganizer = false;
    
    // Check if event data is available
    if (!event || !event.created_by) {
      console.log(`⚠️ Post ${post.id}: event data missing or incomplete`, { 
        hasEvent: !!event, 
        created_by: event?.created_by,
        owner_context_type: event?.owner_context_type,
        owner_context_id: event?.owner_context_id
      });
      // If event data is missing, default to false (attendee)
      // This ensures posts still show up even if event data fails
      isOrganizer = false;
    } else {
      // 1. Check if author is the event creator
      if (post.author_user_id === event.created_by) {
        isOrganizer = true;
      }
      // 2. For individual events, check if author is the owner
      else if (event.owner_context_type === 'individual' && post.author_user_id === event.owner_context_id) {
        isOrganizer = true;
      }
      // 3. For organization events, check if author is a member of the organization
      else if (event.owner_context_type === 'organization' && event.owner_context_id) {
        const orgMembers = orgMembersMap.get(event.owner_context_id);
        if (orgMembers && orgMembers.has(post.author_user_id)) {
          isOrganizer = true;
        }
      }
    }

    return {
      // Basic fields
      id: post.id,
      event_id: post.event_id,
      author_user_id: post.author_user_id,
      text: post.text || '',
      media_urls: post.media_urls || [],
      created_at: post.created_at,
      like_count: post.like_count ?? 0,
      comment_count: post.comment_count ?? 0,
      ticket_tier_id: post.ticket_tier_id,

      // Author data (flattened)
      author_name: author.display_name || 'User',
      author_display_name: author.display_name || 'User',
      author_photo_url: author.photo_url || null,
      author_username: author.username || null,
      author_instagram: null,
      author_twitter: null,
      author_website: null,

      // Badge/tier data
      badge_label: tier.badge_label || null,
      author_badge_label: tier.badge_label || null,
      tier_name: tier.name || null,

      // Organizer flag
      is_organizer: isOrganizer,
      author_is_organizer: isOrganizer,

      // Like status
      liked_by_me: likedPostIds.has(post.id),

      // Event data (flattened)
      event_title: event.title || 'Event',
      event_starts_at: event.start_at || null,

    };
  });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Posts-list function called with URL:', req.url);
    const url = new URL(req.url);
    const eventId = url.searchParams.get("event_id");
    const authorId = url.searchParams.get("user_id");
    const mentionedUserId = url.searchParams.get("mentioned_user_id");
    const filterType = url.searchParams.get("filter_type"); // 'organizer_only' or 'attendee_only'
    // 🔄 Backward-compatible pagination: support either page/limit OR cursor.
    const page = url.searchParams.get("page");
    const limit = parseInt(url.searchParams.get("limit") || "30", 10);
    const cursor = url.searchParams.get("cursor");

    console.log('Query params:', { eventId, authorId, mentionedUserId, filterType, limit, cursor, page });

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") }
        }
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    const currentUserId = user?.id;

    // ✅ Query event_posts - fetch separately and join manually to avoid schema cache issues
    let postsQuery = supabaseClient
      .from('event_posts')
      .select(`
        id, 
        created_at, 
        text, 
        media_urls, 
        author_user_id, 
        like_count, 
        comment_count, 
        event_id,
        ticket_tier_id
      `)
      .is('deleted_at', null);

    // Filter by event_id if provided
    if (eventId) {
      postsQuery = postsQuery.eq('event_id', eventId);
    }

    // Filter by author_user_id if provided
    if (authorId) {
      postsQuery = postsQuery.eq('author_user_id', authorId);
    }

    // Filter by mentioned_user_id if provided - fetch posts where user is tagged
    if (mentionedUserId) {
      // First get post IDs where user is mentioned
      const { data: mentions } = await supabaseClient
        .from('post_mentions')
        .select('post_id')
        .eq('mentioned_user_id', mentionedUserId);
      
      const mentionedPostIds = mentions?.map(m => m.post_id) || [];
      
      if (mentionedPostIds.length === 0) {
        // No posts where user is mentioned, return empty result early
        const response = createResponse({ data: [] });
        response.headers.set('Cache-Control', 'private, max-age=10');
        return response;
      }
      
      postsQuery = postsQuery.in('id', mentionedPostIds);
    }

    if (cursor) {
      // Cursor format: base64("timestamp_ms:id")
      const raw = Buffer.from(String(cursor), 'base64').toString('utf8');
      const [tsMsStr, idStr] = raw.split(':');
      const ts = new Date(Number(tsMsStr));
      const lastId = idStr;

      const { data: posts, error: postsError } = await postsQuery
        .or(`created_at.lt.${ts.toISOString()},and(created_at.eq.${ts.toISOString()},id.lt.${lastId})`)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Number(limit) + 1);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return createErrorResponse(postsError.message, 500);
      }

      const hasMore = posts && posts.length > Number(limit);
      const items = hasMore ? posts.slice(0, Number(limit)) : (posts || []);
      
      if (!items || items.length === 0) {
        return createResponse({ data: [], nextCursor: undefined });
      }

      // Manually fetch related data using SERVICE_ROLE to bypass RLS
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const authorIds = [...new Set(items.map((p: any) => p.author_user_id).filter(Boolean))];
      const eventIds = [...new Set(items.map((p: any) => p.event_id).filter(Boolean))];
      const tierIds = [...new Set(items.map((p: any) => p.ticket_tier_id).filter(Boolean))];

      const [authorsRes, eventsRes, tiersRes] = await Promise.all([
        authorIds.length ? adminClient.from('user_profiles').select('user_id, display_name, photo_url, username').in('user_id', authorIds) : { data: [] },
        eventIds.length ? adminClient.from('events').select('id, title, owner_context_type, owner_context_id, created_by, start_at').in('id', eventIds) : { data: [] },
        tierIds.length ? adminClient.from('ticket_tiers').select('id, badge_label, name').in('id', tierIds) : { data: [] }
      ]);

      // Log any errors in fetching related data
      if (authorsRes.error) console.error('❌ Error fetching authors:', authorsRes.error);
      if (eventsRes.error) console.error('❌ Error fetching events:', eventsRes.error);
      if (tiersRes.error) console.error('❌ Error fetching tiers:', tiersRes.error);

      // Create lookup maps
      const authorsMap = new Map((authorsRes.data || []).map((a: any) => [a.user_id, a]));
      const eventsMap = new Map((eventsRes.data || []).map((e: any) => [e.id, e]));
      const tiersMap = new Map((tiersRes.data || []).map((t: any) => [t.id, t]));

      console.log('📊 Authors fetched:', authorsRes.data?.length || 0);
      console.log('📊 Events fetched:', eventsRes.data?.length || 0);
      console.log('📊 Tiers fetched:', tiersRes.data?.length || 0);
      
      // Log event details for debugging
      if (eventsRes.data && eventsRes.data.length > 0) {
        console.log('📊 Sample event:', eventsRes.data[0]);
      }
      
      // Fetch organization memberships for org-owned events
      const orgIds = [...new Set(
        (eventsRes.data || [])
          .filter((e: any) => e.owner_context_type === 'organization' && e.owner_context_id)
          .map((e: any) => e.owner_context_id)
      )];
      
      const orgMembersMap = new Map<string, Set<string>>();
      if (orgIds.length > 0) {
        const { data: memberships } = await adminClient
          .from('org_memberships')
          .select('org_id, user_id')
          .in('org_id', orgIds);
        
        if (memberships) {
          memberships.forEach((m: any) => {
            if (!orgMembersMap.has(m.org_id)) {
              orgMembersMap.set(m.org_id, new Set());
            }
            orgMembersMap.get(m.org_id)!.add(m.user_id);
          });
        }
        console.log(`📊 Org memberships fetched for ${orgIds.length} orgs: ${memberships?.length || 0} total members`);
      }

      // Enrich posts
      const enrichedWithRelations = items.map((post: any) => {
        const author = authorsMap.get(post.author_user_id);
        console.log(`👤 Post ${post.id} - author_user_id: ${post.author_user_id}, found:`, author ? (author as any).display_name : 'NOT FOUND');
        return {
          ...post,
          user_profiles: author || null,
          events: eventsMap.get(post.event_id) || null,
          ticket_tiers: post.ticket_tier_id ? tiersMap.get(post.ticket_tier_id) || null : null
        };
      });
      
      // ✅ Enrich posts with liked_by_me and is_organizer
      let enrichedItems = await enrichPosts(enrichedWithRelations, currentUserId, supabaseClient, orgMembersMap);
      
      // Filter out posts from past events (but keep media from past events)
      const now = new Date();
      enrichedItems = enrichedItems.filter((post: any) => {
        // If event has no start date, include it
        if (!post.event_starts_at) return true;
        
        const eventDate = new Date(post.event_starts_at);
        const hasMedia = post.media_urls && post.media_urls.length > 0;
        
        // If event has passed
        if (eventDate < now) {
          // Keep posts with media (photos/videos) from past events
          // Filter out text-only posts from past events
          return hasMedia;
        }
        
        // Event hasn't passed, include all posts
        return true;
      });
      
      console.log(`📊 Before filter: ${enrichedItems.length} posts`);
      if (enrichedItems.length > 0) {
        const sample = enrichedItems[0];
        console.log('Sample post before filter:', { 
          id: sample.id, 
          author_user_id: sample.author_user_id,
          is_organizer: sample.is_organizer 
        });
      }
      
      // Apply organizer/attendee filter if specified
      console.log(`🎯 Filter type requested: ${filterType || 'none'}`);
      console.log(`📊 Posts before filtering: ${enrichedItems.length}`);
      
      if (enrichedItems.length > 0) {
        const sample = enrichedItems[0];
        console.log('Sample post data:', { 
          id: sample.id, 
          author_user_id: sample.author_user_id,
          is_organizer: sample.is_organizer,
          event_id: sample.event_id
        });
      }
      
      if (filterType === 'organizer_only') {
        const beforeCount = enrichedItems.length;
        enrichedItems = enrichedItems.filter((item: any) => item.is_organizer);
        console.log(`🔍 organizer_only filter: ${beforeCount} → ${enrichedItems.length} posts`);
        if (enrichedItems.length > 0) {
          console.log('Sample organizer post:', { id: enrichedItems[0].id, is_organizer: enrichedItems[0].is_organizer });
        } else {
          console.log('❌ No organizer posts found after filter');
          console.log('All posts is_organizer values:', enrichedItems.map((p: any) => ({ id: p.id, is_organizer: p.is_organizer })));
        }
      } else if (filterType === 'attendee_only') {
        const beforeCount = enrichedItems.length;
        enrichedItems = enrichedItems.filter((item: any) => !item.is_organizer);
        console.log(`🔍 attendee_only filter: ${beforeCount} → ${enrichedItems.length} posts`);
        if (enrichedItems.length > 0) {
          console.log('Sample attendee post:', { id: enrichedItems[0].id, is_organizer: enrichedItems[0].is_organizer });
        } else {
          console.log('❌ No attendee posts found after filter');
        }
      } else {
        console.log('✅ No filter applied, showing all posts');
      }
      
      const tail = enrichedItems[enrichedItems.length - 1];
      const nextCursor = tail
        ? Buffer.from(`${new Date(tail.created_at).getTime()}:${tail.id}`, 'utf8').toString('base64')
        : undefined;

      // Optional: basic cache hints
      const response = createResponse({ data: enrichedItems, nextCursor });
      response.headers.set('Cache-Control', 'private, max-age=10');
      return response;
    } else {
      // Legacy path: still supported
      const safeLimit = Math.min(Number(limit), 50);
      const safePage = Math.max(Number(page ?? 1), 1);
      const offset = (safePage - 1) * safeLimit;

      const { data: posts, error: postsError } = await postsQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + safeLimit - 1);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return createErrorResponse(postsError.message, 500);
      }

      if (!posts || posts.length === 0) {
        return createResponse({ data: [] });
      }

      // Manually fetch related data using SERVICE_ROLE to bypass RLS
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const authorIds = [...new Set(posts.map((p: any) => p.author_user_id).filter(Boolean))];
      const eventIds = [...new Set(posts.map((p: any) => p.event_id).filter(Boolean))];
      const tierIds = [...new Set(posts.map((p: any) => p.ticket_tier_id).filter(Boolean))];

      const [authorsRes, eventsRes, tiersRes] = await Promise.all([
        authorIds.length ? adminClient.from('user_profiles').select('user_id, display_name, photo_url, username').in('user_id', authorIds) : { data: [] },
        eventIds.length ? adminClient.from('events').select('id, title, owner_context_type, owner_context_id, created_by, start_at').in('id', eventIds) : { data: [] },
        tierIds.length ? adminClient.from('ticket_tiers').select('id, badge_label, name').in('id', tierIds) : { data: [] }
      ]);

      // Log any errors in fetching related data
      if (authorsRes.error) console.error('❌ [Offset] Error fetching authors:', authorsRes.error);
      if (eventsRes.error) console.error('❌ [Offset] Error fetching events:', eventsRes.error);
      if (tiersRes.error) console.error('❌ [Offset] Error fetching tiers:', tiersRes.error);

      // Create lookup maps
      const authorsMap = new Map((authorsRes.data || []).map((a: any) => [a.user_id, a]));
      const eventsMap = new Map((eventsRes.data || []).map((e: any) => [e.id, e]));
      const tiersMap = new Map((tiersRes.data || []).map((t: any) => [t.id, t]));

      console.log('📊 [Offset] Authors fetched:', authorsRes.data?.length || 0);
      console.log('📊 [Offset] Events fetched:', eventsRes.data?.length || 0);
      console.log('📊 [Offset] Tiers fetched:', tiersRes.data?.length || 0);
      
      // Log event details for debugging
      if (eventsRes.data && eventsRes.data.length > 0) {
        console.log('📊 [Offset] Sample event:', eventsRes.data[0]);
      }
      
      // Fetch organization memberships for org-owned events
      const orgIds = [...new Set(
        (eventsRes.data || [])
          .filter((e: any) => e.owner_context_type === 'organization' && e.owner_context_id)
          .map((e: any) => e.owner_context_id)
      )];
      
      const orgMembersMap = new Map<string, Set<string>>();
      if (orgIds.length > 0) {
        const { data: memberships } = await adminClient
          .from('org_memberships')
          .select('org_id, user_id')
          .in('org_id', orgIds);
        
        if (memberships) {
          memberships.forEach((m: any) => {
            if (!orgMembersMap.has(m.org_id)) {
              orgMembersMap.set(m.org_id, new Set());
            }
            orgMembersMap.get(m.org_id)!.add(m.user_id);
          });
        }
        console.log(`📊 [Offset] Org memberships fetched for ${orgIds.length} orgs: ${memberships?.length || 0} total members`);
      }

      // Enrich posts
      const enrichedWithRelations = posts.map((post: any) => {
        const author = authorsMap.get(post.author_user_id);
        console.log(`👤 [Offset] Post ${post.id} - author_user_id: ${post.author_user_id}, found:`, author ? (author as any).display_name : 'NOT FOUND');
        return {
          ...post,
          user_profiles: author || null,
          events: eventsMap.get(post.event_id) || null,
          ticket_tiers: post.ticket_tier_id ? tiersMap.get(post.ticket_tier_id) || null : null
        };
      });

      // ✅ Enrich posts with liked_by_me and is_organizer
      let enrichedItems = await enrichPosts(enrichedWithRelations, currentUserId, supabaseClient, orgMembersMap);

      // Filter out posts from past events (but keep media from past events)
      const now = new Date();
      enrichedItems = enrichedItems.filter((post: any) => {
        // If event has no start date, include it
        if (!post.event_starts_at) return true;
        
        const eventDate = new Date(post.event_starts_at);
        const hasMedia = post.media_urls && post.media_urls.length > 0;
        
        // If event has passed
        if (eventDate < now) {
          // Keep posts with media (photos/videos) from past events
          // Filter out text-only posts from past events
          return hasMedia;
        }
        
        // Event hasn't passed, include all posts
        return true;
      });

      console.log(`📊 [Offset] Before filter: ${enrichedItems.length} posts`);
      if (enrichedItems.length > 0) {
        const sample = enrichedItems[0];
        console.log('Sample post before filter:', { 
          id: sample.id, 
          author_user_id: sample.author_user_id,
          is_organizer: sample.is_organizer 
        });
      }

      // Apply organizer/attendee filter if specified
      console.log(`🎯 [Offset] Filter type requested: ${filterType || 'none'}`);
      console.log(`📊 [Offset] Posts before filtering: ${enrichedItems.length}`);
      
      if (enrichedItems.length > 0) {
        const sample = enrichedItems[0];
        console.log('[Offset] Sample post data:', { 
          id: sample.id, 
          author_user_id: sample.author_user_id,
          is_organizer: sample.is_organizer,
          event_id: sample.event_id
        });
      }
      
      if (filterType === 'organizer_only') {
        const beforeCount = enrichedItems.length;
        enrichedItems = enrichedItems.filter((item: any) => item.is_organizer);
        console.log(`🔍 [Offset] organizer_only filter: ${beforeCount} → ${enrichedItems.length} posts`);
        if (enrichedItems.length > 0) {
          console.log('Sample organizer post:', { id: enrichedItems[0].id, is_organizer: enrichedItems[0].is_organizer });
        } else {
          console.log('❌ [Offset] No organizer posts found after filter');
        }
      } else if (filterType === 'attendee_only') {
        const beforeCount = enrichedItems.length;
        enrichedItems = enrichedItems.filter((item: any) => !item.is_organizer);
        console.log(`🔍 [Offset] attendee_only filter: ${beforeCount} → ${enrichedItems.length} posts`);
        if (enrichedItems.length > 0) {
          console.log('Sample attendee post:', { id: enrichedItems[0].id, is_organizer: enrichedItems[0].is_organizer });
        } else {
          console.log('❌ [Offset] No attendee posts found after filter');
        }
      } else {
        console.log('✅ [Offset] No filter applied, showing all posts');
      }

      const response = createResponse({ data: enrichedItems });
      response.headers.set('Cache-Control', 'private, max-age=10');
      return response;
    }
  } catch (error) {
    console.error('Error in posts-list function:', error);
    return createErrorResponse(error?.message || 'Unknown error', 500);
  }
});
