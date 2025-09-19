import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBED_MODEL = "text-embedding-3-small"; // 1536-dim

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, text } = await req.json();
    if (!eventId || !text) {
      return new Response("Missing params", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate embedding using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: text.slice(0, 8000)
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const data = await openaiResponse.json();
    const vec = data.data[0].embedding;

    // Update event with embedding
    const { error } = await supabase
      .from("events")
      .update({ embedding: vec })
      .eq("id", eventId);

    if (error) throw error;

    console.log(`Successfully generated embedding for event ${eventId}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error in event-embed function:', e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});