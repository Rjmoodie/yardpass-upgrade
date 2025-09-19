import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "npm:openai@4.56.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const openai = new OpenAI({ apiKey: OPENAI_API_KEY ?? "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { org_id, date_range, kpis, revenue_trend, top_events, question } = await req.json();

    const systemPrompt = `You are an AI analytics assistant for YardPass, an event management platform. 
    Analyze the provided analytics data and generate actionable insights for event organizers.
    
    Be specific, data-driven, and focus on actionable recommendations.
    Return responses in JSON format with summary, anomalies, recommended_actions, and notes.`;

    const analyticsData = {
      org_id,
      date_range,
      kpis,
      revenue_trend,
      top_events,
      question
    };

    let userPrompt = "";
    if (question) {
      userPrompt = `Based on this analytics data, answer this specific question: "${question}"
      
      Analytics Data:
      ${JSON.stringify(analyticsData, null, 2)}
      
      Return JSON with: {
        "summary": "Direct answer to the question",
        "anomalies": ["any anomalies related to the question"],
        "recommended_actions": ["specific actions to address the question"],
        "notes": ["additional context or insights"]
      }`;
    } else {
      userPrompt = `Analyze this event analytics data and provide an overview with insights:
      
      Analytics Data:
      ${JSON.stringify(analyticsData, null, 2)}
      
      Return JSON with: {
        "summary": "Brief overview of performance",
        "anomalies": ["noteworthy patterns or unusual metrics"],
        "recommended_actions": ["3-5 specific actionable recommendations"],
        "notes": ["additional context or insights"]
      }`;
    }

    const responseFormat: any = { type: "json_object" };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: responseFormat,
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI insights error:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to generate insights",
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});