import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

/**
 * Enrich posts with:
 * - liked_by_me: whether current user has liked the post
 * - is_organizer: whether author is event organizer or org member
 * - Flattened author/event/tier data
 */
async function enrichPosts(
  posts: any[], 
  currentUserId: string | undefined, 
  supabase: any, 
  orgMembersMap: Map<string, Set<string>>,
  orgDetailsMap: Map<string, { id: string; name: string; logo_url: string | null }>
) {
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
    if (!event) {
      console.log(`⚠️ Post ${post.id}: event data missing`, { 
        hasEvent: !!event,
        event_id: post.event_id
      });
      // If event data is missing, default to false (attendee)
      // This ensures posts still show up even if event data fails
      isOrganizer = false;
    } else {
      // 1. Check if author is the event creator (ALWAYS organizer, regardless of ownership type)
      // This is the highest priority check - creators are always organizers
      console.log(`🔍 Post ${post.id}: Checking creator match...`, {
        author_user_id: post.author_user_id,
        author_user_id_type: typeof post.author_user_id,
        event_created_by: event.created_by,
        event_created_by_type: typeof event.created_by,
        are_equal: post.author_user_id === event.created_by,
        owner_context_type: event.owner_context_type
      });
      
      if (event.created_by && post.author_user_id === event.created_by) {
        isOrganizer = true;
        console.log(`✅ Post ${post.id}: Author is event creator → ORGANIZER`, {
          author_user_id: post.author_user_id,
          event_created_by: event.created_by,
          owner_context_type: event.owner_context_type
        });
      }
      // 2. For individual events, check if author is the owner
      else if (event.owner_context_type === 'individual' && event.owner_context_id && post.author_user_id === event.owner_context_id) {
        isOrganizer = true;
        console.log(`✅ Post ${post.id}: Author is individual event owner → ORGANIZER`, {
          author_user_id: post.author_user_id,
          owner_context_id: event.owner_context_id
        });
      }
      // 3. For organization events, check if author is a member of the organization
      // NOTE: This check happens AFTER the created_by check, so creators are already handled
      else if (event.owner_context_type === 'organization' && event.owner_context_id) {
        const orgMembers = orgMembersMap.get(event.owner_context_id);
        if (orgMembers && orgMembers.has(post.author_user_id)) {
          isOrganizer = true;
          console.log(`✅ Post ${post.id}: Author is org member → ORGANIZER`, {
            author_user_id: post.author_user_id,
            org_id: event.owner_context_id,
            orgMembersList: Array.from(orgMembers)
          });
        } else {
          // Author is NOT an org member and NOT the creator → attendee
          console.log(`❌ Post ${post.id}: Author is NOT organizer → ATTENDEE`, {
            author_user_id: post.author_user_id,
            event_created_by: event.created_by,
            isCreator: post.author_user_id === event.created_by,
            org_id: event.owner_context_id,
            orgMembersCount: orgMembers?.size || 0,
            hasOrgMembers: !!orgMembers,
            orgMembersList: orgMembers ? Array.from(orgMembers) : []
          });
        }
      } else {
        // Edge case: event has no owner_context_type or owner_context_id
        // Only the creator is organizer in this case (already checked above)
        console.log(`❌ Post ${post.id}: Not identified as organizer (edge case) → ATTENDEE`, {
          author_user_id: post.author_user_id,
          created_by: event.created_by,
          isCreator: post.author_user_id === event.created_by,
          owner_context_type: event.owner_context_type,
          owner_context_id: event.owner_context_id
        });
      }
    }

    // Determine display author (org if post_as_context_type is 'organization', otherwise user)
    const postAsOrg = (post.post_as_context_type === 'organization' && post.post_as_context_id)
      ? orgDetailsMap.get(post.post_as_context_id)
      : null;

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

      // Post as organization fields
      post_as_context_type: post.post_as_context_type || null,
      post_as_context_id: post.post_as_context_id || null,

      // Author data (flattened) - show org if posting as org, otherwise user
      author_name: postAsOrg ? postAsOrg.name : (author.display_name || 'User'),
      author_display_name: postAsOrg ? postAsOrg.name : (author.display_name || 'User'),
      author_photo_url: postAsOrg ? postAsOrg.logo_url : (author.photo_url || null),
      author_username: postAsOrg ? null : (author.username || null),
      author_instagram: null,
      author_twitter: null,
      author_website: null,

      // Organization branding (when posting as org)
      post_as_org_name: postAsOrg?.name || null,
      post_as_org_logo: postAsOrg?.logo_url || null,

      // Badge/tier data
      badge_label: tier.badge_label || null,
      author_badge_label: postAsOrg ? 'ORGANIZATION' : (tier.badge_label || null),
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

    // Create Supabase client for user-specific data (likes, etc.)
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

    // ✅ Create admin client for bypassing RLS on post queries
    // This ensures consistent access for all users (authenticated, guest OTP, anonymous)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ✅ Helper function to build posts query (with or without post_as columns for backward compatibility)
    const buildPostsQuery = (includePostAsColumns: boolean) => {
      const baseSelect = `
        id, 
        created_at, 
        text, 
        media_urls, 
        author_user_id, 
        like_count, 
        comment_count, 
        event_id,
        ticket_tier_id
      `;
      const postAsSelect = includePostAsColumns ? `,
        post_as_context_type,
        post_as_context_id` : '';
      
      let query = adminClient
        .from('event_posts')
        .select(`${baseSelect}${postAsSelect}`)
        .is('deleted_at', null);

      if (eventId) query = query.eq('event_id', eventId);
      if (authorId) query = query.eq('author_user_id', authorId);
      
      return query;
    };

    // Filter by mentioned_user_id if provided - fetch posts where user is tagged
    let mentionedPostIds: string[] = [];
    if (mentionedUserId) {
      const { data: mentions } = await supabaseClient
        .from('post_mentions')
        .select('post_id')
        .eq('mentioned_user_id', mentionedUserId);
      
      mentionedPostIds = mentions?.map(m => m.post_id) || [];
      
      if (mentionedPostIds.length === 0) {
        const response = createResponse({ data: [] });
        response.headers.set('Cache-Control', 'private, max-age=10');
        return response;
      }
    }

    if (cursor) {
      // Cursor format: base64("timestamp_ms:id")
      const raw = Buffer.from(String(cursor), 'base64').toString('utf8');
      const [tsMsStr, idStr] = raw.split(':');
      const ts = new Date(Number(tsMsStr));
      const lastId = idStr;

      // Try with post_as columns first, fallback if they don't exist (backward compatibility)
      let posts: any = null;
      let postsError: any = null;
      
      try {
        let postsQuery = buildPostsQuery(true);
        if (mentionedPostIds.length > 0) {
          postsQuery = postsQuery.in('id', mentionedPostIds);
        }

        const result = await postsQuery
          .or(`created_at.lt.${ts.toISOString()},and(created_at.eq.${ts.toISOString()},id.lt.${lastId})`)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(Number(limit) + 1);
        
        posts = result.data;
        postsError = result.error;
      } catch (err: any) {
        postsError = err;
        console.log('⚠️ Exception caught in posts query:', err);
      }

      // If error is "column does not exist", retry without post_as columns
      if (postsError) {
        const errorMessage = postsError?.message || postsError?.details || String(postsError || '');
        const errorString = JSON.stringify(postsError);
        const isColumnError = errorMessage.includes('post_as_context_type') || 
                             errorMessage.includes('does not exist') || 
                             (errorMessage.includes('column') && errorMessage.includes('not exist')) ||
                             errorString.includes('post_as_context_type');
        
        if (isColumnError) {
          console.log('⚠️ post_as columns not found, retrying without them...', { errorMessage, errorString });
          try {
            let postsQuery = buildPostsQuery(false);
            if (mentionedPostIds.length > 0) {
              postsQuery = postsQuery.in('id', mentionedPostIds);
            }
            const retryResult = await postsQuery
              .or(`created_at.lt.${ts.toISOString()},and(created_at.eq.${ts.toISOString()},id.lt.${lastId})`)
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .limit(Number(limit) + 1);
            posts = retryResult.data;
            postsError = retryResult.error;
          } catch (retryErr: any) {
            console.error('❌ Retry also failed:', retryErr);
            postsError = retryErr;
          }
        }
      }

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return createErrorResponse(postsError.message, 500);
      }

      const hasMore = posts && posts.length > Number(limit);
      const items = hasMore ? posts.slice(0, Number(limit)) : (posts || []);
      
      // Ensure posts have post_as fields (set to null if migration hasn't been applied)
      const itemsWithDefaults = items.map((p: any) => ({
        ...p,
        post_as_context_type: p.post_as_context_type || null,
        post_as_context_id: p.post_as_context_id || null,
      }));
      
      if (!itemsWithDefaults || itemsWithDefaults.length === 0) {
        return createResponse({ data: [], nextCursor: undefined });
      }

      // Fetch related data using admin client (already created earlier)
      const authorIds = [...new Set(itemsWithDefaults.map((p: any) => p.author_user_id).filter(Boolean))];
      const eventIds = [...new Set(itemsWithDefaults.map((p: any) => p.event_id).filter(Boolean))];
      const tierIds = [...new Set(itemsWithDefaults.map((p: any) => p.ticket_tier_id).filter(Boolean))];

      const [authorsRes, eventsRes, tiersRes] = await Promise.all([
        authorIds.length ? adminClient.from('user_profiles').select('user_id, display_name, photo_url, username').in('user_id', authorIds) : { data: [] },
        eventIds.length ? adminClient.from('events').select('id, title, owner_context_type, owner_context_id, created_by, start_at, visibility').in('id', eventIds) : { data: [] },
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
        eventsRes.data.forEach((e: any) => {
          console.log(`📊 Event ${e.id}:`, {
            title: e.title,
            visibility: e.visibility,
            owner_context_type: e.owner_context_type,
            owner_context_id: e.owner_context_id,
            created_by: e.created_by,
          });
        });
      }
      
      // Log all posts before filtering
      console.log(`📊 Total posts fetched: ${itemsWithDefaults.length}`);
      itemsWithDefaults.forEach((p: any) => {
        console.log(`📝 Post ${p.id}:`, {
          event_id: p.event_id,
          author_user_id: p.author_user_id,
          has_text: !!p.text,
          media_count: p.media_urls?.length || 0
        });
      });
      
      // ✅ Filter posts: Only exclude posts from deleted events or private events (unless authenticated)
      // For public/unlisted events, show all posts to everyone
      const itemsAfterVisibility = itemsWithDefaults.filter((p: any) => {
        const event = eventsMap.get(p.event_id);
        
        // If no event data, include the post (edge case protection)
        if (!event) {
          console.log(`⚠️ Post ${p.id}: No event data found, including post`);
          return true;
        }
        
        // Public/unlisted events: show to everyone
        if (event.visibility === 'public' || event.visibility === 'unlisted') {
          return true;
        }
        
        // Private events: only show if user is authenticated
        if (event.visibility === 'private') {
          return !!currentUserId;
        }
        
        // Default: exclude if visibility is unknown
        return false;
      });
      
      console.log(`🔒 Visibility filter: ${itemsWithDefaults.length} → ${itemsAfterVisibility.length} posts`);
      
      if (itemsAfterVisibility.length === 0) {
        const response = createResponse({ data: [], nextCursor: undefined });
        response.headers.set('Cache-Control', 'private, max-age=10');
        return response;
      }
      
      // Fetch organization memberships for org-owned events (after visibility filter)
      const orgIds = [...new Set(
        (eventsRes.data || [])
          .filter((e: any) => e.owner_context_type === 'organization' && e.owner_context_id)
          .map((e: any) => e.owner_context_id)
      )];

      // Fetch post_as_context_id values to get organization IDs for posts posted "as" org
      const postAsOrgIds = [...new Set(
        (itemsAfterVisibility || [])
          .filter((p: any) => p.post_as_context_type === 'organization' && p.post_as_context_id)
          .map((p: any) => p.post_as_context_id)
          .filter(Boolean)
      )];

      // Combine all org IDs (event owners + post_as orgs)
      const allOrgIds = [...new Set([...orgIds, ...postAsOrgIds])];
      
      console.log(`📊 Organization IDs to check: ${orgIds.length}`, orgIds);
      
      const orgMembersMap = new Map<string, Set<string>>();
      if (orgIds.length > 0) {
        const { data: memberships, error: membershipError } = await adminClient
          .from('org_memberships')
          .select('org_id, user_id')
          .in('org_id', orgIds);
        
        if (membershipError) {
          console.error('❌ Error fetching org memberships:', membershipError);
        }
        
        if (memberships) {
          memberships.forEach((m: any) => {
            if (!orgMembersMap.has(m.org_id)) {
              orgMembersMap.set(m.org_id, new Set());
            }
            orgMembersMap.get(m.org_id)!.add(m.user_id);
          });
          
          // Log org membership details
          orgMembersMap.forEach((members, orgId) => {
            console.log(`📊 Org ${orgId} has ${members.size} members:`, Array.from(members));
          });
        }
        console.log(`📊 Org memberships fetched for ${orgIds.length} orgs: ${memberships?.length || 0} total members`);
      } else {
        console.log('📊 No organization-owned events found, skipping org membership fetch');
      }

      // Fetch organization details for posts posted "as" organization
      const orgDetailsMap = new Map<string, { id: string; name: string; logo_url: string | null }>();
      if (allOrgIds.length > 0) {
        const { data: orgsData, error: orgsError } = await adminClient
          .from('organizations')
          .select('id, name, logo_url')
          .in('id', allOrgIds);

        if (orgsError) {
          console.error('❌ Error fetching org details:', orgsError);
        } else if (orgsData) {
          orgsData.forEach((org: any) => {
            orgDetailsMap.set(org.id, {
              id: org.id,
              name: org.name,
              logo_url: org.logo_url
            });
          });
          console.log(`📊 Fetched ${orgsData.length} organization details for post_as display`);
        }
      }

      // Enrich posts (use filtered items)
      const enrichedWithRelations = itemsAfterVisibility.map((post: any) => {
        const author = authorsMap.get(post.author_user_id);
        const event = eventsMap.get(post.event_id);
        console.log(`👤 Post ${post.id} - Preparing for organizer detection:`, {
          author_user_id: post.author_user_id,
          author_name: author ? (author as any).display_name : 'NOT FOUND',
          event_id: post.event_id,
          event_title: event?.title,
          event_created_by: event?.created_by,
          event_owner_type: event?.owner_context_type,
          event_owner_id: event?.owner_context_id
        });
        return {
          ...post,
          user_profiles: author || null,
          events: event || null,
          ticket_tiers: post.ticket_tier_id ? tiersMap.get(post.ticket_tier_id) || null : null
        };
      });
      
      // ✅ Enrich posts with liked_by_me and is_organizer
      let enrichedItems = await enrichPosts(enrichedWithRelations, currentUserId, supabaseClient, orgMembersMap, orgDetailsMap);
      
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
        // Log all posts before filtering to debug
        console.log('📋 All posts before organizer_only filter:', enrichedItems.map((p: any) => ({
          id: p.id,
          author_user_id: p.author_user_id,
          is_organizer: p.is_organizer,
          event_id: p.event_id
        })));
        
        enrichedItems = enrichedItems.filter((item: any) => {
          const isOrg = !!item.is_organizer;
          if (!isOrg) {
            console.log(`🚫 Filtering out non-organizer post ${item.id}:`, {
              author_user_id: item.author_user_id,
              is_organizer: item.is_organizer
            });
          }
          return isOrg;
        });
        
        console.log(`🔍 organizer_only filter: ${beforeCount} → ${enrichedItems.length} posts`);
        if (enrichedItems.length > 0) {
          console.log('✅ Sample organizer post:', { 
            id: enrichedItems[0].id, 
            is_organizer: enrichedItems[0].is_organizer,
            author_user_id: enrichedItems[0].author_user_id
          });
        } else {
          console.log('❌ No organizer posts found after filter');
          // Log all posts before filtering to see why they were filtered
          const allPostsBeforeFilter = await enrichPosts(enrichedWithRelations, currentUserId, supabaseClient, orgMembersMap);
          console.log('All posts before filter (is_organizer values):', allPostsBeforeFilter.slice(0, 10).map((p: any) => ({ 
            id: p.id, 
            author_user_id: p.author_user_id,
            is_organizer: p.is_organizer 
          })));
        }
      } else if (filterType === 'attendee_only') {
        const beforeCount = enrichedItems.length;
        // Log all posts before filtering to debug
        console.log('📋 All posts before attendee_only filter:', enrichedItems.map((p: any) => ({
          id: p.id,
          author_user_id: p.author_user_id,
          is_organizer: p.is_organizer,
          event_id: p.event_id
        })));
        
        enrichedItems = enrichedItems.filter((item: any) => {
          const isAttendee = !item.is_organizer;
          if (!isAttendee) {
            console.log(`🚫 Filtering out organizer post ${item.id}:`, {
              author_user_id: item.author_user_id,
              is_organizer: item.is_organizer
            });
          }
          return isAttendee;
        });
        
        console.log(`🔍 attendee_only filter: ${beforeCount} → ${enrichedItems.length} posts`);
        if (enrichedItems.length > 0) {
          console.log('✅ Sample attendee post:', { 
            id: enrichedItems[0].id, 
            is_organizer: enrichedItems[0].is_organizer,
            author_user_id: enrichedItems[0].author_user_id
          });
        } else {
          console.log('❌ No attendee posts found after filter');
          // Log all posts before filtering to see why they were filtered
          const allPostsBeforeFilter = await enrichPosts(enrichedWithRelations, currentUserId, supabaseClient, orgMembersMap);
          console.log('All posts before filter (is_organizer values):', allPostsBeforeFilter.slice(0, 10).map((p: any) => ({ 
            id: p.id, 
            author_user_id: p.author_user_id,
            is_organizer: p.is_organizer 
          })));
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
      // Legacy path: still supported (offset-based pagination)
      const safeLimit = Math.min(Number(limit), 50);
      const safePage = Math.max(Number(page ?? 1), 1);
      const offset = (safePage - 1) * safeLimit;

      // Try with post_as columns first, fallback if they don't exist (backward compatibility)
      let posts: any = null;
      let postsError: any = null;
      
      try {
        let postsQuery = buildPostsQuery(true);
        if (mentionedPostIds.length > 0) {
          postsQuery = postsQuery.in('id', mentionedPostIds);
        }

        const result = await postsQuery
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + safeLimit - 1);
        
        posts = result.data;
        postsError = result.error;
      } catch (err: any) {
        postsError = err;
        console.log('⚠️ [Offset] Exception caught in posts query:', err);
      }

      // If error is "column does not exist", retry without post_as columns
      if (postsError) {
        const errorMessage = postsError?.message || postsError?.details || String(postsError || '');
        const errorString = JSON.stringify(postsError);
        const isColumnError = errorMessage.includes('post_as_context_type') || 
                             errorMessage.includes('does not exist') || 
                             (errorMessage.includes('column') && errorMessage.includes('not exist')) ||
                             errorString.includes('post_as_context_type');
        
        if (isColumnError) {
          console.log('⚠️ [Offset] post_as columns not found, retrying without them...', { errorMessage, errorString });
          try {
            let postsQuery = buildPostsQuery(false);
            if (mentionedPostIds.length > 0) {
              postsQuery = postsQuery.in('id', mentionedPostIds);
            }
            const retryResult = await postsQuery
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(offset, offset + safeLimit - 1);
            posts = retryResult.data;
            postsError = retryResult.error;
          } catch (retryErr: any) {
            console.error('❌ [Offset] Retry also failed:', retryErr);
            postsError = retryErr;
          }
        }
      }

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return createErrorResponse(postsError.message, 500);
      }

      // Ensure posts have post_as fields (set to null if migration hasn't been applied)
      const postsWithDefaults = (posts || []).map((p: any) => ({
        ...p,
        post_as_context_type: p.post_as_context_type || null,
        post_as_context_id: p.post_as_context_id || null,
      }));

      if (!postsWithDefaults || postsWithDefaults.length === 0) {
        return createResponse({ data: [] });
      }
      
      // Fetch related data using admin client (already created earlier)
      const authorIds = [...new Set(postsWithDefaults.map((p: any) => p.author_user_id).filter(Boolean))];
      const eventIds = [...new Set(postsWithDefaults.map((p: any) => p.event_id).filter(Boolean))];
      const tierIds = [...new Set(postsWithDefaults.map((p: any) => p.ticket_tier_id).filter(Boolean))];

      const [authorsRes, eventsRes, tiersRes] = await Promise.all([
        authorIds.length ? adminClient.from('user_profiles').select('user_id, display_name, photo_url, username').in('user_id', authorIds) : { data: [] },
        eventIds.length ? adminClient.from('events').select('id, title, owner_context_type, owner_context_id, created_by, start_at, visibility').in('id', eventIds) : { data: [] },
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
      
      // ✅ Filter posts: Only exclude posts from deleted events or private events (unless authenticated)
      const postsAfterVisibility = postsWithDefaults.filter((p: any) => {
        const event = eventsMap.get(p.event_id);
        
        // If no event data, include the post (edge case protection)
        if (!event) {
          console.log(`⚠️ [Offset] Post ${p.id}: No event data found, including post`);
          return true;
        }
        
        // Public/unlisted events: show to everyone
        if (event.visibility === 'public' || event.visibility === 'unlisted') {
          return true;
        }
        
        // Private events: only show if user is authenticated
        if (event.visibility === 'private') {
          return !!currentUserId;
        }
        
        // Default: exclude if visibility is unknown
        return false;
      });
      
      console.log(`🔒 [Offset] Visibility filter: ${postsWithDefaults.length} → ${postsAfterVisibility.length} posts`);
      
      if (postsAfterVisibility.length === 0) {
        return createResponse({ data: [] });
      }
      
      // Fetch organization memberships for org-owned events
      const orgIds = [...new Set(
        (eventsRes.data || [])
          .filter((e: any) => e.owner_context_type === 'organization' && e.owner_context_id)
          .map((e: any) => e.owner_context_id)
      )];

      // Fetch post_as_context_id values to get organization IDs for posts posted "as" org
      const postAsOrgIds = [...new Set(
        (postsAfterVisibility || [])
          .filter((p: any) => p.post_as_context_type === 'organization' && p.post_as_context_id)
          .map((p: any) => p.post_as_context_id)
          .filter(Boolean)
      )];

      // Combine all org IDs (event owners + post_as orgs)
      const allOrgIds = [...new Set([...orgIds, ...postAsOrgIds])];
      
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

      // Fetch organization details for posts posted "as" organization
      const orgDetailsMap = new Map<string, { id: string; name: string; logo_url: string | null }>();
      if (allOrgIds.length > 0) {
        const { data: orgsData, error: orgsError } = await adminClient
          .from('organizations')
          .select('id, name, logo_url')
          .in('id', allOrgIds);

        if (orgsError) {
          console.error('❌ [Offset] Error fetching org details:', orgsError);
        } else if (orgsData) {
          orgsData.forEach((org: any) => {
            orgDetailsMap.set(org.id, {
              id: org.id,
              name: org.name,
              logo_url: org.logo_url
            });
          });
          console.log(`📊 [Offset] Fetched ${orgsData.length} organization details for post_as display`);
        }
      }

      // Enrich posts (use filtered posts)
      const enrichedWithRelations = postsAfterVisibility.map((post: any) => {
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
      let enrichedItems = await enrichPosts(enrichedWithRelations, currentUserId, supabaseClient, orgMembersMap, orgDetailsMap);

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
