// Enhanced send-purchase-confirmation.ts — Deno Edge Function
// Key upgrades: strong validation (zod), structured logging, sane CORS, fetch timeouts + retries,
// safer HTML email, optional text fallback, List-Unsubscribe headers, reusable clients, and clearer types.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import React from "https://esm.sh/react@18.3.1";
import { renderToStaticMarkup } from "https://esm.sh/react-dom@18.3.1/server";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * ---------------------------
 * Environment & Constants
 * ---------------------------
 */
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Fail fast if env is missing — helps during deploys
if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables.");
  throw new Error("Missing required environment variables for email function.");
}

// Prefer a pinned list of allowed origins; fall back to "*" if you truly need it.
const ALLOWED_ORIGINS = new Set([
  "https://yardpass.tech",
  "https://www.yardpass.tech",
  "http://localhost:5173", // dev
]);

function cors(origin: string | null): HeadersInit {
  const allowAll = !origin || !ALLOWED_ORIGINS.has(origin);
  return {
    "Access-Control-Allow-Origin": allowAll ? "*" : origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/**
 * ---------------------------
 * Types & Validation (Zod)
 * ---------------------------
 */
const OrgInfoSchema = z.object({
  name: z.string(),
  logoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
});

const EventInfoSchema = z.object({
  title: z.string(),
  date: z.string().optional(),
  location: z.string(),
  venue: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  description: z.string().optional(),
});

const RequestSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  eventTitle: z.string().min(1),
  eventDate: z.string().optional(),
  eventLocation: z.string().default("TBA"),
  ticketType: z.string().default("General Admission"),
  quantity: z.number().int().positive(),
  totalAmount: z.number().int().nonnegative().optional(),
  orderId: z.string().min(1),
  ticketIds: z.array(z.string()).default([]),
  qrCodeUrl: z.string().url().optional(),
  eventId: z.string().optional(),
  orgInfo: OrgInfoSchema.optional(),
  eventInfo: EventInfoSchema.optional(),
  isGuest: z.boolean().optional(),
  userId: z.string().optional(),
});

export type PurchaseConfirmationRequest = z.infer<typeof RequestSchema>;
export type OrgInfo = z.infer<typeof OrgInfoSchema>;
export type EventInfo = z.infer<typeof EventInfoSchema>;

/**
 * ---------------------------
 * Utilities
 * ---------------------------
 */
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function baseUrl(): string {
  // Strip potential /rest/v1 on some setups
  return SUPABASE_URL!.replace("/rest/v1", "");
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number) {
  if (typeof value !== "number") return undefined;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
  } catch {
    return `$${(value / 100).toFixed(2)}`;
  }
}

// Fetch with timeout + basic retry (for flaky email API)
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 10000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(t);
      if (res.ok || res.status < 500) return res; // don't retry 4xx
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    // simple backoff
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetchWithRetry failed");
}

/**
 * ---------------------------
 * Data Access
 * ---------------------------
 */
async function fetchEmailContext(eventId: string): Promise<{ orgInfo?: OrgInfo; eventInfo?: EventInfo }> {
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select(
      `title, start_at, venue, city, cover_image_url, description, owner_context_type, owner_context_id`
    )
    .eq("id", eventId)
    .single();

  if (eventErr || !event) return {};

  const eventInfo: EventInfo = {
    title: event.title,
    date: event.start_at ?? undefined,
    location: event.city || event.venue || "TBA",
    venue: event.venue || undefined,
    coverImageUrl: event.cover_image_url || undefined,
    description: event.description || undefined,
  };

  let orgInfo: OrgInfo | undefined;
  if (event.owner_context_type === "organization" && event.owner_context_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url, handle")
      .eq("id", event.owner_context_id)
      .single();

    if (org) {
      orgInfo = {
        name: org.name,
        logoUrl: org.logo_url ?? undefined,
        websiteUrl: org.handle ? `${baseUrl()}/org/${org.handle}` : undefined,
        supportEmail: "support@yardpass.tech",
      };
    }
  }

  return { orgInfo, eventInfo };
}

/**
 * ---------------------------
 * Email Rendering (React)
 * ---------------------------
 */
function HiddenPreheader({ text }: { text?: string }) {
  if (!text) return null;
  return React.createElement(
    "div",
    {
      style: {
        display: "none",
        overflow: "hidden",
        lineHeight: "1px",
        maxHeight: 0,
        maxWidth: 0,
        opacity: 0,
        color: "transparent",
        height: "1px",
        width: "1px",
      },
    },
    text,
  );
}

