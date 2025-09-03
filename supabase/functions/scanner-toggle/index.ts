import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ToggleRequest {
  event_id: string;
  user_id: string;
  status: 'enabled' | 'disabled';
}

interface ToggleResponse {
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

    const { event_id, user_id, status }: ToggleRequest = await req.json()

    if (!event_id || !user_id || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing event_id, user_id, or status' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!['enabled', 'disabled'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Status must be enabled or disabled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Toggling scanner ${user_id} to ${status} for event ${event_id}`)

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

    // Update scanner status
    const { error: updateError } = await supabaseAdmin
      .from('event_scanners')
      .update({ status })
      .eq('event_id', event_id)
      .eq('user_id', user_id)

    if (updateError) {
      console.error('Error updating scanner status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update scanner status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const response: ToggleResponse = {
      success: true,
      message: `Scanner ${status} successfully`
    }

    console.log(`Scanner status updated: ${user_id} -> ${status}`)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in scanner-toggle:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})