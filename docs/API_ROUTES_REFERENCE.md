# 🔌 API Routes Reference

## Next.js API Routes for Sponsorship System

### Directory Structure
```
app/api/
├── sponsors/
│   ├── route.ts                    # GET sponsors list
│   ├── [id]/
│   │   ├── route.ts                # GET/PATCH sponsor details
│   │   ├── profile/route.ts        # GET/PUT sponsor profile
│   │   └── recommendations/route.ts # GET event recommendations
├── packages/
│   ├── route.ts                    # GET marketplace packages
│   ├── [id]/route.ts               # GET package details
│   └── recommendations/route.ts    # GET for specific sponsor
├── matches/
│   ├── compute/route.ts            # POST compute match score
│   └── feedback/route.ts           # POST match feedback
├── proposals/
│   ├── route.ts                    # GET/POST proposals
│   ├── [id]/
│   │   ├── route.ts                # GET/PATCH proposal
│   │   └── messages/route.ts       # GET/POST messages
└── deliverables/
    ├── route.ts                    # GET deliverables
    ├── [id]/
    │   ├── route.ts                # GET/PATCH deliverable
    │   └── proofs/route.ts         # POST proof submission
```

---

## API Route Examples

### 1. Get Marketplace Packages

```typescript
// app/api/packages/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get('category')
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  
  let query = supabase
    .from('v_sponsorship_package_cards')
    .select('*')
    .eq('is_active', true)
    .gt('inventory', supabase.raw('sold'))
  
  if (category) {
    query = query.eq('category', category)
  }
  
  if (minPrice) {
    query = query.gte('price_cents', Number(minPrice) * 100)
  }
  
  if (maxPrice) {
    query = query.lte('price_cents', Number(maxPrice) * 100)
  }
  
  const { data, error } = await query
    .order('quality_score_100', { ascending: false })
    .limit(50)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ data })
}
```

### 2. Compute Match Score

```typescript
// app/api/matches/compute/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { event_id, sponsor_id } = await request.json()
  
  if (!event_id || !sponsor_id) {
    return NextResponse.json(
      { error: 'event_id and sponsor_id are required' },
      { status: 400 }
    )
  }
  
  // Compute and upsert match score
  const { data, error } = await supabase.rpc('fn_upsert_match', {
    p_event_id: event_id,
    p_sponsor_id: sponsor_id
  })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Get the computed match
  const { data: match, error: matchError } = await supabase
    .from('sponsorship_matches')
    .select('*')
    .eq('event_id', event_id)
    .eq('sponsor_id', sponsor_id)
    .single()
  
  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }
  
  return NextResponse.json({ data: match })
}
```

### 3. Get Sponsor Recommendations

```typescript
// app/api/sponsors/[id]/recommendations/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const sponsorId = params.id
  const limit = Number(request.nextUrl.searchParams.get('limit') || 20)
  
  const { data, error } = await supabase
    .from('v_sponsor_recommended_packages')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .gte('score', 0.5)
    .order('score', { ascending: false })
    .limit(limit)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ data })
}
```

### 4. Create Proposal

```typescript
// app/api/proposals/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { event_id, sponsor_id, initial_message } = await request.json()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Create proposal thread
  const { data: thread, error: threadError } = await supabase
    .from('proposal_threads')
    .insert({
      event_id,
      sponsor_id,
      status: 'draft',
      created_by: user.id
    })
    .select()
    .single()
  
  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 })
  }
  
  // Add initial message if provided
  if (initial_message) {
    const { error: messageError } = await supabase
      .from('proposal_messages')
      .insert({
        thread_id: thread.id,
        sender_type: 'organizer', // or determine from user role
        sender_user_id: user.id,
        body: initial_message.body,
        offer: initial_message.offer || {}
      })
    
    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }
  }
  
  return NextResponse.json({ data: thread })
}
```

### 5. Submit Deliverable Proof

```typescript
// app/api/deliverables/[id]/proofs/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const deliverableId = params.id
  const { asset_url, metrics } = await request.json()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Submit proof
  const { data: proof, error } = await supabase
    .from('deliverable_proofs')
    .insert({
      deliverable_id: deliverableId,
      asset_url,
      metrics: metrics || {},
      submitted_by: user.id
    })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Update deliverable status
  await supabase
    .from('deliverables')
    .update({ status: 'submitted' })
    .eq('id', deliverableId)
  
  return NextResponse.json({ data: proof })
}
```

### 6. Process Match Queue (Cron)

```typescript
// app/api/cron/process-matches/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data, error } = await supabase.rpc('process_match_queue', {
    p_batch_size: 100
  })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({
    success: true,
    processed: data,
    timestamp: new Date().toISOString()
  })
}

// Configure in vercel.json or similar
// {
//   "crons": [{
//     "path": "/api/cron/process-matches",
//     "schedule": "*/5 * * * *"
//   }]
// }
```

---

## Server Actions (Next.js 14+)

### Create Proposal (Server Action)

```typescript
// src/actions/proposals.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function createProposal(formData: FormData) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const eventId = formData.get('event_id') as string
  const sponsorId = formData.get('sponsor_id') as string
  const message = formData.get('message') as string
  
  const { data: user } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Unauthorized' }
  }
  
  const { data, error } = await supabase
    .from('proposal_threads')
    .insert({
      event_id: eventId,
      sponsor_id: sponsorId,
      status: 'draft',
      created_by: user.user!.id
    })
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  // Add initial message
  if (message) {
    await supabase
      .from('proposal_messages')
      .insert({
        thread_id: data.id,
        sender_type: 'organizer',
        sender_user_id: user.user!.id,
        body: message,
        offer: {}
      })
  }
  
  revalidatePath('/proposals')
  
  return { data }
}
```

---

## Middleware for Auth

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()
  
  // Protect sponsor/organizer routes
  if (req.nextUrl.pathname.startsWith('/sponsors') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  if (req.nextUrl.pathname.startsWith('/events') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return res
}

export const config = {
  matcher: ['/sponsors/:path*', '/events/:path*', '/proposals/:path*']
}
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret
OPENAI_API_KEY=sk-your-openai-key  # For embeddings
STRIPE_SECRET_KEY=sk_your-stripe-key
```

---

Your backend-to-frontend connection is now fully documented! 🚀
