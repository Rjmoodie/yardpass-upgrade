// Legacy exports for existing functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
}

export function createResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function createErrorResponse(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// New withCORS wrapper for cleaner function definitions
type WithCORSOpts = { allowOrigins?: string[] };

export function withCORS(
  handler: (req: Request) => Promise<Response>,
  opts: WithCORSOpts = {},
) {
  return async (req: Request) => {
    const origin = req.headers.get("Origin") || "";
    
    // Determine which origin to allow
    let allowOrigin = "*";
    if (opts.allowOrigins?.length) {
      const isAllowed = opts.allowOrigins.some(allowed => {
        if (allowed === origin) return true;
        // Support wildcard patterns like *.yardpass.com
        if (allowed.includes("*")) {
          const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return false;
      });
      
      allowOrigin = isAllowed ? origin : "*";
    }

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, headers });
  };
}