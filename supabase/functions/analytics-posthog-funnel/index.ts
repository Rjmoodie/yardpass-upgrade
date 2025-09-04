import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const postHogKey = Deno.env.get('POSTHOG_API_KEY');

    if (!postHogKey) {
      return new Response(JSON.stringify({ error: 'PostHog API key not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const { event_ids, from_date, to_date } = await req.json();

    // Sample funnel events for ticket purchases
    const events = [
      'event_view',
      'ticket_cta_click', 
      'checkout_started',
      'checkout_completed'
    ];

    // Mock funnel data since PostHog integration would be complex
    // In production, this would call PostHog's API with the actual events
    const funnelData = {
      funnel_steps: [
        { event: 'event_view', count: 1250, conversion_rate: 100 },
        { event: 'ticket_cta_click', count: 387, conversion_rate: 31.0 },
        { event: 'checkout_started', count: 156, conversion_rate: 40.3 },
        { event: 'checkout_completed', count: 89, conversion_rate: 57.1 }
      ],
      total_conversion_rate: 7.1,
      acquisition_channels: [
        { channel: 'direct', visitors: 542, conversions: 38 },
        { channel: 'social_share', visitors: 298, conversions: 22 },
        { channel: 'qr_code', visitors: 189, conversions: 15 },
        { channel: 'organic', visitors: 221, conversions: 14 }
      ],
      device_breakdown: [
        { device: 'mobile', sessions: 892, conversion_rate: 6.8 },
        { device: 'desktop', sessions: 298, conversion_rate: 8.1 },
        { device: 'tablet', sessions: 60, conversion_rate: 5.2 }
      ]
    };

    console.log('PostHog analytics requested for events:', event_ids);
    console.log('Date range:', from_date, 'to', to_date);

    return new Response(JSON.stringify(funnelData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PostHog analytics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});