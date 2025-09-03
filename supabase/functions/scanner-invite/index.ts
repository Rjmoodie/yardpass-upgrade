import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteRequest {
  event_id: string;
  user_email: string;
}

interface InviteResponse {
  success: boolean;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the session/user data
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { event_id, user_email }: InviteRequest = await req.json()

    if (!event_id || !user_email) {
      return new Response(
        JSON.stringify({ error: 'Missing event_id or user_email' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Inviting scanner ${user_email} for event ${event_id}`)

    // Check if user is authorized (event manager)
    const { data: isManager } = await supabaseClient
      .rpc('is_event_manager', { p_event_id: event_id })

    if (!isManager) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to manage scanners for this event' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Find the user by email
    const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userError) {
      console.error('Error listing users:', userError)
      return new Response(
        JSON.stringify({ error: 'Failed to find user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const foundUser = targetUser.users.find(u => u.email === user_email)
    
    if (!foundUser) {
      const response: InviteResponse = {
        success: false,
        message: 'User not found. They need to sign up first.'
      }
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert scanner invitation
    const { error: scannerError } = await supabaseAdmin
      .from('event_scanners')
      .upsert({
        event_id,
        user_id: foundUser.id,
        status: 'enabled',
        invited_by: user.id
      }, {
        onConflict: 'event_id,user_id'
      })

    if (scannerError) {
      console.error('Error inviting scanner:', scannerError)
      return new Response(
        JSON.stringify({ error: 'Failed to invite scanner' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const response: InviteResponse = {
      success: true,
      message: `Successfully invited ${user_email} as a scanner`
    }

    console.log(`Scanner invited successfully: ${user_email}`)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in scanner-invite:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})