import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      org_id,
      name,
      description,
      objective,
      pacing_strategy,
      total_budget_credits,
      daily_budget_credits,
      start_date,
      end_date,
      timezone,
    } = body;

    if (!org_id || !name || !total_budget_credits || !start_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        org_id,
        name,
        description: description || null,
        objective: objective || 'ticket_sales',
        pacing_strategy: pacing_strategy || 'even',
        total_budget_credits,
        daily_budget_credits: daily_budget_credits || null,
        start_date,
        end_date: end_date || null,
        timezone: timezone || 'UTC',
        created_by: user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ campaign }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
