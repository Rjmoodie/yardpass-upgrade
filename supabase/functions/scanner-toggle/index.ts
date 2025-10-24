// /functions/scanner-toggle/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

type ToggleStatus = 'enabled' | 'disabled'

interface ToggleResponse {
  success: boolean
  message: string
  event_id?: string
  user_id?: string
  status?: ToggleStatus
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: jsonHeaders })

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i as RegExp
const STATUS_SET = new Set<ToggleStatus>(['enabled', 'disabled'])

async function safeJson<T = any>(req: Request): Promise<T | null> {
  try { return await req.json() } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Admin client (for writes)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authed client (to identify caller and use RPC with caller context)
    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    // Who is calling?
    const { data: auth } = await client.auth.getUser()
    const caller = auth?.user
    if (!caller) {
      return ok(<ToggleResponse>{ success: false, message: 'Not signed in' })
    }

    // Accept GET (?event_id=&user_id=&status=) or POST {event_id,user_id,status}
    const url = new URL(req.url)
    const qsEventId = url.searchParams.get('event_id')?.trim()
    const qsUserId  = url.searchParams.get('user_id')?.trim()
    const qsStatus  = url.searchParams.get('status')?.trim()?.toLowerCase() as ToggleStatus | undefined

    const body = req.method === 'GET'
      ? null
      : await safeJson<{ event_id?: string; user_id?: string; status?: string }>(req)

    const event_id = (body?.event_id ?? qsEventId ?? '').trim()
    const target_user_id = (body?.user_id ?? qsUserId ?? '').trim()
    const statusIn = (body?.status ?? qsStatus ?? '').toLowerCase() as ToggleStatus

    // Input validation
    if (!event_id || !UUID_RE.test(event_id)) {
      return ok(<ToggleResponse>{ success: false, message: 'Invalid or missing event_id' })
    }
    if (!target_user_id || !UUID_RE.test(target_user_id)) {
      return ok(<ToggleResponse>{ success: false, message: 'Invalid or missing user_id' })
    }
    if (!STATUS_SET.has(statusIn)) {
      return ok(<ToggleResponse>{ success: false, message: "Status must be 'enabled' or 'disabled'" })
    }

    // Prevent foot-gun: optionally block disabling yourself (uncomment to enforce)
    // if (caller.id === target_user_id && statusIn === 'disabled') {
    //   return ok(<ToggleResponse>{ success: false, message: "You can't disable yourself." })
    // }

    // Authorization: caller must be event manager/owner/editor
    const { data: isManager, error: mgrErr } = await client.rpc('is_event_manager', { p_event_id: event_id })
    if (mgrErr) {
      console.warn('[scanner-toggle] is_event_manager RPC error:', mgrErr?.message)
    }
    if (!isManager) {
      return ok(<ToggleResponse>{ success: false, message: 'Not authorized to manage scanners for this event' })
    }

    // Ensure target user exists (prevents orphan rows)
    const userRes = await admin.auth.admin.getUserById(target_user_id)
    if (!userRes?.data?.user) {
      return ok(<ToggleResponse>{ success: false, message: 'Target user not found' })
    }

    // Upsert scanner row atomically (idempotent)
    const { error: upErr } = await admin
      .from('event_scanners')
      .upsert(
        { event_id, user_id: target_user_id, status: statusIn },
        { onConflict: 'event_id,user_id' }
      )

    if (upErr) {
      console.error('[scanner-toggle] upsert error:', upErr)
      return ok(<ToggleResponse>{ success: false, message: 'Failed to update scanner status' })
    }

    // (Optional) read back to confirm current state
    const { data: row } = await admin
      .from('event_scanners')
      .select('status, updated_at')
      .eq('event_id', event_id)
      .eq('user_id', target_user_id)
      .maybeSingle()

    return ok(<ToggleResponse>{
      success: true,
      message: `Scanner ${row?.status ?? statusIn} successfully`,
      event_id,
      user_id: target_user_id,
      status: (row?.status as ToggleStatus) ?? statusIn,
    })
  } catch (e: any) {
    console.error('[scanner-toggle] fatal error:', e?.message || e)
    // Quiet failure to keep the app responsive
    return ok(<ToggleResponse>{ success: false, message: 'Unexpected error' })
  }
})
