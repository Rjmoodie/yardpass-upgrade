import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateRequest {
  event_id: string;
  qr_token: string;
}

interface ValidateResponse {
  success: boolean;
  result: 'valid' | 'duplicate' | 'expired' | 'invalid' | 'wrong_event' | 'refunded' | 'void';
  ticket?: {
    id: string;
    tier_name: string;
    attendee_name: string;
    badge_label?: string;
  };
  message: string;
  timestamp?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for database writes
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use anon key to check user auth
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

    const { event_id, qr_token }: ValidateRequest = await req.json()

    if (!event_id || !qr_token) {
      return new Response(
        JSON.stringify({ error: 'Missing event_id or qr_token' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Validating ticket ${qr_token} for event ${event_id}`)

    // First verify the user is authorized to scan for this event
    const { data: isManager } = await supabaseClient
      .rpc('is_event_manager', { p_event_id: event_id })

    const { data: scannerData } = await supabaseClient
      .from('event_scanners')
      .select('status')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .eq('status', 'enabled')
      .maybeSingle()

    if (!isManager && !scannerData) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to scan for this event' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Find the ticket by QR code
    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(`
        id,
        event_id,
        status,
        redeemed_at,
        owner_user_id,
        tier_id,
        ticket_tiers!inner(name, badge_label),
        user_profiles!inner(display_name)
      `)
      .eq('qr_code', qr_token)
      .maybeSingle()

    if (ticketError) {
      console.error('Error finding ticket:', ticketError)
      const response: ValidateResponse = {
        success: false,
        result: 'invalid',
        message: 'Invalid ticket code'
      }
      
      // Log the scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        scanner_user_id: user.id,
        result: 'invalid',
        details: { qr_token, error: 'ticket_not_found' }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ticketData) {
      const response: ValidateResponse = {
        success: false,
        result: 'invalid',
        message: 'Ticket not found'
      }
      
      // Log the scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        scanner_user_id: user.id,
        result: 'invalid',
        details: { qr_token, error: 'ticket_not_found' }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if ticket belongs to this event
    if (ticketData.event_id !== event_id) {
      const response: ValidateResponse = {
        success: false,
        result: 'wrong_event',
        message: 'This ticket is for a different event'
      }
      
      // Log the scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        ticket_id: ticketData.id,
        scanner_user_id: user.id,
        result: 'wrong_event',
        details: { qr_token, actual_event_id: ticketData.event_id }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check ticket status
    if (ticketData.status === 'refunded') {
      const response: ValidateResponse = {
        success: false,
        result: 'refunded',
        message: 'This ticket has been refunded'
      }
      
      // Log the scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        ticket_id: ticketData.id,
        scanner_user_id: user.id,
        result: 'refunded',
        details: { qr_token }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (ticketData.status === 'void') {
      const response: ValidateResponse = {
        success: false,
        result: 'void',
        message: 'This ticket is void'
      }
      
      // Log the scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        ticket_id: ticketData.id,
        scanner_user_id: user.id,
        result: 'void',
        details: { qr_token }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if already redeemed
    if (ticketData.redeemed_at) {
      const response: ValidateResponse = {
        success: false,
        result: 'duplicate',
        message: `Already scanned at ${new Date(ticketData.redeemed_at).toLocaleString()}`,
        timestamp: ticketData.redeemed_at,
        ticket: {
          id: ticketData.id,
          tier_name: ticketData.ticket_tiers.name,
          attendee_name: ticketData.user_profiles.display_name,
          badge_label: ticketData.ticket_tiers.badge_label
        }
      }
      
      // Log the duplicate scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        ticket_id: ticketData.id,
        scanner_user_id: user.id,
        result: 'duplicate',
        details: { qr_token, original_redeemed_at: ticketData.redeemed_at }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get event details to check if expired
    const { data: eventData } = await supabaseAdmin
      .from('events')
      .select('end_at')
      .eq('id', event_id)
      .single()

    if (eventData && new Date(eventData.end_at) < new Date()) {
      const response: ValidateResponse = {
        success: false,
        result: 'expired',
        message: 'Event has ended'
      }
      
      // Log the expired scan attempt
      await supabaseAdmin.from('scan_logs').insert({
        event_id,
        ticket_id: ticketData.id,
        scanner_user_id: user.id,
        result: 'expired',
        details: { qr_token, event_end: eventData.end_at }
      })

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Valid ticket - mark as redeemed
    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ 
        redeemed_at: now,
        status: 'redeemed'
      })
      .eq('id', ticketData.id)

    if (updateError) {
      console.error('Error updating ticket:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update ticket' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Log successful scan
    await supabaseAdmin.from('scan_logs').insert({
      event_id,
      ticket_id: ticketData.id,
      scanner_user_id: user.id,
      result: 'valid',
      details: { qr_token, redeemed_at: now }
    })

    const response: ValidateResponse = {
      success: true,
      result: 'valid',
      message: 'Ticket validated successfully',
      ticket: {
        id: ticketData.id,
        tier_name: ticketData.ticket_tiers.name,
        attendee_name: ticketData.user_profiles.display_name,
        badge_label: ticketData.ticket_tiers.badge_label
      },
      timestamp: now
    }

    console.log('Ticket validated successfully:', ticketData.id)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in scanner-validate:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})