import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for analytics to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const body = await req.json();
    const { type, data } = body;

    // Get user agent and IP for analytics
    const userAgent = req.headers.get('user-agent') || '';
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : realIp;

    // Basic rate limiting
    const clientKey = `${ipAddress || 'unknown'}_${data.session_id || 'unknown'}`;
    const now = Date.now();
    const rateLimitWindow = 60000; // 1 minute
    const maxRequests = 100; // per minute

    if (!rateLimitStore.has(clientKey)) {
      rateLimitStore.set(clientKey, { count: 0, resetTime: now + rateLimitWindow });
    }

    const clientData = rateLimitStore.get(clientKey);
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + rateLimitWindow;
    }

    if (clientData.count >= maxRequests) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    clientData.count++;

    // Get user ID if authenticated
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        userId = user?.id || null;
      } catch (error) {
        console.log('No valid auth token');
      }
    }

    if (type === 'view') {
      return await trackView(supabaseClient, data, userId, userAgent, ipAddress);
    } else if (type === 'click') {
      return await trackClick(supabaseClient, data, userId, userAgent, ipAddress);
    }

    return new Response(JSON.stringify({ error: 'Invalid tracking type' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (error) {
    console.error('Tracking error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function trackView(supabase: any, data: any, userId: string | null, userAgent: string, ipAddress: string) {
  const {
    post_id,
    event_id,
    session_id,
    source,
    qualified = false,
    completed = false,
    dwell_ms = 0,
    watch_percentage = 0
  } = data;

  if (!post_id || !event_id || !session_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Check for duplicate views (same user/session + post + day)
  const today = new Date().toISOString().split('T')[0];
  const { data: existingView } = await supabase
    .from('post_views')
    .select('id')
    .eq('post_id', post_id)
    .eq(userId ? 'user_id' : 'session_id', userId || session_id)
    .gte('created_at', `${today}T00:00:00Z`)
    .lt('created_at', `${today}T23:59:59Z`)
    .limit(1);

  if (existingView && existingView.length > 0) {
    return new Response(JSON.stringify({ success: true, duplicate: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Insert view record
  const { error } = await supabase
    .from('post_views')
    .insert({
      post_id,
      event_id,
      user_id: userId,
      session_id,
      source,
      qualified,
      completed,
      dwell_ms,
      watch_percentage,
      user_agent: userAgent,
      ip_address: ipAddress
    });

  if (error) {
    console.error('View tracking error:', error);
    return new Response(JSON.stringify({ error: 'Failed to track view' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function trackClick(supabase: any, data: any, userId: string | null, userAgent: string, ipAddress: string) {
  const {
    post_id,
    event_id,
    session_id,
    target,
    source
  } = data;

  if (!post_id || !event_id || !session_id || !target) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Insert click record
  const { error } = await supabase
    .from('post_clicks')
    .insert({
      post_id,
      event_id,
      user_id: userId,
      session_id,
      target,
      source,
      user_agent: userAgent,
      ip_address: ipAddress
    });

  if (error) {
    console.error('Click tracking error:', error);
    return new Response(JSON.stringify({ error: 'Failed to track click' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}