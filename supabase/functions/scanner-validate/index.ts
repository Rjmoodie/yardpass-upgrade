// /functions/scanner-validate/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { checkRateLimit, RateLimitResult } from '../_shared/rate-limiter.ts'

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
const SIGNED_QR_RE = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const TOKEN_CLOCK_SKEW_SECONDS = 5
const TOKEN_OLD_THRESHOLD_SECONDS = 300 // 5 minutes - soft anomaly signal
const TOKEN_VERY_OLD_THRESHOLD_SECONDS = 7200 // 2 hours - hard reject threshold
const TOKEN_FUTURE_THRESHOLD_SECONDS = 300 // 5 minutes - clock skew protection

// Rate limiting configuration (configurable via env vars)
const SCANNER_RATE_LIMIT_PER_MINUTE = parseInt(Deno.env.get('SCANNER_RATE_LIMIT_PER_MINUTE') || '10', 10)
const SCANNER_RATE_LIMIT_EVENT_PER_MINUTE = parseInt(Deno.env.get('SCANNER_RATE_LIMIT_EVENT_PER_MINUTE') || '200', 10)

const encoder = new TextEncoder()

const signingSecret = Deno.env.get('TICKET_QR_SIGNING_SECRET') ?? ''
let verifyKeyPromise: Promise<CryptoKey> | null = null

interface TicketTokenPayload {
  v: string
  tid: string
  eid: string
  code: string
  iat: number
  exp: number
}

async function getVerifyKey(): Promise<CryptoKey> {
  if (!signingSecret) {
    throw new Error('TICKET_QR_SIGNING_SECRET env var is not configured')
  }
  if (!verifyKeyPromise) {
    verifyKeyPromise = crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
  }
  return verifyKeyPromise
}

