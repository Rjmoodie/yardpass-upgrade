import { corsHeaders } from '../_shared/cors.ts';

interface CommentRequest {
  post_id: string;
  text: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { post_id, text }: CommentRequest = await req.json();

    if (!post_id || !text?.trim()) {
      return new Response(
        JSON.stringify({ error: 'post_id and text are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with user context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert comment with optimistic response
    const { data: comment, error: insertError } = await supabaseClient
      .from('event_comments')
      .insert({
        post_id,
        author_user_id: user.id,
        text: text.trim()
      })
      .select('id, text, created_at')
      .single();

    if (insertError) {
      console.error('Comment insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get updated comment count
    const { data: postData, error: countError } = await supabaseClient
      .from('event_posts')
      .select('comment_count')
      .eq('id', post_id)
      .single();

    if (countError) {
      console.error('Comment count error:', countError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        comment: {
          ...comment,
          author_name: user.user_metadata?.display_name || 'User'
        },
        comment_count: postData?.comment_count || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Comment submission error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Import after the serve function to avoid issues
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';