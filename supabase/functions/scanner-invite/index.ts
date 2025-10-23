// /functions/scanner-invite/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

type InviteResponse = {
  success: boolean
  message: string
  event_id?: string
  user_email?: string
  user_id?: string
  status?: 'enabled' | 'pending_invite'
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
const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/i as RegExp

async function safeJson<T = any>(req: Request): Promise<T | null> {
  try { return await req.json() } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Admin client (writes & user lookup)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authed client (who is calling?)
    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    // Caller
    const { data: auth } = await client.auth.getUser()
    const caller = auth?.user
    if (!caller) return ok(<InviteResponse>{ success: false, message: 'Not signed in' })

    // Input: GET (query) or POST (json)
    const url = new URL(req.url)
    const qsEventId   = url.searchParams.get('event_id')?.trim()
    const qsEmail     = url.searchParams.get('user_email')?.trim()

    const body = req.method === 'GET'
      ? null
      : await safeJson<{ event_id?: string; user_email?: string }>(req)

    const event_id   = (body?.event_id   ?? qsEventId   ?? '').trim()
    const user_email = (body?.user_email ?? qsEmail     ?? '').trim().toLowerCase()

    // Validate
    if (!event_id || !UUID_RE.test(event_id)) {
      return ok(<InviteResponse>{ success: false, message: 'Invalid or missing event_id' })
    }
    if (!user_email || !EMAIL_RE.test(user_email)) {
      return ok(<InviteResponse>{ success: false, message: 'Invalid or missing user_email' })
    }

    // AuthZ: caller must manage this event
    const { data: isManager, error: mgrErr } = await client.rpc('is_event_manager', { p_event_id: event_id })
    if (mgrErr) console.warn('[scanner-invite] is_event_manager RPC error:', mgrErr?.message)
    if (!isManager) {
      return ok(<InviteResponse>{ success: false, message: 'Not authorized to manage scanners for this event' })
    }

    // Look up user by email (Admin API)
    const { data: userRes, error: getUserErr } = await admin.auth.admin.getUserByEmail(user_email)
    if (getUserErr) {
      console.error('[scanner-invite] getUserByEmail error:', getUserErr)
      // fall through as "not found"
    }

    if (userRes?.user) {
      // User exists → idempotent upsert into event_scanners
      const targetId = userRes.user.id
      const { error: upErr } = await admin
        .from('ticketing.event_scanners')
        .upsert(
          { event_id, user_id: targetId, status: 'enabled', invited_by: caller.id },
          { onConflict: 'event_id,user_id' }
        )
      if (upErr) {
        console.error('[scanner-invite] upsert error:', upErr)
        return ok(<InviteResponse>{
          success: false,
          message: 'Failed to add scanner',
          event_id, user_email
        })
      }

      return ok(<InviteResponse>{
        success: true,
        message: `Scanner enabled for ${user_email}`,
        event_id,
        user_email,
        user_id: targetId,
        status: 'enabled',
      })
    }

    // User not found → create/update invite row (case-insensitive uniqueness)
    // Requires unique index:  ON public.event_invites(event_id, lower(email)) WHERE email IS NOT NULL
    const { error: invErr } = await admin
      .from('event_invites')
      .upsert(
        { event_id, user_id: null, email: user_email, invited_by: caller.id },
        { onConflict: 'event_id,email' } // relies on functional unique index with lower(email)
      )

    if (invErr) {
      console.error('[scanner-invite] invite upsert error:', invErr)
      return ok(<InviteResponse>{
        success: false,
        message: 'Failed to create invitation',
        event_id, user_email
      })
    }

    // (Optional) you can also send an email invite via auth if desired:
    // await admin.auth.admin.inviteUserByEmail(user_email, { redirectTo: 'https://yourapp.com/welcome' })

    return ok(<InviteResponse>{
      success: true,
      message: `Invitation recorded for ${user_email}. Ask them to sign up with this email.`,
      event_id,
      user_email,
      status: 'pending_invite',
    })
  } catch (e: any) {
    console.error('[scanner-invite] fatal error:', e?.message || e)
    // Keep response 200 to avoid breaking the UI loop; surface as structured failure
    return ok(<InviteResponse>{ success: false, message: 'Unexpected error' })
  }
})
