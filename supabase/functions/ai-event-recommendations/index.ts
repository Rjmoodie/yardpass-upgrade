import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { eventData, requestType = 'recommendations' } = await req.json();

    if (!eventData) {
      return new Response(
        JSON.stringify({ error: 'Event data is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client for market data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Gather market intelligence
    let marketContext = "";
    
    if (eventData.category) {
      const { data: similarEvents } = await supabase
        .from('events')
        .select('title, category, start_at, ticket_tiers(price_cents)')
        .eq('category', eventData.category)
        .gte('start_at', new Date().toISOString())
        .limit(5);

      if (similarEvents?.length) {
        const avgPrice = similarEvents
          .flatMap(e => e.ticket_tiers || [])
          .reduce((sum, tier, _, arr) => sum + (tier.price_cents || 0) / arr.length, 0) / 100;
        
        marketContext += `Similar ${eventData.category} events average $${avgPrice.toFixed(2)} tickets. `;
      }
    }

    if (eventData.location?.city) {
      const { data: localEvents } = await supabase
        .from('events')
        .select('id, start_at')
        .eq('city', eventData.location.city)
        .gte('start_at', eventData.startDate || new Date().toISOString())
        .lt('start_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10);

      if (localEvents?.length) {
        marketContext += `${localEvents.length} events in ${eventData.location.city} in the next 30 days. `;
      }
    }

    const prompt = `
You are an expert event strategist analyzing an upcoming event. Provide actionable recommendations and insights.

EVENT DETAILS:
- Title: ${eventData.title || 'Not specified'}
- Category: ${eventData.category || 'Not specified'}
- Description: ${eventData.description || 'Not specified'}
- Date: ${eventData.startDate || 'Not specified'}
- Location: ${eventData.location?.city || 'Not specified'}, ${eventData.location?.country || 'Not specified'}
- Ticket Tiers: ${JSON.stringify(eventData.ticketTiers || [])}

MARKET CONTEXT:
${marketContext}

Provide a JSON response with:
1. "insights" object with:
   - predictedAttendance (number): Based on category, location, timing
   - optimalPrice (number): Suggested ticket price
   - engagementScore (1-10): How engaging the event concept is
   - competitionLevel ("low"/"medium"/"high"): Market competition level

2. "recommendations" array with objects containing:
   - type: "pricing"|"timing"|"marketing"|"engagement"|"logistics"
   - title: Short recommendation title
   - description: Detailed explanation
   - impact: "high"|"medium"|"low"
   - actionable: boolean
   - suggestion: Specific action to take (optional)

Focus on practical, data-driven recommendations that can improve event success.

Return ONLY valid JSON, no markdown or additional text.
`;

    console.log('Generating AI recommendations for:', eventData.title);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert event strategist and data analyst. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to generate recommendations');
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    console.log('AI recommendations generated successfully');

    return new Response(
      JSON.stringify(aiResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in ai-event-recommendations function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});