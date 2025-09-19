import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIWritingRequest {
  action: 'improve' | 'generate_subject' | 'adjust_tone' | 'translate';
  text?: string;
  eventTitle?: string;
  eventDate?: string;
  tone?: 'professional' | 'friendly' | 'urgent' | 'casual';
  language?: string;
  messageType: 'email' | 'sms';
  audience?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, text, eventTitle, eventDate, tone, language, messageType, audience }: AIWritingRequest = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing required field: action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let prompt = "";
    
    switch (action) {
      case 'improve':
        prompt = `Improve this ${messageType} message for an event communication. Make it more engaging, clear, and professional while keeping the same core message. Keep it ${messageType === 'sms' ? 'concise for SMS (under 160 characters)' : 'appropriate for email length'}:

Original message: ${text}

Event: ${eventTitle || 'the event'}
Date: ${eventDate || 'upcoming'}
Audience: ${audience || 'event attendees'}

Return only the improved message text.`;
        break;
        
      case 'generate_subject':
        prompt = `Generate a compelling email subject line for this event communication:

Event: ${eventTitle || 'the event'}
Date: ${eventDate || 'upcoming'}
Audience: ${audience || 'event attendees'}
Tone: ${tone || 'professional'}

Message preview: ${text ? text.substring(0, 100) + '...' : 'Event update message'}

Return only the subject line, no quotes or extra text.`;
        break;
        
      case 'adjust_tone':
        prompt = `Adjust the tone of this ${messageType} message to be more ${tone}:

Original message: ${text}

Event context: ${eventTitle || 'the event'} on ${eventDate || 'upcoming date'}

Keep the same information but adjust the tone to be ${tone}. ${messageType === 'sms' ? 'Keep it under 160 characters.' : ''}

Return only the adjusted message text.`;
        break;
        
      case 'translate':
        prompt = `Translate this ${messageType} message to ${language}:

Original message: ${text}

Keep the same tone and meaning. ${messageType === 'sms' ? 'Keep it concise for SMS.' : ''}

Return only the translated text.`;
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    console.log("Sending request to OpenAI with prompt:", prompt);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert event communication writer. You help create clear, engaging messages for event organizers to send to their attendees. Always maintain the original intent and key information while improving clarity and engagement."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: messageType === 'sms' ? 100 : 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI API error:", error);
      throw new Error(error.error?.message || "Failed to generate AI response");
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content.trim();

    console.log("AI response generated successfully");

    return new Response(
      JSON.stringify({ 
        text: generatedText,
        action,
        messageType 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in ai-writing-assistant function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);