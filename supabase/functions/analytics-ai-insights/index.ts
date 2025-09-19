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
    const { analytics_data, action } = await req.json();

    const systemPrompt = `You are an AI analytics assistant for YardPass, an event management platform. 
    Analyze the provided analytics data and generate actionable insights for event organizers.
    
    Be specific, data-driven, and focus on actionable recommendations.
    Return responses in JSON format with relevant fields based on the action type.`;

    let userPrompt = "";
    let responseFormat: any = { type: "json_object" };

    switch (action) {
      case "generate_insights":
        userPrompt = `Analyze this event analytics data and generate 3-5 key insights with actionable recommendations:
        
        ${JSON.stringify(analytics_data, null, 2)}
        
        Return JSON with: {
          "insights": [
            {
              "title": "Brief insight title",
              "description": "Detailed insight with context",
              "recommendation": "Specific actionable recommendation",
              "impact": "high|medium|low",
              "category": "revenue|attendance|engagement|marketing"
            }
          ]
        }`;
        break;

      case "predict_performance":
        userPrompt = `Based on this analytics data, predict likely outcomes and provide forecasts:
        
        ${JSON.stringify(analytics_data, null, 2)}
        
        Return JSON with: {
          "predictions": [
            {
              "metric": "metric name",
              "current_value": number,
              "predicted_value": number,
              "confidence": "high|medium|low",
              "reasoning": "explanation of prediction",
              "timeframe": "next 7/30 days"
            }
          ]
        }`;
        break;

      case "compare_performance":
        userPrompt = `Compare performance across events and identify patterns:
        
        ${JSON.stringify(analytics_data, null, 2)}
        
        Return JSON with: {
          "comparisons": [
            {
              "pattern": "Pattern description",
              "events": ["event names that fit pattern"],
              "insight": "What this means",
              "recommendation": "How to leverage this"
            }
          ]
        }`;
        break;

      case "optimization_suggestions":
        userPrompt = `Analyze the data for optimization opportunities:
        
        ${JSON.stringify(analytics_data, null, 2)}
        
        Return JSON with: {
          "optimizations": [
            {
              "area": "pricing|timing|marketing|content",
              "current_state": "what's happening now",
              "suggested_change": "specific recommendation",
              "expected_impact": "projected improvement",
              "ease_of_implementation": "easy|medium|hard"
            }
          ]
        }`;
        break;

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

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