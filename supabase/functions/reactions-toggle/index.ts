import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface ToggleReactionRequest {
  post_id: string;
  kind?: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Reactions-toggle function called');
    
    const { post_id, kind = 'like' }: ToggleReactionRequest = await req.json();
    
    if (!post_id || kind !== 'like') {
      return createErrorResponse("post_id and kind='like' required", 400);
    }

    // Create Supabase client for user operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    const user_id = user.id;

    // 1) Check if like exists
    const { data: existing } = await supabaseClient
      .from('event_reactions')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', user_id)
      .eq('kind', 'like')
      .maybeSingle();

    console.log('Current like state for user', user_id, 'on post', post_id, ':', existing ? 'LIKED' : 'NOT_LIKED');

    if (existing) {
      // UNLIKE - delete by ID to be precise
      const { error: delErr } = await supabaseClient
        .from('event_reactions')
        .delete()
        .eq('id', existing.id);
      if (delErr) throw delErr;
      console.log(`✅ UNLIKED: Removed like for post ${post_id} by user ${user_id}`);
    } else {
      // LIKE - conflict-safe insert (unique index will prevent duplicates)
      const { error: insErr } = await supabaseClient
        .from('event_reactions')
        .insert({ post_id, user_id, kind: 'like' });
      // Ignore duplicate constraint violations (23505) under race conditions
      if (insErr && (insErr as any).code !== '23505') throw insErr;
      console.log(`✅ LIKED: Added like for post ${post_id} by user ${user_id}`);
    }

    // 2) Get exact like count from database
    const { count, error: cntErr } = await supabaseClient
      .from('event_reactions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post_id)
      .eq('kind', 'like');

    if (cntErr) throw cntErr;

    // 3) Check current liked state
    const { data: nowLiked } = await supabaseClient
      .from('event_reactions')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', user_id)
      .eq('kind', 'like')
      .maybeSingle();

    console.log(`Final state - liked: ${Boolean(nowLiked)}, count: ${count ?? 0}`);

    return createResponse({
      liked: Boolean(nowLiked),
      like_count: count ?? 0
    });

  } catch (error) {
    console.error('Error in reactions-toggle function:', error);
    return createErrorResponse((error as any)?.message || 'Unknown error', 500);
  }
});