function base64UrlToUint8Array(input: string): Uint8Array {
  let normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  if (pad) {
    normalized += '='.repeat(4 - pad)
  }
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

type TokenVerificationResult =
  | { status: 'ok'; payload: TicketTokenPayload }
  | { status: 'expired'; payload: TicketTokenPayload }
  | { status: 'invalid'; reason: string }

async function verifySignedTicketToken(token: string): Promise<TokenVerificationResult> {
  if (!SIGNED_QR_RE.test(token)) {
    return { status: 'invalid', reason: 'format' }
  }

  if (!signingSecret) {
    console.error('[scanner-validate] token received but no signing secret configured')
    return { status: 'invalid', reason: 'server_misconfigured' }
  }

  const [version, payloadBase64, signatureBase64] = token.split('.')
  if (version !== 'v1' || !payloadBase64 || !signatureBase64) {
    return { status: 'invalid', reason: 'version' }
  }

  try {
    const key = await getVerifyKey()
    const signatureBytes = base64UrlToUint8Array(signatureBase64)
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payloadBase64))
    if (!valid) {
      return { status: 'invalid', reason: 'signature' }
    }

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadBase64))
    const payload = JSON.parse(payloadJson) as TicketTokenPayload

    if (!payload?.tid || !payload?.eid || !payload?.code) {
      return { status: 'invalid', reason: 'payload_shape' }
    }

    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && payload.exp + TOKEN_CLOCK_SKEW_SECONDS < now) {
      return { status: 'expired', payload }
    }

    return { status: 'ok', payload }
  } catch (error) {
    console.error('[scanner-validate] failed to verify token', error)
    return { status: 'invalid', reason: 'exception' }
  }
}

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
    let qr_token = qr_token_raw.trim()
    let tokenPayload: TicketTokenPayload | null = null

    if (SIGNED_QR_RE.test(qr_token)) {
      const verification = await verifySignedTicketToken(qr_token)
      if (verification.status === 'expired') {
        await admin.from('scan_logs').insert({
          event_id,
          scanner_user_id: user.id,
          result: 'expired',
          details: { qr_token: verification.payload.code ?? 'signed', reason: 'token_expired' },
        })
        return ok(<ValidateResponse>{ success: false, result: 'expired', message: 'QR code has expired' })
      }
      if (verification.status === 'invalid') {
        await admin.from('scan_logs').insert({
          event_id,
          scanner_user_id: user.id,
          result: 'invalid',
          details: { qr_token: 'signed', reason: verification.reason },
        })
        return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid code' })
      }

      tokenPayload = verification.payload
      qr_token = tokenPayload.code ? tokenPayload.code.toUpperCase() : ''

      // --- Timestamp Replay Detection (Step 2) ---
      const nowSeconds = Math.floor(Date.now() / 1000)
      const iatAgeSeconds = nowSeconds - tokenPayload.iat
      const eventEndTime = await admin.from('events').select('end_at').eq('id', event_id).maybeSingle()

      // Hard reject: Future tokens (clock skew) or very old tokens after event end
      if (tokenPayload.iat > nowSeconds + TOKEN_FUTURE_THRESHOLD_SECONDS) {
        await admin.from('scan_logs').insert({
          event_id,
          scanner_user_id: user.id,
          result: 'invalid',
          details: {
            qr_token: 'signed',
            reason: 'future_token',
            iat_age_seconds: iatAgeSeconds,
            iat: tokenPayload.iat,
            now: nowSeconds,
          },
        })
        return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid code' })
      }

      // Hard reject: Very old tokens (>2 hours) AND event has ended
      const eventEnded = eventEndTime?.data?.end_at && new Date(eventEndTime.data.end_at).getTime() < Date.now()
      if (iatAgeSeconds > TOKEN_VERY_OLD_THRESHOLD_SECONDS && eventEnded) {
        await admin.from('scan_logs').insert({
          event_id,
          scanner_user_id: user.id,
          result: 'expired',
          details: {
            qr_token: 'signed',
            reason: 'very_old_token_after_event_end',
            iat_age_seconds: iatAgeSeconds,
          },
        })
        return ok(<ValidateResponse>{ success: false, result: 'expired', message: 'QR code has expired' })
      }
      // Note: Soft anomaly logging happens later after ticket lookup
    } else {
      qr_token = qr_token.toUpperCase()
      if (!QR_RE.test(qr_token)) {
        return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid code format' })
      }
    }

    if (!qr_token) {
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid code' })
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

    // --- Step 3: Rate Limiting ---
    // Check per-scanner rate limit
    const scannerRateLimitKey = `scanner:${event_id}:${user.id}`
    const scannerRateLimit = await checkRateLimit(
      admin,
      scannerRateLimitKey,
      SCANNER_RATE_LIMIT_PER_MINUTE,
      60 // 1 minute window
    )

    if (!scannerRateLimit.allowed) {
      await admin.from('scan_logs').insert({
        event_id,
        scanner_user_id: user.id,
        result: 'invalid',
        details: {
          reason: 'rate_limit_exceeded',
          rate_limit_type: 'per_scanner',
          limit: scannerRateLimit.limit,
          reset_at: scannerRateLimit.resetAt.toISOString(),
        },
      })
      return ok(<ValidateResponse>{
        success: false,
        result: 'invalid',
        message: `Rate limit exceeded. Maximum ${scannerRateLimit.limit} scans per minute. Try again in ${Math.ceil((scannerRateLimit.resetAt.getTime() - Date.now()) / 1000)} seconds.`,
      })
    }

    // Check per-event global rate limit
    const eventRateLimitKey = `scanner:event:${event_id}`
    const eventRateLimit = await checkRateLimit(
      admin,
      eventRateLimitKey,
      SCANNER_RATE_LIMIT_EVENT_PER_MINUTE,
      60 // 1 minute window
    )

    if (!eventRateLimit.allowed) {
      await admin.from('scan_logs').insert({
        event_id,
        scanner_user_id: user.id,
        result: 'invalid',
        details: {
          reason: 'rate_limit_exceeded',
          rate_limit_type: 'per_event',
          limit: eventRateLimit.limit,
          reset_at: eventRateLimit.resetAt.toISOString(),
        },
      })
      return ok(<ValidateResponse>{
        success: false,
        result: 'invalid',
        message: `Event scan rate limit exceeded. Maximum ${eventRateLimit.limit} scans per minute for this event.`,
      })
    }

    // --- Lookup ticket by code ---
    let ticketQuery = admin
      .from('tickets')
      .select('id, event_id, status, redeemed_at, owner_user_id, tier_id, qr_code')

    if (tokenPayload?.tid) {
      ticketQuery = ticketQuery.eq('id', tokenPayload.tid)
    } else {
      ticketQuery = ticketQuery.eq('qr_code', qr_token)
    }

    const { data: ticket, error: tErr } = await ticketQuery.maybeSingle()

    if (tErr || !ticket) {
      // Log and return "invalid"
      await admin.from('scan_logs').insert({
        event_id, scanner_user_id: user.id, result: 'invalid',
        details: { qr_token, error: tErr ? 'db_lookup_error' : 'ticket_not_found' }
      })
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid ticket' })
    }

    if (tokenPayload && ticket.qr_code !== qr_token) {
      await admin.from('scan_logs').insert({
        event_id,
        ticket_id: ticket.id,
        scanner_user_id: user.id,
        result: 'invalid',
        details: { qr_token: 'signed', reason: 'code_mismatch' },
      })
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Invalid ticket' })
    }

    // Wrong event?
    if (tokenPayload && tokenPayload.eid !== event_id) {
      await admin.from('scan_logs').insert({
        event_id,
        ticket_id: ticket.id,
        scanner_user_id: user.id,
        result: 'wrong_event',
        details: { qr_token: 'signed', expected_event: tokenPayload.eid },
      })
      return ok(<ValidateResponse>{ success: false, result: 'wrong_event', message: 'Ticket is for a different event' })
    }

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

    // Event ended? (Redundant check - redeem_ticket_atomic will also check, but good to fail fast)
    const { data: evt, error: evtErr } = await admin.from('events').select('end_at').eq('id', event_id).single()
    if (!evtErr && evt?.end_at && new Date(evt.end_at).getTime() < Date.now()) {
      await admin.from('scan_logs').insert({
        event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'expired',
        details: { qr_token, event_end: evt.end_at }
      })
      return ok(<ValidateResponse>{ success: false, result: 'expired', message: 'Event has ended' })
    }

    // --- Step 2: Use Atomic Redemption Function (with SELECT FOR UPDATE) ---
    const now = new Date().toISOString()
    const nowSeconds = Math.floor(Date.now() / 1000)
    
    // Calculate iat age for anomaly detection
    const iatAgeSeconds = tokenPayload ? nowSeconds - tokenPayload.iat : null

    // Call atomic redemption function (replaces optimistic locking)
    const { data: redemptionResult, error: redemptionErr } = await admin.rpc('redeem_ticket_atomic', {
      p_ticket_id: ticket.id,
      p_scanner_user_id: user.id,
      p_event_id: event_id,
    })

    if (redemptionErr) {
      console.error('[scanner-validate] redemption RPC error:', redemptionErr)
      return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Could not validate ticket' })
    }

    const redemption = redemptionResult as any

    // Fetch presentation data
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

    // Handle redemption result based on status
    if (redemption.status === 'ALREADY_REDEEMED') {
      await admin.from('scan_logs').insert({
        event_id, ticket_id: ticket.id, scanner_user_id: user.id, result: 'duplicate',
        details: {
          qr_token,
          original_redeemed_at: redemption.timestamp,
          iat_age_seconds: iatAgeSeconds,
        }
      })
      return ok(<ValidateResponse>{
        success: false,
        result: 'duplicate',
        message: redemption.message || `Already scanned at ${new Date(redemption.timestamp).toLocaleString()}`,
        timestamp: redemption.timestamp,
        ticket: ticketInfo,
      })
    }

    if (redemption.status === 'WRONG_EVENT' || redemption.status === 'NOT_FOUND' || redemption.status === 'INVALID_STATE') {
      const result = redemption.status === 'WRONG_EVENT' ? 'wrong_event' :
                     redemption.status === 'INVALID_STATE' ? (ticket.status === 'refunded' ? 'refunded' : 'void') : 'invalid'
      
      await admin.from('scan_logs').insert({
        event_id, ticket_id: ticket.id, scanner_user_id: user.id, result,
        details: { qr_token, reason: redemption.status, iat_age_seconds: iatAgeSeconds }
      })
      
      return ok(<ValidateResponse>{
        success: false,
        result: result as Outcome,
        message: redemption.message || 'Invalid ticket',
        ticket: ticketInfo,
      })
    }

    // --- Step 4: Anomaly Detection ---
    let anomalyFlags: string[] = []
    let anomalyDetails: any = {}

    // Soft signal: Old token (but still allow scan)
    if (iatAgeSeconds !== null && iatAgeSeconds > TOKEN_OLD_THRESHOLD_SECONDS) {
      anomalyFlags.push('old_iat')
      anomalyDetails.iat_age_seconds = iatAgeSeconds
    }

    // Call anomaly detection function
    if (redemption.status === 'REDEEMED') {
      const { data: anomalyResult } = await admin.rpc('detect_scan_anomaly', {
        p_ticket_id: ticket.id,
        p_token_age_seconds: iatAgeSeconds,
        p_last_scan_seconds_ago: null, // Could enhance to pass last scan time
      })

      if (anomalyResult?.is_anomaly) {
        anomalyFlags = [...anomalyFlags, ...(anomalyResult.anomaly_flags || [])]
        anomalyDetails = { ...anomalyDetails, ...anomalyResult }
      }
    }

    // Success - log with anomaly flags if any
    await admin.from('scan_logs').insert({
      event_id,
      ticket_id: ticket.id,
      scanner_user_id: user.id,
      result: 'valid',
      details: {
        qr_token,
        redeemed_at: redemption.timestamp || now,
        iat_age_seconds: iatAgeSeconds,
        anomaly_flags: anomalyFlags.length > 0 ? anomalyFlags : undefined,
        ...anomalyDetails,
      }
    })

    return ok(<ValidateResponse>{
      success: true,
      result: 'valid',
      message: 'Ticket validated',
      ticket: ticketInfo,
      timestamp: redemption.timestamp || now,
    })
  } catch (e: any) {
    console.error('[scanner-validate] fatal error:', e?.message || e)
    // Keep it quiet to the UI; return a soft failure instead of 500
    return ok(<ValidateResponse>{ success: false, result: 'invalid', message: 'Unexpected error' })
  }
})
