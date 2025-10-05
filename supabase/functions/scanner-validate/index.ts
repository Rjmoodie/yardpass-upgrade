// /functions/scanner-validate/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

type Outcome =
  | 'valid'
  | 'duplicate'
  | 'expired'
  | 'invalid'
  | 'wrong_event'
  | 'refunded'
  | 'void'

interface ValidateResponse {
  success: boolean
  result: Outcome
  ticket?: {
    id: string
    tier_name: string
    attendee_name: string
    badge_label?: string
  }
  message?: string
  timestamp?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: jsonHeaders })

const QR_RE = /^[A-HJ-NP-Z2-9]{8}$/ // your DB check constraint

async function safeJson<T = any>(req: Request): Promise<T | null> {
  try { return await req.json() } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Admin client (server-side privileges) for DB reads/writes
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authed client tied to the caller (to identify user + apply any RPC RLS)
    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    // Who is scanning?
    const { data: auth, error: userErr } = await client.auth.getUser()
    const user = auth?.user
    if (userErr || !user) {
      // Return quiet "not authorized" instead of 401 to avoid retry storms in the scanner UI
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Not signed in' })
    }

    // Accept GET (?event_id=&qr_token=) or POST {event_id, qr_token}
    const url = new URL(req.url)
    const qsEventId = url.searchParams.get('event_id')?.trim()
    const qsToken = url.searchParams.get('qr_token')?.trim()
    const body = req.method === 'GET' ? null : await safeJson<{ event_id?: string; qr_token?: string }>(req)
    const event_id = (body?.event_id ?? qsEventId ?? '').trim()
    const qr_token_raw = (body?.qr_token ?? qsToken ?? '').trim()

    if (!event_id || !qr_token_raw) {
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Missing event or code' })
    }

    // Normalize + validate QR format (matches your DB CHECK)
    const qr_token = qr_token_raw.toUpperCase()
    if (!QR_RE.test(qr_token)) {
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid code format' })
    }

    // --- Authorization (same policy as scanner-authorize) ---
    // 1) Organizer/editor?
    const { data: isMgr, error: mgrErr } = await client.rpc('is_event_manager', { p_event_id: event_id })
    if (mgrErr) console.warn('[scanner-validate] is_event_manager RPC error:', mgrErr?.message)

    let allowed = isMgr === true
    if (!allowed) {
      // 2) Explicit scanner assignment for this event?
      const { data: scannerRow, error: scanErr } = await client
        .from('event_scanners').select('status')
        .eq('event_id', event_id).eq('user_id', user.id).eq('status', 'enabled').maybeSingle()
      if (scanErr) console.warn('[scanner-validate] event_scanners error:', scanErr?.message)
      allowed = !!scannerRow
    }
    if (!allowed) {
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Not authorized for this event' })
    }

    // --- Lookup ticket by code ---
    const { data: ticket, error: tErr } = await admin
      .from('tickets')
      .select('id, event_id, status, redeemed_at, owner_user_id, tier_id')
      .eq('qr_code', qr_token)
      .maybeSingle()

    if (tErr || !ticket) {
      // Log and return "invalid"
      await admin.from('scan_logs').insert({
        event_id, scanner_user_id: user.id, result: 'invalid',
        details: { qr_token, error: tErr ? 'db_lookup_error' : 'ticket_not_found' }
      })
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid ticket' })
    }

    // Wrong event?
    if (ticket.event_id !== event_id) {
      await admin.from('scan_logs').insert({
        event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'wrong_event',
        details: { qr_token, actual_event_id: ticket.event_id }
      })
      return ok(<ValidateResponse>{ success: false, result: 'wrong_event', message: 'Ticket is for a different event' })
    }

    // Refunded / void?
    if (ticket.status === 'refunded') {
      await admin.from('scan_logs').insert({ event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'refunded', details: { qr_token } })
      return ok(<ValidateResponse>{ success: false, result: 'refunded', message: 'Ticket has been refunded' })
    }
    if (ticket.status === 'void') {
      await admin.from('scan_logs').insert({ event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'void', details: { qr_token } })
      return ok(<ValidateResponse>{ success: false, result: 'void', message: 'Ticket is void' })
    }

    // Event ended?
    const { data: evt, error: evtErr } = await admin.from('events').select('end_at').eq('id', event_id).single()
    if (!evtErr && evt?.end_at && new Date(evt.end_at).getTime() < Date.now()) {
      await admin.from('scan_logs').insert({
        event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'expired',
        details: { qr_token, event_end: evt.end_at }
      })
      return ok(<ValidateResponse>{ success: false, result: 'expired', message: 'Event has ended' })
    }

    // --- Atomic redemption (prevents double-scan races) ---
    // Only redeem if not already redeemed.
    const now = new Date().toISOString()
    const { data: redeemedRow, error: updErr } = await admin
      .from('tickets')
      .update({ redeemed_at: now, status: 'redeemed' })
      .eq('id', ticket.id)
      .is('redeemed_at', null)               // <-- atomic guard
      .select('id, redeemed_at')
      .maybeSingle()

    if (updErr) {
      console.error('[scanner-validate] update error:', updErr)
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Could not update ticket' })
    }

    // Fetch presentation data (safe to do after)
    const [{ data: tier }, { data: profile }] = await Promise.all([
      admin.from('ticket_tiers').select('name, badge_label').eq('id', ticket.tier_id).maybeSingle(),
      ticket.owner_user_id
        ? admin.from('user_profiles').select('display_name').eq('user_id', ticket.owner_user_id).maybeSingle()
        : Promise.resolve({ data: null as any }),
    ])

    const ticketInfo = {
      id: ticket.id,
      tier_name: tier?.name ?? '',
      attendee_name: profile?.display_name ?? '',
      badge_label: tier?.badge_label ?? undefined,
    }

    if (!redeemedRow) {
      // Someone else redeemed first → treat as duplicate; get current redeemed_at
      const { data: fresh } = await admin
        .from('tickets')
        .select('redeemed_at')
        .eq('id', ticket.id)
        .single()

      const ts = fresh?.redeemed_at ?? ticket.redeemed_at ?? now
      await admin.from('scan_logs').insert({
        event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'duplicate',
        details: { qr_token, original_redeemed_at: ts }
      })

      return ok(<ValidateResponse>{
        success: false,
        result: 'duplicate',
        message: `Already scanned at ${new Date(ts).toLocaleString()}`,
        timestamp: ts,
        ticket: ticketInfo,
      })
    }

    // Success
    await admin.from('scan_logs').insert({
      event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'valid',
      details: { qr_token, redeemed_at: now }
    })

    return ok(<ValidateResponse>{
      success: true,
      result: 'valid',
      message: 'Ticket validated',
      ticket: ticketInfo,
      timestamp: now,
    })
  } catch (e: any) {
    console.error('[scanner-validate] fatal error:', e?.message || e)
    // Keep it quiet to the UI; return a soft failure instead of 500
    return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Unexpected error' })
  }
})
