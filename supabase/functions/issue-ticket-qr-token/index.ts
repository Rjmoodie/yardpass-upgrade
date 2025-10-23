// Edge function to issue short-lived signed QR tokens for tickets
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

type IssueRequest = {
  ticket_id?: string
  event_id?: string
}

type IssueResponse = {
  token: string
  expires_at: string
  issued_at: string
  wallet_links?: {
    apple?: string
    google?: string
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

const TOKEN_VERSION = 'v1'
const TOKEN_TTL_SECONDS = 30
const CLOCK_SKEW_SECONDS = 5

const encoder = new TextEncoder()

const signingSecret = Deno.env.get('TICKET_QR_SIGNING_SECRET') ?? ''

let signingKeyPromise: Promise<CryptoKey> | null = null

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

async function safeJson<T>(req: Request): Promise<T | null> {
  try {
    return await req.json()
  } catch (error) {
    console.warn('[issue-ticket-qr-token] failed to parse JSON body', error)
    return null
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(encoder.encode(value))
}

async function getSigningKey(): Promise<CryptoKey> {
  if (!signingSecret) {
    throw new Error('TICKET_QR_SIGNING_SECRET env var is not configured')
  }
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
  }
  return signingKeyPromise
}

async function signPayload(payloadBase64: string): Promise<string> {
  const key = await getSigningKey()
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64))
  return base64UrlEncode(new Uint8Array(signature))
}

async function createSignedToken(payload: Record<string, unknown>): Promise<string> {
  const payloadJson = JSON.stringify(payload)
  const payloadBase64 = base64UrlEncodeString(payloadJson)
  const signature = await signPayload(payloadBase64)
  return `${TOKEN_VERSION}.${payloadBase64}.${signature}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return ok({ error: 'Method not allowed' }, 405)
  }

  try {
    if (!signingSecret) {
      console.error('[issue-ticket-qr-token] missing TICKET_QR_SIGNING_SECRET env var')
      return ok({ error: 'Server misconfiguration' }, 500)
    }

    const body = (await safeJson<IssueRequest>(req)) ?? {}
    const ticketId = body.ticket_id?.trim()
    const eventId = body.event_id?.trim()

    if (!ticketId || !eventId) {
      return ok({ error: 'ticket_id and event_id are required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    const user = userData?.user
    if (userErr || !user) {
      return ok({ error: 'Not authenticated' }, 401)
    }

    const { data: ticket, error: ticketErr } = await admin
      .from('ticketing.tickets')
      .select('id, event_id, owner_user_id, qr_code, status, redeemed_at, wallet_pass_url')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketErr) {
      console.error('[issue-ticket-qr-token] failed to fetch ticket', ticketErr)
      return ok({ error: 'Unable to fetch ticket' }, 500)
    }

    if (!ticket || ticket.event_id !== eventId) {
      return ok({ error: 'Ticket not found' }, 404)
    }

    if (ticket.owner_user_id && ticket.owner_user_id !== user.id) {
      return ok({ error: 'Not allowed to access this ticket' }, 403)
    }

    if (ticket.status === 'void' || ticket.status === 'refunded') {
      return ok({ error: 'Ticket is inactive' }, 400)
    }

    if (ticket.redeemed_at) {
      return ok({ error: 'Ticket already redeemed' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)
    const iat = now
    const exp = now + TOKEN_TTL_SECONDS

    const tokenPayload = {
      v: TOKEN_VERSION,
      tid: ticket.id,
      eid: ticket.event_id,
      code: ticket.qr_code,
      iat,
      exp,
    }

    const token = await createSignedToken(tokenPayload)

    const response: IssueResponse = {
      token,
      issued_at: new Date(iat * 1000).toISOString(),
      expires_at: new Date((exp - CLOCK_SKEW_SECONDS) * 1000).toISOString(),
      wallet_links: ticket.wallet_pass_url
        ? { apple: ticket.wallet_pass_url, google: ticket.wallet_pass_url }
        : undefined,
    }

    return ok(response)
  } catch (error) {
    console.error('[issue-ticket-qr-token] unexpected error', error)
    return ok({ error: 'Unexpected error issuing ticket token' }, 500)
  }
})
