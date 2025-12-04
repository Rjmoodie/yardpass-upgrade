// Enhanced send-purchase-confirmation.ts — Deno Edge Function
// Key upgrades: strong validation (zod), structured logging, sane CORS, fetch timeouts + retries,
// safer HTML email, optional text fallback, List-Unsubscribe headers, reusable clients, and clearer types.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import React from "https://esm.sh/react@18.3.1";
import { renderToStaticMarkup } from "https://esm.sh/react-dom@18.3.1/server";
import { z } from "https://esm.sh/zod@3.23.8";
import QRCode from "npm:qrcode@1.5.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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
  "https://liventix.tech",
  "https://www.liventix.tech",
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
  slug: z.string().optional(),
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
  isRsvpOnly: z.boolean().optional(), // ✅ Flag for RSVP-only confirmations (no tickets)
  rsvpCount: z.number().int().nonnegative().optional(), // ✅ Number of RSVPs
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
  // Return the actual app URL, not Supabase URL
  const appUrl = Deno.env.get("APP_URL") || Deno.env.get("VITE_APP_URL");
  if (appUrl) {
    return appUrl;
  }
  
  // Fallback to production domain
  return "https://liventix.tech";
}

function getLogoUrl(): string {
  // Liventix logo from Supabase Storage (displayed at 60px for crisp retina rendering)
  // Logo without spaces in filename for better email client compatibility
  return 'https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/Liventix%20Official/org-images/logo.png';
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
      `title, start_at, venue, city, cover_image_url, description, slug, owner_context_type, owner_context_id`
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
    slug: event.slug || undefined,
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
        supportEmail: "support@liventix.tech",
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

function BaseEmailLayout({ children, orgInfo, eventInfo, preheaderText }: { children: any; orgInfo?: OrgInfo; eventInfo?: EventInfo; preheaderText?: string }) {
  const supportEmail = orgInfo?.supportEmail || "support@liventix.tech";
  const currentYear = new Date().getFullYear();
  const homepageUrl = baseUrl(); // Always use Liventix homepage
  const logoUrl = getLogoUrl(); // Always use Liventix logo only (small, neat size)

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
        `body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-wrap:break-word}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;width:100%!important}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;max-width:100%!important}td,th{padding:8px;word-wrap:break-word}*{box-sizing:border-box}.responsive-banner{width:100%!important;max-width:100%!important}.mobile-card{padding:16px!important;margin-bottom:16px!important}.mobile-text{font-size:14px!important;line-height:1.6!important}.mobile-title{font-size:18px!important;line-height:1.3!important}.mobile-button{width:100%!important;max-width:100%!important;display:block!important;padding:14px 20px!important;font-size:16px!important;margin:8px 0!important}@media only screen and (max-width:640px){body{padding:0!important}.email-container{max-width:100%!important;width:100%!important;margin:0!important;border-radius:0!important}.email-padding{padding:20px 16px!important}.email-header-padding{padding:20px 16px!important}.email-footer-padding{padding:20px 16px!important}.responsive-img{max-width:100%!important;height:auto!important;display:block!important}.responsive-text{font-size:14px!important;line-height:1.6!important}.responsive-title{font-size:22px!important;line-height:1.3!important}.responsive-banner{padding:24px 16px!important;margin-bottom:20px!important}.responsive-banner h1{font-size:24px!important;line-height:1.2!important}.responsive-banner p{font-size:15px!important}.responsive-button{width:100%!important;max-width:100%!important;display:block!important;padding:14px 20px!important;font-size:16px!important;margin:8px 0!important}.hide-mobile{display:none!important;max-height:0!important;overflow:hidden!important;mso-hide:all}table[class="responsive-table"]{width:100%!important}td[class="responsive-table"]{display:block!important;width:100%!important;text-align:left!important;padding:10px 0!important}table[class="mobile-stack"]{width:100%!important}table[class="mobile-stack"] td{display:block!important;width:100%!important;text-align:left!important;padding:6px 0!important}table[class="mobile-stack"] td:first-child{font-weight:600!important;color:#64748b!important;font-size:12px!important;text-transform:uppercase!important;letter-spacing:0.5px!important}.mobile-card{padding:16px!important;margin-bottom:16px!important;border-radius:12px!important}.mobile-card h3{font-size:16px!important;margin:0 0 12px 0!important}.mobile-card table td{font-size:14px!important;padding:6px 0!important}}@media only screen and (max-width:480px){.email-padding{padding:16px 12px!important}.email-header-padding{padding:16px 12px!important}.email-footer-padding{padding:16px 12px!important}.responsive-title{font-size:20px!important}.responsive-text{font-size:13px!important}.responsive-banner{padding:20px 14px!important;margin-bottom:18px!important}.responsive-banner h1{font-size:22px!important;line-height:1.2!important}.responsive-banner p{font-size:14px!important}.responsive-button{font-size:15px!important;padding:12px 18px!important}img[class="logo"]{max-width:200px!important;height:auto!important}.mobile-card{padding:14px!important;margin-bottom:14px!important}.mobile-card h3{font-size:15px!important}.mobile-card table td{font-size:13px!important}}@media only screen and (min-width:641px){.email-container{max-width:640px!important}}@media only screen and (max-width:320px){.responsive-title{font-size:18px!important}.responsive-text{font-size:12px!important}.responsive-banner h1{font-size:20px!important;line-height:1.2!important}.responsive-banner{padding:16px 12px!important}.responsive-banner p{font-size:13px!important}.mobile-card{padding:12px!important}}`,
      ),
      React.createElement("title", {}, orgInfo?.name ? `${orgInfo.name} · Liventix` : "Liventix Ticket Confirmation"),
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
                backgroundColor: "#fafafa",
                border: "1px solid #e2e8f0",
                padding: "28px 32px",
                textAlign: "center",
                borderRadius: "20px 20px 0 0",
                position: "relative",
              },
            },
            React.createElement(
              "table",
              { width: "100%", cellPadding: 0, cellSpacing: 0, role: "presentation" },
              React.createElement(
                "tbody",
                {},
                React.createElement(
                  "tr",
                  {},
                  React.createElement(
                    "td",
                    { style: { textAlign: "center", verticalAlign: "middle" } },
                    React.createElement(
                      "a",
                      { href: homepageUrl, style: { textDecoration: "none", display: "inline-block" } },
                      // Logo image - centered, width only, height auto for natural aspect ratio
                      React.createElement("img", {
                        src: logoUrl,
                        alt: "Liventix",
                        width: "100",
                        style: { 
                          width: "100px", 
                          height: "auto",
                          maxWidth: "100%",
                          display: "block",
                          border: "0",
                          outline: "none",
                          textDecoration: "none",
                          margin: "0 auto",
                          padding: "0",
                          borderRadius: "12px",
                        },
                        loading: "eager",
                        decoding: "sync",
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Event details link (if available)
          eventInfo?.slug
            ? React.createElement(
                "div",
                {
                  style: {
                    padding: "16px 32px",
                    backgroundColor: "#fafafa",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "center",
                  },
                },
                React.createElement(
                  "a",
                  {
                    href: `${baseUrl()}/e/${eventInfo.slug}`,
                    style: {
                      fontSize: "13px",
                      color: "#6366f1",
                      textDecoration: "none",
                      fontWeight: "500",
                    },
                  },
                  "View Event Details →",
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
                  { href: `mailto:${orgInfo?.supportEmail || "support@liventix.tech"}`, style: { color: "#6366f1", textDecoration: "none" } },
                  orgInfo?.supportEmail || "support@liventix.tech",
                ),
              ),
              React.createElement("p", { style: { margin: "0 0 16px 0", fontSize: "12px" } }, `© ${currentYear} Liventix. All rights reserved.`),
              React.createElement(
                "div",
                { style: { fontSize: "11px", color: "#94a3b8" } },
                React.createElement("a", { href: "https://liventix.tech/privacy", style: { color: "#94a3b8", textDecoration: "none", margin: "0 8px" } }, "Privacy Policy"),
                " • ",
                React.createElement("a", { href: "https://liventix.tech/terms", style: { color: "#94a3b8", textDecoration: "none", margin: "0 8px" } }, "Terms of Service"),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function PurchaseConfirmationTemplate({ data, orgInfo, eventInfo, ticketPdfUrl, onlineTicketPortalUrl }: { 
  data: PurchaseConfirmationRequest; 
  orgInfo?: OrgInfo; 
  eventInfo?: EventInfo;
  ticketPdfUrl?: string;
  onlineTicketPortalUrl?: string;
}) {
  const title = eventInfo?.title || data.eventTitle;
  const isRsvp = data.isRsvpOnly || false;
  const preheaderText = isRsvp
    ? `Your RSVP for ${title} is confirmed. See you there!`
    : `View your tickets, download the PDF, and see all event details for ${formatDate(eventInfo?.date || data.eventDate) || "TBA"} in ${eventInfo?.location || data.eventLocation}.`;
  const formattedDate = formatDate(eventInfo?.date || data.eventDate);
  const formattedTotal = formatCurrency(data.totalAmount);
  
  // Parse date for human-readable formatting
  const eventDateObj = eventInfo?.date || data.eventDate ? new Date(eventInfo?.date || data.eventDate || Date.now()) : null;
  const eventDateHuman = eventDateObj ? eventDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : formattedDate;
  const eventTimeHuman = eventDateObj ? eventDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : undefined;
  const eventTimezone = eventDateObj ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  
  // Generate URLs if not provided
  const pdfUrl = ticketPdfUrl || (data.orderId ? `${baseUrl()}/tickets/download/${data.orderId}` : undefined);
  const portalUrl = onlineTicketPortalUrl || `${baseUrl()}/tickets`;
  const calendarUrl = eventDateObj ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${eventDateObj.toISOString().replace(/[-:]/g, '').split('.')[0]}Z%2F${new Date(eventDateObj.getTime() + 3 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(`${title} at ${eventInfo?.venue || data.eventLocation}`)}&location=${encodeURIComponent(eventInfo?.venue || data.eventLocation)}` : undefined;
  const transferUrl = `${baseUrl()}/tickets/transfer/${data.orderId}`;

  // Skip PDF-first hero for RSVP-only
  if (isRsvp) {
    return React.createElement(
      BaseEmailLayout,
      { orgInfo, eventInfo, preheaderText },
      // RSVP version (simplified)
      React.createElement(
        "div",
        { style: { background: "linear-gradient(135deg, #03A9F4 0%, #0288D1 100%)", color: "#ffffff", padding: "24px", borderRadius: "14px", marginBottom: "28px", textAlign: "center" } },
        React.createElement("div", { style: { fontSize: "32px", marginBottom: "8px" } }, "✅"),
        React.createElement("h1", { style: { margin: 0, fontSize: "26px", fontWeight: 700 } }, "RSVP Confirmed!"),
        React.createElement("p", { style: { margin: "10px 0 0 0", fontSize: "15px", opacity: 0.95 } }, "You're all set! No ticket required."),
      ),
      React.createElement(
        "div",
        { style: { marginBottom: "24px" } },
        React.createElement("h2", { style: { margin: "0 0 12px 0", color: "#0f172a", fontSize: "20px", fontWeight: 600 } }, `Hi ${data.customerName} 👋`),
        React.createElement("p", { style: { margin: 0, color: "#475569", fontSize: "15px", lineHeight: 1.6 } }, `Thank you for your RSVP! You're confirmed for ${title}. Just show up and enjoy!`),
      ),
      // Event details and other sections for RSVP...
    );
  }

  // Full purchase confirmation template (PDF-first approach)
  return React.createElement(
    BaseEmailLayout,
    { orgInfo, eventInfo, preheaderText },
    // 1. CONFIRMATION HERO (PDF-first)
    React.createElement(
      "div",
      { className: "responsive-banner", style: { background: "linear-gradient(135deg, #007bff 0%, #0056b3 100%)", color: "#ffffff", padding: "32px 24px", borderRadius: "14px", marginBottom: "28px", textAlign: "center" } },
      React.createElement("div", { style: { fontSize: "40px", marginBottom: "12px" } }, "🎉"),
      React.createElement("h1", { style: { margin: "0 0 8px 0", fontSize: "28px", fontWeight: 700 } }, "Purchase Confirmed!"),
      React.createElement("p", { style: { margin: "0 0 24px 0", fontSize: "16px", opacity: 0.95 } }, `Your tickets to ${title} are confirmed and ready to scan at the door. Your ticket PDF is attached to this email.`),
    ),
    // 2. PERSONALIZED GREETING
    React.createElement(
      "div",
      { style: { marginBottom: "24px" } },
      React.createElement("h2", { style: { margin: "0 0 12px 0", color: "#0f172a", fontSize: "20px", fontWeight: 600 } }, `Hi ${data.customerName} 👋`),
      React.createElement(
        "p",
        { style: { margin: 0, color: "#475569", fontSize: "15px", lineHeight: 1.6 } },
        "Thank you for your purchase! Your tickets for ",
        React.createElement("strong", {}, title),
        " have been confirmed and are ready to use.",
      ),
    ),
    // 3. EVENT SNAPSHOT CARD
    React.createElement(
      "div",
      { className: "mobile-card", style: { backgroundColor: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginBottom: "20px" } },
      eventInfo?.coverImageUrl
        ? React.createElement(
            "div",
            { style: { marginBottom: "16px", borderRadius: "12px", overflow: "hidden" } },
            React.createElement("img", { src: eventInfo.coverImageUrl, alt: title, className: "responsive-img", style: { width: "100%", height: "auto", display: "block" } }),
          )
        : null,
      React.createElement(
        "table",
        { className: "mobile-stack", width: "100%", cellPadding: 0, cellSpacing: 0, role: "presentation" },
        React.createElement(
          "tbody",
          {},
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "13px", color: "#64748b", width: "35%" } }, "Event"), React.createElement("td", { style: { padding: "8px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, title)),
          eventDateHuman ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "13px", color: "#64748b" } }, "Date & Time"), React.createElement("td", { style: { padding: "8px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, `${eventDateHuman}${eventTimeHuman ? ` · ${eventTimeHuman}` : ""}${eventTimezone ? ` ${eventTimezone}` : ""}`)) : null,
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "13px", color: "#64748b" } }, "Location"), React.createElement("td", { style: { padding: "8px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, eventInfo?.venue || eventInfo?.location || data.eventLocation)),
          eventInfo?.venue && eventInfo.location && eventInfo.location !== eventInfo.venue ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "13px", color: "#64748b" } }, "City"), React.createElement("td", { style: { padding: "8px 0", fontSize: "15px", color: "#0f172a", fontWeight: 500 } }, eventInfo.location)) : null,
        ),
      ),
      calendarUrl ? React.createElement(
        "div",
        { style: { marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" } },
        React.createElement(
          "a",
          { href: calendarUrl, style: { fontSize: "13px", color: "#007bff", textDecoration: "none" } },
          "📅 Add to calendar →",
        ),
      ) : null,
    ),
    // 4. ABOUT THE EVENT (Optional - short description)
    eventInfo?.description ? React.createElement(
      "div",
      { className: "mobile-card", style: { backgroundColor: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginBottom: "20px" } },
      React.createElement("h3", { className: "mobile-title", style: { margin: "0 0 12px 0", color: "#0f172a", fontSize: "17px", fontWeight: 600 } }, "About this event"),
      React.createElement("p", { className: "mobile-text", style: { margin: 0, color: "#475569", fontSize: "14px", lineHeight: 1.6 } }, eventInfo.description.length > 200 ? `${eventInfo.description.substring(0, 200)}...` : eventInfo.description),
    ) : null,
    // 5. TICKET & ORDER SUMMARY
    React.createElement(
      "div",
      { className: "mobile-card", style: { backgroundColor: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginBottom: "20px" } },
      React.createElement("h3", { className: "mobile-title", style: { margin: "0 0 16px 0", color: "#0f172a", fontSize: "17px", fontWeight: 600 } }, "Your Tickets"),
      React.createElement(
        "table",
        { className: "mobile-stack", width: "100%", cellPadding: 0, cellSpacing: 0, role: "presentation" },
        React.createElement(
          "tbody",
          {},
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "13px", color: "#64748b" } }, "Ticket Type"), React.createElement("td", { style: { padding: "8px 0", fontSize: "15px", color: "#0f172a", fontWeight: 600, textAlign: "right" } }, data.ticketType)),
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "13px", color: "#64748b" } }, "Quantity"), React.createElement("td", { style: { padding: "8px 0", fontSize: "18px", color: "#0f172a", fontWeight: 700, textAlign: "right" } }, `×${data.quantity}`)),
          formattedTotal ? React.createElement("tr", {}, React.createElement("td", { style: { padding: "12px 0 8px 0", fontSize: "15px", color: "#64748b", fontWeight: 500 } }, "Total Paid"), React.createElement("td", { style: { padding: "12px 0 8px 0", fontSize: "20px", color: "#0f172a", fontWeight: 700, textAlign: "right" } }, formattedTotal)) : null,
          React.createElement("tr", {}, React.createElement("td", { style: { padding: "8px 0", fontSize: "12px", color: "#64748b" } }, "Order ID"), React.createElement("td", { style: { padding: "8px 0", fontSize: "12px", color: "#64748b", fontFamily: "monospace", textAlign: "right" } }, data.orderId)),
        ),
      ),
    ),
    // 6. HOW TO USE YOUR TICKETS (PDF Flow)
    React.createElement(
      "div",
      { className: "mobile-card", style: { backgroundColor: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginBottom: "20px" } },
      React.createElement("h3", { className: "mobile-title", style: { margin: "0 0 16px 0", color: "#0f172a", fontSize: "17px", fontWeight: 600 } }, "How to use your tickets"),
      React.createElement(
        "ol",
        { className: "mobile-text", style: { margin: 0, paddingLeft: "20px", color: "#475569", fontSize: "14px", lineHeight: 1.8 } },
        React.createElement("li", { style: { marginBottom: "12px" } }, React.createElement("strong", {}, "Your ticket PDF is attached"), " — The PDF file is included with this email. Save it to your device for easy access."),
        React.createElement("li", { style: { marginBottom: "12px" } }, React.createElement("strong", {}, "Bring the QR code"), " — Open the PDF on your phone or print it. The QR code in the PDF will be scanned at check-in."),
        React.createElement("li", { style: { marginBottom: "12px" } }, React.createElement("strong", {}, "Bring a valid ID"), " — Some events may require ID that matches the ticket holder name."),
      ),
    ),
    // 7. IMPORTANT EVENT INFO (Optional - only show if data provided)
    // Note: This section can be populated with doors_time_human, show_time_human, entry_requirements, etc.
    // For now, we'll hide it if there's no specific event metadata available
    // Future enhancement: Add event metadata fields to EventInfo type and populate from database
    null, // Placeholder - can be enhanced with actual event metadata when available
    // 8. HELPFUL TIPS
    React.createElement(
      "div",
      { className: "mobile-card", style: { backgroundColor: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px" } },
      React.createElement("h3", { className: "mobile-title", style: { margin: "0 0 12px 0", color: "#0f172a", fontSize: "16px", fontWeight: 600 } }, "✨ Helpful Tips"),
      React.createElement(
        "ul",
        { className: "mobile-text", style: { margin: 0, paddingLeft: "20px", color: "#475569", fontSize: "14px", lineHeight: 1.8 } },
        React.createElement("li", {}, "Add this event to your calendar so you don't miss it."),
        React.createElement("li", {}, "Arrive a little early to allow time for security and check-in."),
        React.createElement("li", {}, "Bring a valid ID and have your QR code ready for scanning."),
        React.createElement("li", {}, "Save this email for easy access to your tickets and order details."),
      ),
    ),
  );
}