function BaseEmailLayout({ children, orgInfo, preheaderText }: { children: any; orgInfo?: OrgInfo; preheaderText?: string }) {
  const logoUrl = orgInfo?.logoUrl || `${baseUrl()}/yardpass-logo.png`;
  const supportEmail = orgInfo?.supportEmail || "support@yardpass.tech";
  const currentYear = new Date().getFullYear();

  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "head",
      {},
      React.createElement("meta", { charSet: "utf-8" }),
      React.createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }),
      React.createElement("meta", { httpEquiv: "X-UA-Compatible", content: "IE=edge" }),
      React.createElement("meta", { name: "x-apple-disable-message-reformatting" }),
      React.createElement("meta", { name: "format-detection", content: "telephone=no, date=no, address=no, email=no" }),
      React.createElement(
        "style",
        { type: "text/css" },
        `body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}@media only screen and (max-width:640px){.email-container{max-width:100%!important;margin:0!important;border-radius:0!important}.email-padding{padding:20px!important}.email-header-padding{padding:16px 20px!important}.email-footer-padding{padding:20px!important}.responsive-img{max-width:100%!important;height:auto!important}.responsive-text{font-size:14px!important;line-height:1.5!important}.responsive-title{font-size:22px!important}.responsive-button{width:100%!important;display:block!important}.hide-mobile{display:none!important;max-height:0!important;overflow:hidden!important}}@media only screen and (max-width:480px){.responsive-table{width:100%!important}.responsive-title{font-size:20px!important}}`,
      ),
      React.createElement("title", {}, orgInfo?.name ? `${orgInfo.name} · YardPass` : "YardPass Ticket Confirmation"),
    ),
    React.createElement(
      "body",
      {
        style: {
          margin: 0,
          padding: 0,
          backgroundColor: "#f4f4f5",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: "#0f172a",
        },
      },
      React.createElement(HiddenPreheader, { text: preheaderText }),
      React.createElement(
        "div",
        { style: { padding: "32px 16px", backgroundColor: "#f4f4f5" } },
        React.createElement(
          "div",
          {
            className: "email-container",
            style: {
              maxWidth: "640px",
              margin: "0 auto",
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 18px 30px rgba(15, 23, 42, 0.08)",
            },
          },
          React.createElement(
            "div",
            {
              className: "email-header-padding",
              style: {
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                padding: "28px 32px",
                textAlign: "center",
              },
            },
            React.createElement("img", {
              src: logoUrl,
              alt: orgInfo?.name || "YardPass",
              style: { height: "60px", maxWidth: "300px", marginBottom: "12px" },
              loading: "eager",
              decoding: "sync",
              onerror: `this.src='${baseUrl()}/yardpass-logo-fallback.png'; this.onerror=null;`,
            }),
            React.createElement(
              "div",
              { style: { fontSize: "13px", color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" } },
              "Powered by YardPass",
            ),
          ),
          // org card
          orgInfo
            ? React.createElement(
                "table",
                {
                  width: "100%",
                  cellPadding: 0,
                  cellSpacing: 0,
                  role: "presentation",
                  style: { borderBottom: "1px solid #e2e8f0", backgroundColor: "#fafafa" },
                },
                React.createElement(
                  "tr",
                  {},
                  React.createElement(
                    "td",
                    { style: { padding: "20px 32px", width: "64px" }, valign: "top" },
                    orgInfo.logoUrl
                      ? React.createElement("img", {
                          src: orgInfo.logoUrl,
                          alt: orgInfo.name,
                          style: { width: "48px", height: "48px", borderRadius: "10px", objectFit: "cover" },
                        })
                      : null,
                  ),
                  React.createElement(
                    "td",
                    { style: { padding: "20px 32px 20px 0" } },
                    React.createElement(
                      "div",
                      { style: { fontSize: "16px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" } },
                      orgInfo.name,
                    ),
                    orgInfo.websiteUrl
                      ? React.createElement(
                          "a",
                          { href: orgInfo.websiteUrl, style: { fontSize: "13px", color: "#6366f1", textDecoration: "none" } },
                          "Visit website →",
                        )
                      : null,
                  ),
                ),
              )
            : null,
          React.createElement("div", { className: "email-padding", style: { padding: "32px" } }, children),
          React.createElement(
            "div",
            {
              className: "email-footer-padding",
              style: { backgroundColor: "#f8fafc", padding: "24px 32px", borderTop: "1px solid #e2e8f0" },
            },
            React.createElement(
              "div",
              { style: { textAlign: "center", color: "#64748b", fontSize: "13px", lineHeight: 1.6 } },
              React.createElement(
                "p",
                { style: { margin: "0 0 8px 0" } },
                "Questions? Contact us at ",
                React.createElement(
                  "a",
                  { href: `mailto:${orgInfo?.supportEmail || "support@yardpass.tech"}`, style: { color: "#6366f1", textDecoration: "none" } },
                  orgInfo?.supportEmail || "support@yardpass.tech",
                ),
              ),
              React.createElement("p", { style: { margin: "0 0 16px 0", fontSize: "12px" } }, `© ${currentYear} YardPass. All rights reserved.`),
              React.createElement(
                "div",
                { style: { fontSize: "11px", color: "#94a3b8" } },
                React.createElement("a", { href: `${baseUrl()}/privacy`, style: { color: "#94a3b8", textDecoration: "none", margin: "0 8px" } }, "Privacy Policy"),
                " • ",
                React.createElement("a", { href: `${baseUrl()}/terms`, style: { color: "#94a3b8", textDecoration: "none", margin: "0 8px" } }, "Terms of Service"),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function PurchaseConfirmationTemplate({ data, orgInfo, eventInfo }: { data: PurchaseConfirmationRequest; orgInfo?: OrgInfo; eventInfo?: EventInfo }) {
  const title = eventInfo?.title || data.eventTitle;
  const preheaderText = `Your tickets for ${title} are confirmed. Access them anytime with YardPass.`;
  const formattedDate = formatDate(eventInfo?.date || data.eventDate);
  const formattedTotal = formatCurrency(data.totalAmount);

  return React.createElement(
    BaseEmailLayout,
    { orgInfo, preheaderText },
    React.createElement(
      "div",
      { style: { background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", padding: "24px", borderRadius: "14px", marginBottom: "28px", textAlign: "center" } },
      React.createElement("div", { style: { fontSize: "32px", marginBottom: "8px" } }, "🎉"),
      React.createElement("h1", { style: { margin: 0, fontSize: "26px", fontWeight: 700 } }, "Purchase Confirmed!"),
      React.createElement("p", { style: { margin: "10px 0 0 0", fontSize: "15px", opacity: 0.95 } }, "Your tickets are ready to scan at the door."),
    ),
    eventInfo?.coverImageUrl
      ? React.createElement(
          "div",
          { style: { marginBottom: "28px", borderRadius: "16px", overflow: "hidden" } },
          React.createElement("img", { src: eventInfo.coverImageUrl, alt: title, style: { width: "100%", height: "auto", display: "block" } }),
        )
      : null,
    React.createElement(
      "div",
      { style: { marginBottom: "24px" } },
      data.isGuest
        ? React.createElement(
            "div",
            {},
            React.createElement("h2", { style: { margin: "0 0 12px 0", color: "#0f172a", fontSize: "20px", fontWeight: 600 } }, "🎉 Your Tickets Are Ready!"),
            React.createElement(
              "p",
              { style: { margin: "0 0 16px 0", color: "#475569", fontSize: "15px", lineHeight: 1.6 } },
              "Thank you for your purchase! Your tickets for ",
              React.createElement("strong", {}, title),
              " have been confirmed and are ready to use.",
            ),
            React.createElement(
              "div",
              { style: { backgroundColor: "#f0f9ff", border: "1px solid #0ea5e9", borderRadius: "12px", padding: "16px", marginBottom: "16px" } },
              React.createElement("h3", { style: { margin: "0 0 8px 0", color: "#0c4a6e", fontSize: "16px", fontWeight: 600 } }, "🚀 Get the Best Experience"),
              React.createElement(
                "p",
                { style: { margin: "0 0 12px 0", color: "#075985", fontSize: "14px", lineHeight: 1.5 } },
                "Create a free YardPass account to manage your tickets, get event updates, and discover amazing events in your area.",
              ),
              React.createElement(
                "a",
                { href: `${baseUrl()}/auth/signup?email=${encodeURIComponent(data.customerEmail)}`, style: { display: "inline-block", backgroundColor: "#0ea5e9", color: "white", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontSize: "14px", fontWeight: 600 } },
                "Create Free Account",
              ),
            ),
          )
        : React.createElement(
            "div",
            {},
            React.createElement("h2", { style: { margin: "0 0 12px 0", color: "#0f172a", fontSize: "20px", fontWeight: 600 } }, `Hi ${data.customerName} 👋`),
            React.createElement(
              "p",
              { style: { margin: 0, color: "#475569", fontSize: "15px", lineHeight: 1.6 } },
              "Thank you for your purchase! Your tickets for ",
              React.createElement("strong", {}, title),
              " have been confirmed and are ready to use.",
            ),
          ),
    ),
    React.createElement(
      "div",
      { style: { backgroundColor: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginBottom: "20px" } },
      React.createElement("h3", { style: { margin: "0 0 16px 0", color: "#0f172a", fontSize: "17px", fontWeight: 600 } }, "📅 Event Details"),
      React.createElement(
        "table",
        { width: "100%", cellPadding: 0, cellSpacing: 0, role: "presentation" },
        React.createElement(
          "tbody",
          {},
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#64748b", width: "35%" } }, "Event"), React.createElement("td", { style: { padding: "6px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, title)),
          formattedDate ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#64748b" } }, "Date & Time"), React.createElement("td", { style: { padding: "6px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, formattedDate)) : null,
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#64748b" } }, "Location"), React.createElement("td", { style: { padding: "6px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, eventInfo?.venue || eventInfo?.location || data.eventLocation)),
          eventInfo?.venue && eventInfo.location && eventInfo.location !== eventInfo.venue ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#64748b" } }, "City"), React.createElement("td", { style: { padding: "6px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, eventInfo.location)) : null,
          eventInfo?.description ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#64748b", verticalAlign: "top" } }, "About"), React.createElement("td", { style: { padding: "6px 0", fontSize: "14px", color: "#475569", lineHeight: 1.6 } }, eventInfo.description)) : null,
        ),
      ),
    ),
    React.createElement(
      "div",
      { style: { backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "14px", padding: "20px", marginBottom: "20px" } },
      React.createElement("h3", { style: { margin: "0 0 16px 0", color: "#0c4a6e", fontSize: "17px", fontWeight: 600 } }, "🎟️ Your Tickets"),
      React.createElement(
        "table",
        { width: "100%", cellPadding: 0, cellSpacing: 0, role: "presentation" },
        React.createElement(
          "tbody",
          {},
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#075985" } }, "Ticket Type"), React.createElement("td", { style: { padding: "6px 0", fontSize: "15px", color: "#0c4a6e", fontWeight: 600, textAlign: "right" } }, data.ticketType)),
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "13px", color: "#075985" } }, "Quantity"), React.createElement("td", { style: { padding: "6px 0", fontSize: "18px", color: "#0c4a6e", fontWeight: 700, textAlign: "right" } }, `×${data.quantity}`)),
          formattedTotal ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "12px 0 6px 0", fontSize: "15px", color: "#0c4a6e", fontWeight: 500 } }, "Total Paid"), React.createElement("td", { style: { padding: "12px 0 6px 0", fontSize: "20px", color: "#0c4a6e", fontWeight: 700, textAlign: "right" } }, formattedTotal)) : null,
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "6px 0", fontSize: "12px", color: "#075985" } }, "Order ID"), React.createElement("td", { style: { padding: "6px 0", fontSize: "12px", color: "#075985", fontFamily: "monospace", textAlign: "right" } }, data.orderId)),
        ),
      ),
      React.createElement("p", { style: { margin: "16px 0 0 0", fontSize: "13px", color: "#0369a1", lineHeight: 1.6 } }, "Need to transfer tickets to a guest? Forward this email or share access from your YardPass account."),
    ),
    data.qrCodeUrl
      ? React.createElement(
          "div",
          { style: { backgroundColor: "#ffffff", border: "2px dashed #cbd5e1", borderRadius: "14px", padding: "24px", marginBottom: "28px", textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "15px", color: "#0f172a", fontWeight: 600, marginBottom: "16px" } }, "Your Entry Pass"),
          React.createElement("img", { src: data.qrCodeUrl, alt: "Entry QR Code", style: { maxWidth: "200px", height: "auto", display: "block", margin: "0 auto", border: "3px solid #0f172a", borderRadius: "12px", padding: "10px", backgroundColor: "#ffffff" } }),
          React.createElement("p", { style: { margin: "16px 0 0 0", fontSize: "13px", color: "#64748b" } }, "Present this QR code at check-in. Each ticket will also be available in the YardPass app."),
        )
      : null,
    React.createElement(
      "div",
      { style: { textAlign: "center", marginBottom: "28px" } },
      React.createElement(
        "a",
        { href: `${baseUrl()}/tickets`, style: { display: "inline-block", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#ffffff", padding: "14px 36px", textDecoration: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 600, boxShadow: "0 12px 24px rgba(79, 70, 229, 0.25)" } },
        "View My Tickets →",
      ),
    ),
    React.createElement(
      "div",
      { style: { backgroundColor: "#fefce8", border: "1px solid #fde047", borderRadius: "14px", padding: "20px" } },
      React.createElement("h3", { style: { margin: "0 0 12px 0", color: "#713f12", fontSize: "16px", fontWeight: 600 } }, "✨ Helpful Tips"),
      React.createElement(
        "ul",
        { style: { margin: 0, paddingLeft: "20px", color: "#854d0e", fontSize: "14px", lineHeight: 1.8 } },
        React.createElement("li", {}, "Add this event to your calendar and plan your arrival."),
        React.createElement("li", {}, "Bring a valid ID and have your QR code ready for scanning."),
        React.createElement("li", {}, "Save this email for easy access to your tickets and order details."),
      ),
    ),
  );
}

