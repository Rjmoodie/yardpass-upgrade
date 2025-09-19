import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "npm:openai@4.56.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) {
  console.warn("[ai-writing-assistant] OPENAI_API_KEY is missing");
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY ?? "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const bad = (message: string, status = 400, details?: unknown) => {
  console.error(`[ai-writing-assistant] ${message}`, details ?? "");
  return ok({ error: message, details }, status);
};

type Action =
  | "generate_subject"
  | "subject_variants"
  | "generate_preheader"
  | "improve"
  | "adjust_tone"
  | "shorten"
  | "expand"
  | "suggest_cta"
  | "optimize_for_spam"
  | "grammar_check";

type ReqBody = {
  action: Action;
  text?: string;
  eventTitle?: string;
  eventDate?: string;
  tone?: string;
  messageType?: "email" | "sms";
  audience?: string; // e.g. "all attendees" | "scanners, vendors"
  maxWords?: number;
};

const SYS = (ctx: Omit<ReqBody, "action">) =>
  `You are YardPass' email & SMS copywriting assistant. 
Return clean, concise results. Never include JSON backticks—return raw JSON only when asked.
Brand: YardPass. Audience: ${ctx.audience || "event attendees"}. 
Event: ${ctx.eventTitle || "Event"}${ctx.eventDate ? ` on ${ctx.eventDate}` : ""}.
Channel: ${ctx.messageType || "email"}.
Use US English, friendly/professional tone unless otherwise requested.`;

async function completeJSON<T = any>(system: string, user: string) {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          user +
          `

Return strictly valid JSON. Top-level keys allowed: "text", "variants", "insights".`,
      },
    ],
    response_format: { type: "json_object" as const },
  });
  const raw = resp.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as T;
  } catch {
    return { text: raw } as T;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  if (!OPENAI_API_KEY) return bad("OPENAI_API_KEY not configured", 500);

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return bad("Invalid JSON body");
  }

  const ctx = {
    text: body.text || "",
    eventTitle: body.eventTitle || "",
    eventDate: body.eventDate || "",
    tone: body.tone || "",
    messageType: body.messageType || "email",
    audience: body.audience || "event attendees",
    maxWords: body.maxWords ?? 120,
  };

  const sys = SYS(ctx);

  try {
    switch (body.action) {
      case "generate_subject": {
        const json = await completeJSON(sys, `
Create one compelling subject line (max 60 chars). 
Focus on ${ctx.eventTitle || "the event"}, include urgency if appropriate, avoid spammy words.
Respond as: {"text": "Subject line"}
`);
        return ok(json);
      }

      case "subject_variants": {
        const json = await completeJSON(sys, `
Create 3 distinct subject lines (max 60 chars each). 
Vary tone (e.g., friendly, urgent, informative). 
Rate each 1-10 for likely open-rate. 
Respond as: {"variants":[{"text":"...","score":9},{"text":"...","score":8},{"text":"...","score":7}]}
`);
        return ok(json);
      }

      case "generate_preheader": {
        const json = await completeJSON(sys, `
Write a concise preheader (max 90 chars) that complements a subject line and teases content.
Respond as: {"text":"preheader"}
`);
        return ok(json);
      }

      case "improve": {
        const json = await completeJSON(sys, `
Improve the following message for clarity, brevity, and conversion. Keep variables like {{first_name}}, {{event_title}}, {{event_date}} intact.
Message:
${ctx.text}

Respond as: {"text":"improved message","insights":"brief explanation of changes"}
`);
        return ok(json);
      }

      case "adjust_tone": {
        const json = await completeJSON(sys, `
Rewrite the message with a "${ctx.tone || "friendly"}" tone. 
Keep variables like {{first_name}}, etc. 
Preserve meaning; improve scannability.
Original:
${ctx.text}

Respond as: {"text":"rewritten message"}
`);
        return ok(json);
      }

      case "shorten": {
        const json = await completeJSON(sys, `
Shorten to under ${ctx.maxWords} words while keeping the core CTA and details. 
Preserve variables and links.
Original:
${ctx.text}

Respond as: {"text":"shorter message"}
`);
        return ok(json);
      }

      case "expand": {
        const json = await completeJSON(sys, `
Expand slightly (max +30%) to be clearer and more persuasive, keep one primary CTA. 
Original:
${ctx.text}

Respond as: {"text":"expanded message"}
`);
        return ok(json);
      }

      case "suggest_cta": {
        const json = await completeJSON(sys, `
Propose 3 strong CTA buttons that match the copy and channel. 
Keep them short (max 24 chars).
Respond as: {"variants":[{"text":"Get Tickets"},{"text":"Add to Calendar"},{"text":"View Details"}]}
`);
        return ok(json);
      }

      case "optimize_for_spam": {
        const json = await completeJSON(sys, `
Review this message for spam triggers. Suggest a minimally edited version that reduces spam risk but preserves meaning.
Original:
${ctx.text}

Respond as: {
  "text": "spam-optimized copy",
  "insights": "brief notes",
  "variants": [{"text":"alt v1"},{"text":"alt v2"}]
}
`);
        return ok(json);
      }

      case "grammar_check": {
        const json = await completeJSON(sys, `
Fix grammar, spelling, and punctuation only. Do not change tone or meaning. 
Keep variables like {{first_name}} as-is.
Original:
${ctx.text}

Respond as: {"text":"cleaned copy"}
`);
        return ok(json);
      }

      default:
        return bad("Unknown action");
    }
  } catch (e) {
    return bad("Assistant failure", 500, e?.message ?? e);
  }
});