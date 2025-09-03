import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuthorizeRequest {
  event_id: string;
}

interface AuthorizeResponse {
  allowed: boolean;
  role: 'owner' | 'editor' | 'scanner' | 'none';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { event_id }: AuthorizeRequest = await req.json()

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: 'Missing event_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Checking authorization for user ${user.id} on event ${event_id}`)

    // Check if user is event manager (owner/editor)
    const { data: isManager } = await supabaseClient
      .rpc('is_event_manager', { p_event_id: event_id })

    if (isManager) {
      console.log('User is event manager')
      const response: AuthorizeResponse = { allowed: true, role: 'owner' }
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is an enabled scanner for this event
    const { data: scannerData, error: scannerError } = await supabaseClient
      .from('event_scanners')
      .select('status')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .eq('status', 'enabled')
      .maybeSingle()

    if (scannerError) {
      console.error('Error checking scanner status:', scannerError)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (scannerData) {
      console.log('User is enabled scanner')
      const response: AuthorizeResponse = { allowed: true, role: 'scanner' }
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User has no access')
    const response: AuthorizeResponse = { allowed: false, role: 'none' }
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in scanner-authorize:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})