/**
 * Generate QR code as base64 data URL
 */
async function generateQRCodeDataURL(qrCodeText: string): Promise<string> {
  try {
    console.log('Generating QR code for text:', qrCodeText);
    
    // Generate QR code as data URL (base64 encoded PNG)
    const qrDataURL = await QRCode.toDataURL(qrCodeText, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('QR code generated successfully:', {
      textLength: qrCodeText.length,
      dataURLLength: qrDataURL.length,
      isValidDataURL: qrDataURL.startsWith('data:image/png;base64,')
    });
    
    return qrDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error, { qrCodeText });
    // Return a fallback empty image data URL
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}

/**
 * Generate PDF ticket attachment with QR codes
 */
async function generateTicketPDF(ticketIds: string[], eventTitle: string, customerName: string, orgInfo?: OrgInfo) {
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(`id, qr_code, serial_no, ticket_tiers!tickets_tier_id_fkey(name, price_cents), events!tickets_event_id_fkey(title, start_at, venue, city, address)`)
    .in("id", ticketIds);

  if (error) {
    console.error("Supabase error in generateTicketPDF", { error, ticketIds });
    throw error;
  }
  if (!tickets || tickets.length === 0) {
    console.error("No tickets found for ids", { ticketIds, attemptedQuery: "tickets.in('id', ticketIds)" });
    throw new Error("No tickets found");
  }

  // Generate QR codes for all tickets
  const ticketsWithQR = await Promise.all(
    tickets.map(async (ticket: any) => ({
      ...ticket,
      qrDataURL: await generateQRCodeDataURL(ticket.qr_code)
    }))
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Liventix Brand Colors - Blue Theme Only
  const primaryBlue = [3, 169, 244];     // #03A9F4 - Liventix Blue
  const lightBlue = [129, 212, 250];     // #81D4FA - Light blue (highlights)
  const darkBlue = [2, 136, 209];        // #0288D1 - Dark blue (accents)
  const mutedGray = [151, 148, 165];     // #9794A5 - Muted gray
  const lightNeutral = [230, 237, 242];  // #E6EDF2 - Light neutral background
  const textColor = [15, 23, 42];        // Dark text

  ticketsWithQR.forEach((ticket: any, index: number) => {
    if (index > 0) doc.addPage();

    const eventDate = new Date(ticket.events?.start_at || Date.now());
    const tierName = ticket.ticket_tiers?.name || "General Admission";
    const venue = ticket.events?.venue || "TBA";
    const address = ticket.events?.address || "";

    // Header with gradient effect (blue)
    doc.setFillColor(...primaryBlue);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Dark blue accent stripe
    doc.setFillColor(...darkBlue);
    doc.rect(0, 40, 210, 3, 'F');
    
    // Organization/Platform name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Liventix', 105, 15, { align: 'center' });
    
    // Event title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(eventTitle, 105, 25, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`Ticket ${index + 1} of ${ticketsWithQR.length}`, 105, 33, { align: 'center' });

    // Ticket info box with neutral background - taller to include location
    doc.setFillColor(...lightNeutral);
    doc.roundedRect(15, 50, 180, 58, 3, 3, 'F');
    
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Left column
    doc.text('Ticket Holder:', 20, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(customerName, 20, 66);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Ticket Type:', 20, 76);
    doc.setFont('helvetica', 'bold');
    doc.text(tierName, 20, 82);

    // Right column
    doc.setFont('helvetica', 'normal');
    doc.text('Event Date:', 110, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(eventDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }), 110, 66);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Event Time:', 110, 76);
    doc.setFont('helvetica', 'bold');
    doc.text(eventDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    }), 110, 82);

    // Venue info (inside the box)
    if (venue) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...textColor);
      doc.text('Location:', 20, 92);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const venueLines = doc.splitTextToSize(venue + (address ? `, ${address}` : ''), 170);
      doc.text(venueLines, 20, 98);
    }

    // QR Code section with blue border (adjusted position)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(40, 115, 130, 100, 3, 3, 'F');
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(2.5);
    doc.roundedRect(40, 115, 130, 100, 3, 3, 'S');
    
    // Add QR code image
    try {
      if (!ticket.qrDataURL || !ticket.qrDataURL.startsWith('data:image')) {
        console.error('Invalid QR code data URL:', { 
          hasDataURL: !!ticket.qrDataURL, 
          urlPrefix: ticket.qrDataURL?.substring(0, 30),
          qrCode: ticket.qr_code 
        });
        throw new Error('Invalid QR code data URL');
      }
      
      console.log('Adding QR code to PDF:', { 
        qrCode: ticket.qr_code,
        dataURLLength: ticket.qrDataURL.length,
        dataURLPrefix: ticket.qrDataURL.substring(0, 50)
      });
      
      // Use 'NONE' compression for better QR code rendering (not 'FAST')
      doc.addImage(ticket.qrDataURL, 'PNG', 65, 125, 80, 80, undefined, 'NONE');
    } catch (err) {
      console.error('Failed to add QR code to PDF:', err);
      // Draw a fallback placeholder
      doc.setFillColor(220, 220, 220);
      doc.rect(65, 125, 80, 80, 'F');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('QR Code Error', 105, 165, { align: 'center' });
      doc.text('Use code below:', 105, 175, { align: 'center' });
    }

    // QR code text below
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkBlue);
    doc.text('Scan at Entry', 105, 220, { align: 'center' });
    
    // Backup code in blue
    doc.setFontSize(16);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...primaryBlue);
    doc.text(ticket.qr_code, 105, 230, { align: 'center' });

    // Instructions with muted color
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedGray);
    doc.text('Present this QR code at check-in', 105, 240, { align: 'center' });
    doc.text('Keep this ticket safe - do not share screenshots', 105, 245, { align: 'center' });

    // Footer with ticket ID
    doc.setFontSize(8);
    doc.setTextColor(...mutedGray);
    doc.text(`Ticket ID: ${ticket.id.slice(0, 13)}...`, 105, 275, { align: 'center' });
    doc.text(`Serial: #${ticket.serial_no || 'N/A'}`, 105, 280, { align: 'center' });
    
    // Bottom border with blue accent
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(1);
    doc.line(15, 285, 195, 285);
    
    doc.setFontSize(7);
    doc.setTextColor(...mutedGray);
    const footerText = orgInfo?.name 
      ? `${orgInfo.name} - ${orgInfo.supportEmail || 'support@liventix.tech'} - liventix.tech`
      : 'Liventix - support@liventix.tech - liventix.tech';
    doc.text(footerText, 105, 290, { align: 'center' });
  });

  // Convert to base64
  const pdfBase64 = doc.output('datauristring').split(',')[1];

  return {
    content: pdfBase64,
    filename: `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Tickets.pdf`,
    type: "application/pdf",
    disposition: "attachment",
  } as const;
}