/**
 * Optional HTML Ticket attachment generator preserved from original version.
 * Consider moving this to a background job / webhook for very large orders.
 */
async function generateTicketHTML(ticketIds: string[], eventTitle: string, customerName: string) {
  const { data: tickets } = await supabase
    .from("tickets")
    .select(`id, qr_code, ticket_tiers(name, price_cents), events(title, start_at, venue, city, address)`) // deno-fmt-ignore
    .in("id", ticketIds);

  if (!tickets || tickets.length === 0) {
    throw new Error("No tickets found");
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${eventTitle} - Your Tickets</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:20px;line-height:1.6}.container{max-width:800px;margin:0 auto}.header{background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;padding:30px;text-align:center;border-radius:16px 16px 0 0}.header h1{font-size:28px;margin-bottom:8px}.header p{opacity:.9;font-size:16px}.ticket{background:#fff;border:3px solid #10b981;border-radius:16px;margin:20px 0;overflow:hidden;page-break-inside:avoid;box-shadow:0 4px 6px rgba(0,0,0,.1)}.ticket-header{background:#10b981;color:#fff;padding:20px;text-align:center}.ticket-header h2{font-size:22px;margin-bottom:5px}.ticket-body{padding:25px}.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin:20px 0}.info-item{padding:12px;background:#f9fafb;border-radius:8px}.info-label{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}.info-value{font-size:16px;font-weight:600;color:#111827}.qr-section{text-align:center;padding:30px;background:#f9fafb;border-radius:12px;margin:20px 0}.qr-code{display:inline-block;background:#fff;padding:25px;border:4px solid #10b981;border-radius:12px;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:4px;color:#111827;margin:15px 0}.qr-instructions{font-size:14px;color:#6b7280;margin-top:15px}.footer{text-align:center;padding:20px;color:#6b7280;font-size:13px;border-top:2px dashed #e5e7eb;margin-top:20px}@media print{body{background:#fff;padding:0}.ticket{page-break-inside:avoid;margin:0 0 40px 0}}</style></head><body><div class="container"><div class="header"><h1>🎟️ ${eventTitle}</h1><p>Tickets for ${customerName}</p></div>${tickets
    .map((ticket: any, index: number) => {
      const eventDate = new Date(ticket.events?.start_at || Date.now());
      return `<div class="ticket"><div class="ticket-header"><h2>Ticket #${index + 1} of ${tickets.length}</h2><p>${ticket.ticket_tiers?.name || "General Admission"}</p></div><div class="ticket-body"><div class="info-grid"><div class="info-item"><div class="info-label">Ticket Holder</div><div class="info-value">${customerName}</div></div><div class="info-item"><div class="info-label">Ticket Type</div><div class="info-value">${ticket.ticket_tiers?.name || "General Admission"}</div></div><div class="info-item"><div class="info-label">Event Date</div><div class="info-value">${eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div></div><div class="info-item"><div class="info-label">Event Time</div><div class="info-value">${eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div></div></div>${
        ticket.events?.venue || ticket.events?.address
          ? `<div class="info-item" style="margin:15px 0"><div class="info-label">Location</div><div class="info-value">${
              ticket.events?.venue || ""
            }</div>${ticket.events?.address ? `<div style="font-size:14px;color:#6b7280;margin-top:4px">${ticket.events.address}</div>` : ""}</div>`
          : ""
      }<div class="qr-section"><div style="font-size:18px;font-weight:600;color:#111827;margin-bottom:10px">📱 Entry Code</div><div class="qr-code">${ticket.qr_code}</div><div class="qr-instructions"><strong>Present this code at check-in</strong><br/>Keep this ticket safe and do not share screenshots</div></div><div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:15px;font-family:monospace">Ticket ID: ${
        (ticket.id as string).slice(0, 8)
      }</div></div></div>`;
    })
    .join("")}<div class="footer"><strong>YardPass</strong><br/>For support, visit yardpass.tech or email support@yardpass.tech<br/>This ticket is valid for entry and cannot be duplicated.</div></div></body></html>`;

  return {
    content: btoa(unescape(encodeURIComponent(html))),
    filename: `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Tickets.html`,
    type: "text/html",
    disposition: "attachment",
  } as const;
}

/**
 * ---------------------------
 * HTTP Handler
 * ---------------------------
 */
const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const requestId = crypto.randomUUID();

  try {
    const raw = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("❗ Validation failed", { requestId, issues: parsed.error.flatten() });
      return new Response(JSON.stringify({ error: "Invalid payload", details: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = parsed.data;
    const isGuest = data.isGuest ?? (!data.userId || data.customerName === "User");

    // Hydrate context if needed
    let orgInfo = data.orgInfo;
    let eventInfo = data.eventInfo;
    if (data.eventId && (!orgInfo || !eventInfo)) {
      const context = await fetchEmailContext(data.eventId);
      orgInfo = orgInfo || context.orgInfo;
      eventInfo = eventInfo || context.eventInfo;
    }

    // Prepare optional attachment for guest checkouts
    let ticketAttachment: { filename: string; content: string; content_type: string; disposition: string } | undefined;
    if (isGuest && data.ticketIds?.length) {
      try {
        const a = await generateTicketHTML(data.ticketIds, eventInfo?.title || data.eventTitle, data.customerName);
        ticketAttachment = { filename: a.filename, content: a.content, content_type: a.type, disposition: a.disposition } as const;
      } catch (err) {
        console.error("Attachment generation failed", { requestId, err });
      }
    }

    // Render HTML and a small text fallback for spam filters/clients
    const html = "<!DOCTYPE html>" + renderToStaticMarkup(
      React.createElement(PurchaseConfirmationTemplate, { data: { ...data, isGuest }, orgInfo, eventInfo }),
    );
    const text = `Purchase Confirmed\n\nEvent: ${eventInfo?.title || data.eventTitle}\nWhen: ${formatDate(eventInfo?.date || data.eventDate) || "TBA"}\nWhere: ${eventInfo?.venue || eventInfo?.location || data.eventLocation}\nTicket Type: ${data.ticketType}\nQuantity: ${data.quantity}\nOrder ID: ${data.orderId}\n\nView your tickets: ${baseUrl()}/tickets`;

    // Support idempotency — callers can pass Idempotency-Key header
    const idemKey = req.headers.get("Idempotency-Key") ?? requestId;

    const emailPayload: Record<string, unknown> = {
      from: orgInfo?.name ? `${orgInfo.name} via YardPass <hello@yardpass.tech>` : "YardPass <hello@yardpass.tech>",
      to: [data.customerEmail],
      subject: `✅ Ticket Confirmation - ${eventInfo?.title || data.eventTitle}`,
      html,
      text,
      reply_to: orgInfo?.supportEmail || "support@yardpass.tech",
      headers: {
        "X-Entity-Ref-ID": idemKey, // many ESPs use this for idempotency
        "List-Unsubscribe": `<mailto:${orgInfo?.supportEmail || "support@yardpass.tech"}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "type", value: "purchase_confirmation" },
        { name: "env", value: Deno.env.get("DENO_DEPLOYMENT_ID") ? "prod" : "dev" },
      ],
    };

    if (ticketAttachment) {
      (emailPayload as any).attachments = [ticketAttachment];
    }

    const res = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error", { requestId, status: res.status, body });
      return new Response(JSON.stringify({ error: "Email provider error", status: res.status }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = await res.json();
    console.log("✅ Purchase confirmation sent", { requestId, payload });

    return new Response(JSON.stringify({ success: true, requestId, ...payload }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error in send-purchase-confirmation", { requestId, error });
    return new Response(JSON.stringify({ error: "Internal error", requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
