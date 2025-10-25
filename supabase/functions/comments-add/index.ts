// functions/comments-post/index.ts
// Edge Function: Create a comment on an event post
// Requires RLS to be enabled on tables and a 'can_current_user_post(event_id)' RPC to gate posting.

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CommentRequest {
  post_id: string;
  text: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Basic guard against absurd payload sizes and control chars */
function sanitizeText(input: string): string {
  // Remove non-printable control chars (except newline/tab), collapse whitespace, trim
  return input
    .replace(/[^\P{C}\t\n\r]+/gu, '')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, ...JSON_HEADERS, 'Allow': 'POST, OPTIONS' },
    });
  }

  let body: CommentRequest | null = null;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, ...JSON_HEADERS },
    });
  }

  try {
    const { post_id, text } = body ?? ({} as CommentRequest);

    // Validate inputs
    if (!post_id || typeof post_id !== 'string') {
      return new Response(JSON.stringify({ error: 'post_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }
    if (typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }

    const cleaned = sanitizeText(text);
    if (!cleaned) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }
    if (cleaned.length > 2000) {
      return new Response(JSON.stringify({ error: 'text too long (max 2000 chars)' }), {
        status: 400,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }

    // Supabase client w/ user context (RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    // Current user
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }
    const user = userRes.user;

    // Ensure post exists and is not soft-deleted
    const { data: post, error: postErr } = await supabase
      .from('event_posts')
      .select('id, event_id, deleted_at')
      .eq('id', post_id)
      .single();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }
    if (post.deleted_at) {
      return new Response(JSON.stringify({ error: 'Post is deleted' }), {
        status: 410,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }

    // Permission check via RPC (RLS-safe)
    const { data: canPost, error: permErr } = await supabase
      .rpc('can_current_user_post', { p_event_id: post.event_id });

    if (permErr) {
      console.error('Permission check failed:', permErr);
      return new Response(JSON.stringify({ error: 'Unable to verify permission to comment' }), {
        status: 403,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }
    if (!canPost) {
      return new Response(JSON.stringify({ error: 'Not allowed to comment on this event' }), {
        status: 403,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }

    // Insert comment
    const { data: comment, error: insertErr } = await supabase
      .from('event_comments')
      .insert({
        post_id,
        author_user_id: user.id,
        text: cleaned,
      })
      .select('id, text, created_at, author_user_id')
      .single();

    if (insertErr) {
      console.error('Comment insert error:', insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, ...JSON_HEADERS },
      });
    }

    // Database triggers automatically update comment_count, just fetch the updated count
    const { data: countRow } = await supabase
      .from('event_posts')
      .select('comment_count')
      .eq('id', post_id)
      .single();

    // Enrich author (display name + photo)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, photo_url')
      .eq('user_id', user.id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        comment: {
          id: comment.id,
          text: comment.text,
          created_at: comment.created_at,
          author_user_id: comment.author_user_id,
          author_name: profile?.display_name || user.user_metadata?.display_name || 'User',
          author_photo_url: profile?.photo_url || null,
        },
        comment_count: countRow?.comment_count ?? null,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, ...JSON_HEADERS, 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    console.error('Comment submission error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, ...JSON_HEADERS },
    });
  }
});