/**
 * Generate Apple Wallet Pass (PKPass) URL
 * NOTE: Requires Apple Developer certificates and configuration
 * For now, returns a deep link to add to wallet feature (requires backend setup)
 */
async function generateAppleWalletPassURL(ticketId: string, ticketData: any): Promise<string | null> {
  // Check if wallet pass generation is enabled
  const WALLET_PASS_ENABLED = Deno.env.get("APPLE_WALLET_ENABLED") === "true";
  if (!WALLET_PASS_ENABLED) {
    console.log("Apple Wallet pass generation not enabled");
    return null;
  }

  try {
    // This would call a dedicated wallet-pass generation service
    // For now, return a URL that will trigger pass generation
    const passUrl = `${baseUrl()}/api/wallet/apple/${ticketId}`;
    return passUrl;
  } catch (error) {
    console.error("Apple Wallet pass generation failed:", error);
    return null;
  }
}

/**
 * Generate Google Wallet Pass URL
 * NOTE: Requires Google Cloud credentials and configuration
 */
async function generateGoogleWalletPassURL(ticketId: string, ticketData: any): Promise<string | null> {
  // Check if wallet pass generation is enabled
  const WALLET_PASS_ENABLED = Deno.env.get("GOOGLE_WALLET_ENABLED") === "true";
  if (!WALLET_PASS_ENABLED) {
    console.log("Google Wallet pass generation not enabled");
    return null;
  }

  try {
    // This would call Google Wallet API
    // For now, return a URL that will trigger pass generation
    const passUrl = `${baseUrl()}/api/wallet/google/${ticketId}`;
    return passUrl;
  } catch (error) {
    console.error("Google Wallet pass generation failed:", error);
    return null;
  }
}

