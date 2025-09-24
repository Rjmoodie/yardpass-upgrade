// supabase/functions/ai-event-recommendations/index.ts
// Returns tier suggestions based on org/category/city/date.
// Env: OPENAI_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!OPENAI_API_KEY) return json({ error: "Missing OPENAI_API_KEY" }, 500);

    const { org_id, city, category, event_date } = await req.json();

    const system = `
You are a pricing strategist for live events. 
Return concise, practical ticket tier suggestions as pure JSON.
Prices should be reasonable for the city and category, and quantities should be realistic for a small/medium event.
JSON schema:
{
  "tiers": [
    { "name": "string", "price": number, "badge": "string", "quantity": number }
  ],
  "notes": "string"
}
Do not include any text outside JSON. Keep 3-4 tiers max.
Avoid surge/dynamic pricing language; this is a static initial setup.
`;

    const user = `
Organization: ${org_id}
City: ${city || "unknown"}
Category: ${category || "general"}
Event date: ${event_date || "TBD"}
Constraints: 3–4 tiers, include one entry-level option and one premium/VIP option.
`.trim();

    // JSON-mode completion
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ error: `OpenAI error: ${errText}` }, 500);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { tiers: [] };
    }

    // Guardrail: coerce to minimal shape
    const tiers = Array.isArray(parsed?.tiers) ? parsed.tiers.slice(0, 4).map((t: any) => ({
      name: String(t?.name ?? 'General Admission'),
      price: Number.isFinite(+t?.price) ? Number(t.price) : 20,
      badge: (t?.badge || 'GA').toString().slice(0, 8),
      quantity: Number.isFinite(+t?.quantity) ? Math.max(1, Math.floor(+t.quantity)) : 100,
    })) : [];

    return json({ tiers, notes: parsed?.notes ?? '' });
  } catch (e: any) {
    console.error('[ai-event-recommendations] error:', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}