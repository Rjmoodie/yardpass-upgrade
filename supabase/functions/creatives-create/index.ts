import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Creatives-create function called')
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id)

    // Parse the request body
    const body = await req.json()
    const {
      campaign_id,
      headline,
      body_text,
      cta_label,
      cta_url,
      media_type,
      media_url,
      post_id,
      poster_url,
      active,
    } = body

    console.log('Creative data:', { campaign_id, headline, media_type, post_id })

    // Validate required fields
    if (!campaign_id || !headline || !media_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: campaign_id, headline, media_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user has access to this campaign's organization
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('campaigns')
      .select('org_id, organizations!inner(*)')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError)
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Campaign found:', campaign.org_id)

    // Check if user is a member of the organization with appropriate role
    const { data: membership, error: membershipError } = await supabaseClient
      .from('org_memberships')
      .select('role')
      .eq('org_id', campaign.org_id)
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin', 'editor'])
      .single()

    if (membershipError || !membership) {
      console.error('User not authorized for this organization:', membershipError)
      return new Response(
        JSON.stringify({ error: 'Not authorized to create creatives for this campaign' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authorized with role:', membership.role)

    // Validate media_type
    if (!['image', 'video', 'existing_post'].includes(media_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid media_type. Must be image, video, or existing_post' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If using existing_post, verify the post exists
    if (media_type === 'existing_post') {
      if (!post_id) {
        return new Response(
          JSON.stringify({ error: 'post_id is required when media_type is existing_post' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: post, error: postError } = await supabaseClient
        .from('event_posts')
        .select('id, media_urls')
        .eq('id', post_id)
        .single()

      if (postError || !post) {
        console.error('Post not found:', postError)
        return new Response(
          JSON.stringify({ error: 'Post not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Post found:', post.id)
    }

    // Create the creative
    const { data: creative, error: createError } = await supabaseClient
      .from('ad_creatives')
      .insert({
        campaign_id,
        headline: headline.trim(),
        body_text: body_text ? body_text.trim() : null,
        cta_label: cta_label || 'Learn More',
        cta_url: cta_url ? cta_url.trim() : null,
        media_type,
        media_url: media_url || null,
        post_id: post_id || null,
        poster_url: poster_url || null,
        active: active !== undefined ? active : true,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating creative:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creative created successfully:', creative.id)

    return new Response(
      JSON.stringify({ success: true, creative }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Unexpected error in creatives-create:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