/**
 * Generate wallet pass links for tickets
 */
async function generateWalletPassLinks(ticketIds: string[]) {
  const walletLinks: Array<{ ticketId: string; appleWallet?: string; googleWallet?: string }> = [];
  
  for (const ticketId of ticketIds) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, qr_code, ticket_tiers(name), events(title, start_at, venue)")
      .eq("id", ticketId)
      .single();

    if (ticket) {
      const appleWallet = await generateAppleWalletPassURL(ticketId, ticket);
      const googleWallet = await generateGoogleWalletPassURL(ticketId, ticket);
      
      if (appleWallet || googleWallet) {
        walletLinks.push({
          ticketId,
          appleWallet: appleWallet || undefined,
          googleWallet: googleWallet || undefined
        });
      }
    }
  }

  return walletLinks;
}

/**
 * Optional HTML Ticket attachment generator preserved from original version.
 * Consider moving this to a background job / webhook for very large orders.
 */
async function generateTicketHTML(ticketIds: string[], eventTitle: string, customerName: string) {
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(`id, qr_code, ticket_tiers!tickets_tier_id_fkey(name, price_cents), events!tickets_event_id_fkey(title, start_at, venue, city, address)`) // deno-fmt-ignore
    .in("id", ticketIds);

  if (error) {
    console.error("Supabase error in generateTicketHTML", { error, ticketIds });
    throw error;
  }
  if (!tickets || tickets.length === 0) {
    console.error("No tickets found for ids in HTML generator", { ticketIds, attemptedQuery: "tickets.in('id', ticketIds)" });
    throw new Error("No tickets found");
  }

  // Generate QR code images for all tickets
  const ticketsWithQR = await Promise.all(
    tickets.map(async (ticket: any) => ({
      ...ticket,
      qrDataURL: await generateQRCodeDataURL(ticket.qr_code)
    }))
  );

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${eventTitle} - Your Tickets</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:20px;line-height:1.6}.container{max-width:800px;margin:0 auto}.header{background:linear-gradient(135deg,#03A9F4 0%,#0288D1 100%);color:#fff;padding:30px;text-align:center;border-radius:16px 16px 0 0}.header h1{font-size:28px;margin-bottom:8px}.header p{opacity:.9;font-size:16px}.ticket{background:#fff;border:3px solid #03A9F4;border-radius:16px;margin:20px 0;overflow:hidden;page-break-inside:avoid;box-shadow:0 4px 6px rgba(0,0,0,.1)}.ticket-header{background:#03A9F4;color:#fff;padding:20px;text-align:center}.ticket-header h2{font-size:22px;margin-bottom:5px}.ticket-body{padding:25px}.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin:20px 0}.info-item{padding:12px;background:#f9fafb;border-radius:8px}.info-label{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}.info-value{font-size:16px;font-weight:600;color:#111827}.qr-section{text-align:center;padding:30px;background:#f9fafb;border-radius:12px;margin:20px 0}.qr-image{max-width:250px;width:100%;height:auto;border:4px solid #03A9F4;border-radius:12px;background:#fff;padding:15px;margin:15px 0}.qr-code-text{display:inline-block;background:#fff;padding:12px 20px;border:2px solid #e5e7eb;border-radius:8px;font-family:'Courier New',monospace;font-size:20px;font-weight:700;letter-spacing:3px;color:#111827;margin:10px 0}.qr-instructions{font-size:14px;color:#6b7280;margin-top:15px}.footer{text-align:center;padding:20px;color:#6b7280;font-size:13px;border-top:2px dashed #e5e7eb;margin-top:20px}@media print{body{background:#fff;padding:0}.ticket{page-break-inside:avoid;margin:0 0 40px 0}}</style></head><body><div class="container"><div class="header"><h1>🎟️ ${eventTitle}</h1><p>Tickets for ${customerName}</p></div>${ticketsWithQR
    .map((ticket: any, index: number) => {
      const eventDate = new Date(ticket.events?.start_at || Date.now());
      return `<div class="ticket"><div class="ticket-header"><h2>Ticket #${index + 1} of ${ticketsWithQR.length}</h2><p>${ticket.ticket_tiers?.name || "General Admission"}</p></div><div class="ticket-body"><div class="info-grid"><div class="info-item"><div class="info-label">Ticket Holder</div><div class="info-value">${customerName}</div></div><div class="info-item"><div class="info-label">Ticket Type</div><div class="info-value">${ticket.ticket_tiers?.name || "General Admission"}</div></div><div class="info-item"><div class="info-label">Event Date</div><div class="info-value">${eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div></div><div class="info-item"><div class="info-label">Event Time</div><div class="info-value">${eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div></div></div>${
        ticket.events?.venue || ticket.events?.address
          ? `<div class="info-item" style="margin:15px 0"><div class="info-label">Location</div><div class="info-value">${
              ticket.events?.venue || ""
            }</div>${ticket.events?.address ? `<div style="font-size:14px;color:#6b7280;margin-top:4px">${ticket.events.address}</div>` : ""}</div>`
          : ""
      }<div class="qr-section"><div style="font-size:18px;font-weight:600;color:#111827;margin-bottom:10px">📱 Scan at Entry</div><img src="${ticket.qrDataURL}" alt="QR Code" class="qr-image"/><div class="qr-code-text">${ticket.qr_code}</div><div class="qr-instructions"><strong>Present this QR code at check-in</strong><br/>Save this ticket to your device for easy access<br/>Keep this ticket safe and do not share screenshots</div></div><div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:15px;font-family:monospace">Ticket ID: ${
        (ticket.id as string).slice(0, 8)
      }</div></div></div>`;
    })
    .join("")}<div class="footer"><strong>Liventix</strong><br/>For support, visit liventix.tech or email support@liventix.tech<br/>This ticket is valid for entry and cannot be duplicated.</div></div></body></html>`;

  return {
    content: btoa(unescape(encodeURIComponent(html))),
    filename: `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Tickets.html`,
    type: "text/html",
    disposition: "attachment",
  } as const;
}

/**
 * ---------------------------
 * Logging Helper
 * ---------------------------
 */
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PURCHASE-CONFIRMATION] ${step}${detailsStr}`);
};

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
  logStep("Function started", { requestId, method: req.method });

  try {
    const raw = await req.json();
    logStep("Request received", { requestId, hasData: !!raw, orderId: raw?.orderId });
    
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      logStep("Validation failed", { requestId, issues: parsed.error.flatten() });
      return new Response(JSON.stringify({ error: "Invalid payload", details: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = parsed.data;
    logStep("Request validated", { 
      requestId, 
      orderId: data.orderId, 
      customerEmail: data.customerEmail,
      eventTitle: data.eventTitle,
      quantity: data.quantity,
      ticketIdsCount: data.ticketIds?.length || 0,
      isRsvpOnly: data.isRsvpOnly || false
    });
    
    const isGuest = data.isGuest ?? (!data.userId || data.customerName === "User");
    logStep("Customer type determined", { requestId, isGuest, userId: data.userId });

    // Hydrate context if needed
    let orgInfo = data.orgInfo;
    let eventInfo = data.eventInfo;
    if (data.eventId && (!orgInfo || !eventInfo)) {
      logStep("Fetching email context", { requestId, eventId: data.eventId });
      const context = await fetchEmailContext(data.eventId);
      orgInfo = orgInfo || context.orgInfo;
      eventInfo = eventInfo || context.eventInfo;
      logStep("Email context fetched", { 
        requestId, 
        hasOrgInfo: !!orgInfo, 
        hasEventInfo: !!eventInfo,
        orgName: orgInfo?.name,
        eventTitle: eventInfo?.title
      });
    }

    // Generate QR codes for inline display
    // Show all QR codes inline if 3 or fewer tickets, otherwise just first one
    let qrCodes: Array<{ qrCodeUrl: string; qrText: string; ticketType: string }> = [];
    if (data.ticketIds?.length) {
      logStep("Generating QR codes for inline display", { requestId, ticketCount: data.ticketIds.length });
      try {
        const limit = data.ticketIds.length <= 3 ? data.ticketIds.length : 1;
        const { data: tickets } = await supabase
          .from("tickets")
          .select("qr_code, ticket_tiers(name)")
          .in("id", data.ticketIds)
          .limit(limit);
        
        if (tickets && tickets.length > 0) {
          qrCodes = await Promise.all(
            tickets.map(async (ticket: any) => ({
              qrCodeUrl: await generateQRCodeDataURL(ticket.qr_code),
              qrText: ticket.qr_code,
              ticketType: ticket.ticket_tiers?.name || "General Admission"
            }))
          );
          logStep("QR codes generated", { requestId, qrCodeCount: qrCodes.length });
        } else {
          logStep("No tickets found for QR code generation", { requestId, ticketIds: data.ticketIds });
        }
      } catch (err) {
        logStep("QR code generation failed", { requestId, error: err });
      }
    } else {
      logStep("Skipping QR code generation (no ticketIds)", { requestId, isRsvpOnly: data.isRsvpOnly });
    }

    // Idempotency check: Check email_queue for recent email sent for this order
    if (data.orderId) {
      const { data: recentEmail } = await supabase
        .from("email_queue")
        .select("id, sent_at")
        .eq("metadata->>orderId", data.orderId)
        .eq("email_type", "purchase_confirmation")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentEmail?.sent_at) {
        const sentTime = new Date(recentEmail.sent_at).getTime();
        const now = Date.now();
        // If email was sent in last 5 minutes, skip (prevents duplicates from rapid webhook calls)
        if (now - sentTime < 5 * 60 * 1000) {
          logStep("✅ Email already sent for this order (idempotent skip)", { requestId, orderId: data.orderId, sentAt: recentEmail.sent_at });
          return new Response(
            JSON.stringify({ 
              success: true, 
              skipped: true, 
              message: "Email already sent for this order",
              orderId: data.orderId 
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }
      }
    }

    // Generate wallet pass links (Apple/Google Wallet)
    let walletLinks: Array<{ ticketId: string; appleWallet?: string; googleWallet?: string }> = [];
    if (data.ticketIds?.length) {
      try {
        walletLinks = await generateWalletPassLinks(data.ticketIds);
      } catch (err) {
        console.error("Wallet pass generation failed", { requestId, err });
      }
    }

    // Prepare PDF attachment with ALL tickets (replaces HTML)
    // ✅ Skip attachment for RSVP-only (no tickets issued)
    let ticketAttachment: { filename: string; content: string; contentType: string; disposition: string } | undefined;
    if (!data.isRsvpOnly && (data.ticketIds?.length || data.orderId)) {
      logStep("Preparing ticket attachment", { requestId, ticketIdsCount: data.ticketIds?.length || 0, orderId: data.orderId });
      try {
        // Probe: verify tickets exist or try to resolve by orderId
        if (data.ticketIds?.length) {
          logStep("Probing tickets in database", { requestId, ticketIds: data.ticketIds, orderId: data.orderId });
          
          const { data: ticketsProbe, error: probeErr } = await supabase
            .from("tickets")
            .select("id")
            .in("id", data.ticketIds);

          if (probeErr) {
            logStep("Ticket probe query error", { requestId, error: probeErr });
          }
          
          if (!ticketsProbe || ticketsProbe.length === 0) {
            logStep("TicketIds not found, attempting orderId fallback", { 
              requestId,
              ticketIds: data.ticketIds, 
              orderId: data.orderId 
            });

            // Fallback: Try to find tickets by order_id
            if (data.orderId) {
              const { data: byOrder, error: orderErr } = await supabase
                .from("tickets")
                .select("id")
                .eq("order_id", data.orderId);

              if (orderErr) {
                logStep("Order lookup error", { requestId, error: orderErr });
              } else if (byOrder && byOrder.length > 0) {
                data.ticketIds = byOrder.map((t: any) => t.id);
                logStep("Resolved tickets from orderId", { 
                  requestId,
                  orderId: data.orderId,
                  ticketCount: data.ticketIds.length,
                  ticketIds: data.ticketIds 
                });
              } else {
                logStep("No tickets found by orderId", { requestId, orderId: data.orderId });
              }
            }
          } else {
            logStep("Tickets found in database", { requestId, ticketCount: ticketsProbe.length });
          }
        }

        // Now try to generate PDF
        if (data.ticketIds?.length) {
          logStep("Generating PDF attachment", { requestId, ticketCount: data.ticketIds.length });
          const pdf = await generateTicketPDF(data.ticketIds, eventInfo?.title || data.eventTitle, data.customerName, orgInfo);
          ticketAttachment = { filename: pdf.filename, content: pdf.content, contentType: pdf.type, disposition: pdf.disposition } as const;
          logStep("PDF generated successfully", { 
            requestId, 
            filename: pdf.filename, 
            sizeBytes: pdf.content.length 
          });
        } else {
          logStep("Skipping PDF generation (no ticketIds)", { requestId });
        }
      } catch (err) {
        logStep("PDF attachment generation failed", { requestId, error: err });
        // Fallback to HTML if PDF fails
        if (data.ticketIds?.length) {
          try {
            logStep("Falling back to HTML attachment", { requestId });
            const html = await generateTicketHTML(data.ticketIds, eventInfo?.title || data.eventTitle, data.customerName);
            ticketAttachment = { filename: html.filename, content: html.content, contentType: html.type, disposition: html.disposition } as const;
            logStep("HTML generated successfully", { requestId, filename: html.filename });
          } catch (htmlErr) {
            logStep("HTML fallback also failed", { requestId, error: htmlErr });
          }
        }
      }
    } else {
      logStep("Skipping attachment generation", { 
        requestId, 
        isRsvpOnly: data.isRsvpOnly, 
        hasTicketIds: !!data.ticketIds?.length,
        hasOrderId: !!data.orderId
      });
    }

    // Generate PDF download URL (if PDF was generated)
    const ticketPdfUrl = ticketAttachment && data.orderId 
      ? `${baseUrl()}/tickets/download/${data.orderId}` 
      : undefined;
    const onlineTicketPortalUrl = `${baseUrl()}/tickets`;

    // Render HTML and a small text fallback for spam filters/clients
    const html = "<!DOCTYPE html>" + renderToStaticMarkup(
      React.createElement(PurchaseConfirmationTemplate, { 
        data: { ...data, isGuest, qrCodes, walletLinks }, 
        orgInfo, 
        eventInfo,
        ticketPdfUrl,
        onlineTicketPortalUrl,
      }),
    );
    const text = data.isRsvpOnly
      ? `RSVP Confirmed\n\nEvent: ${eventInfo?.title || data.eventTitle}\nWhen: ${formatDate(eventInfo?.date || data.eventDate) || "TBA"}\nWhere: ${eventInfo?.venue || eventInfo?.location || data.eventLocation}\nGuests: ${data.rsvpCount || data.quantity}\nOrder ID: ${data.orderId}\n\nYou're all set! No ticket required - just show up and enjoy the event.`
      : `Purchase Confirmed\n\nEvent: ${eventInfo?.title || data.eventTitle}\nWhen: ${formatDate(eventInfo?.date || data.eventDate) || "TBA"}\nWhere: ${eventInfo?.venue || eventInfo?.location || data.eventLocation}\nTicket Type: ${data.ticketType}\nQuantity: ${data.quantity}\nOrder ID: ${data.orderId}\n\nYour ticket PDF is attached to this email. Download and save it for check-in.`;

    // Support idempotency — callers can pass Idempotency-Key header
    const idemKey = req.headers.get("Idempotency-Key") ?? requestId;

    const emailPayload: Record<string, unknown> = {
      from: "Liventix <hello@liventix.tech>",
      to: [data.customerEmail],
      subject: data.isRsvpOnly 
        ? `✅ RSVP Confirmed - ${eventInfo?.title || data.eventTitle}`
        : `✅ Your Liventix tickets are ready for ${eventInfo?.title || data.eventTitle}`,
      html,
      text,
      reply_to: orgInfo?.supportEmail || "support@liventix.tech",
      headers: {
        "X-Entity-Ref-ID": idemKey, // many ESPs use this for idempotency
        "List-Unsubscribe": `<mailto:${orgInfo?.supportEmail || "support@liventix.tech"}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "type", value: "purchase_confirmation" },
        { name: "env", value: Deno.env.get("DENO_DEPLOYMENT_ID") ? "prod" : "dev" },
      ],
    };

    if (ticketAttachment) {
      (emailPayload as any).attachments = [ticketAttachment];
      logStep("Adding attachment to email", { 
        requestId, 
        filename: ticketAttachment.filename, 
        contentType: ticketAttachment.contentType,
        sizeBytes: ticketAttachment.content.length
      });
    } else {
      logStep("No ticket attachment (will send email without attachment)", { requestId });
    }

    logStep("Sending email via Resend", { 
      requestId, 
      to: data.customerEmail, 
      subject: emailPayload.subject,
      hasAttachment: !!ticketAttachment,
      isRsvpOnly: data.isRsvpOnly
    });

    const res = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const body = await res.text();
      logStep("Resend API error", { requestId, status: res.status, body });
      return new Response(JSON.stringify({ error: "Email provider error", status: res.status }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = await res.json();
    logStep("Purchase confirmation email sent successfully", { 
      requestId, 
      emailId: payload.id,
      to: data.customerEmail,
      orderId: data.orderId
    });

    // Record email in email_queue for idempotency tracking
    if (data.orderId) {
      try {
        await supabase.from("email_queue").insert({
          to_email: data.customerEmail,
          subject: emailPayload.subject as string,
          html: html,
          email_type: "purchase_confirmation",
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: {
            orderId: data.orderId,
            eventId: data.eventId,
            requestId,
            resendEmailId: payload.id,
          },
        });
      } catch (queueErr) {
        // Non-fatal - log but don't fail
        console.error("Failed to record email in queue (non-fatal):", queueErr);
      }
    }

    return new Response(JSON.stringify({ success: true, requestId, ...payload }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR in send-purchase-confirmation", { requestId, error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Internal error", requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);

