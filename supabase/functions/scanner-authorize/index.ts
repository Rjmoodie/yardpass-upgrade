// /functions/scanner-authorize/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

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

type Role = 'owner' | 'editor' | 'scanner' | 'none'

interface AuthorizeResponse {
  allowed: boolean
  role: Role
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

async function safeJson<T = any>(req: Request): Promise<T | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    // Accept event_id from query string (GET) or JSON body (POST)
    const url = new URL(req.url)
    const qsEventId = url.searchParams.get('event_id')?.trim()
    const body = req.method === 'GET' ? null : await safeJson<{ event_id?: string }>(req)
    const bodyEventId = body?.event_id?.trim()
    const event_id = qsEventId || bodyEventId || ''

    // If event_id is missing, return a harmless "no access" (200) instead of throwing
    if (!event_id) {
      return ok(<AuthorizeResponse>{ allowed: false, role: 'none' })
    }

    // Resolve the end user (based on the bearer token from the client)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    // No session → treat as not allowed (200), keeps client console clean
    if (userErr || !user) {
      return ok(<AuthorizeResponse>{ allowed: false, role: 'none' })
    }

    console.log(`[scanner-authorize] user=${user.id} event=${event_id}`)

    // --- 1) Check for manager/organizer rights via RPC (your existing function) ---
    // is_event_manager should return boolean; if it errors we fall back gracefully
    const { data: isMgr, error: mgrErr } = await supabase.rpc('is_event_manager', { p_event_id: event_id })

    if (mgrErr) {
      console.warn('[scanner-authorize] is_event_manager RPC error:', mgrErr?.message)
    }

    if (isMgr === true) {
      // If you later add a role-returning RPC, map that to 'owner' | 'editor' here.
      const resp: AuthorizeResponse = { allowed: true, role: 'owner' }
      return ok(resp)
    }

    // --- 2) Check explicit scanner enablement for this event ---
    const { data: scannerRow, error: scannerErr } = await supabase
      .from('event_scanners')
      .select('status')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .eq('status', 'enabled')
      .maybeSingle()

    if (scannerErr) {
      // Database hiccup — surface as a soft "no" rather than 500 to avoid UI retry storms
      console.warn('[scanner-authorize] event_scanners query error:', scannerErr?.message)
      return ok(<AuthorizeResponse>{ allowed: false, role: 'none' })
    }

    if (scannerRow) {
      const resp: AuthorizeResponse = { allowed: true, role: 'scanner' }
      return ok(resp)
    }

    // --- 3) Default: no access ---
    return ok(<AuthorizeResponse>{ allowed: false, role: 'none' })
  } catch (e: any) {
    // Truly unexpected error
    console.error('[scanner-authorize] fatal error:', e?.message || e)
    return ok(<AuthorizeResponse>{ allowed: false, role: 'none' }, 200)
  }
})
