import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import React from 'https://esm.sh/react@18.3.1';
import { renderToStaticMarkup } from 'https://esm.sh/react-dom@18.3.1/server';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrgInfo {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
}

interface EventInfo {
  title: string;
  date: string;
  location: string;
  venue?: string;
  coverImageUrl?: string;
  description?: string;
}

interface PurchaseConfirmationRequest {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  quantity: number;
  totalAmount: number;
  orderId: string;
  ticketIds: string[];
  qrCodeUrl?: string;
  eventId?: string;
  orgInfo?: OrgInfo;
  eventInfo?: EventInfo;
}

// Fetch org and event info from database
async function fetchEmailContext(eventId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: event } = await supabase
    .from('events')
    .select(`
      title,
      start_at,
      venue,
      city,
      cover_image_url,
      description,
      owner_context_type,
      owner_context_id
    `)
    .eq('id', eventId)
    .single();

  if (!event) return {};

  const eventInfo: EventInfo = {
    title: event.title,
    date: event.start_at,
    location: event.city || event.venue || 'TBA',
    venue: event.venue || undefined,
    coverImageUrl: event.cover_image_url || undefined,
    description: event.description || undefined,
  };

  let orgInfo: OrgInfo | undefined;

  if (event.owner_context_type === 'organization' && event.owner_context_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, logo_url, handle')
      .eq('id', event.owner_context_id)
      .single();

    if (org) {
      orgInfo = {
        name: org.name,
        logoUrl: org.logo_url || undefined,
        websiteUrl: org.handle ? `https://yardpass.tech/org/${org.handle}` : undefined,
        supportEmail: 'support@yardpass.tech',
      };
    }
  }

  return { orgInfo, eventInfo };
}

function HiddenPreheader({ text }: { text?: string }) {
  if (!text) return null;

  return React.createElement('div', {
    style: {
      display: 'none',
      overflow: 'hidden',
      lineHeight: '1px',
      maxHeight: 0,
      maxWidth: 0,
      opacity: 0,
      color: 'transparent',
      height: '1px',
      width: '1px',
    },
  }, text);
}

// Import email template components (inline for edge function)
function BaseEmailLayout({ children, orgInfo, preheaderText }: { children: any; orgInfo?: OrgInfo; preheaderText?: string }) {
  const baseUrl = SUPABASE_URL?.replace('/rest/v1', '') || 'https://yardpass.tech';
  const logoUrl = orgInfo?.logoUrl || `${baseUrl}/yardpass-logo.png`;
  const supportEmail = orgInfo?.supportEmail || 'support@yardpass.tech';
  const currentYear = new Date().getFullYear();

  return React.createElement('html', { lang: 'en' },
    React.createElement('head', {},
      React.createElement('meta', { charSet: 'utf-8' }),
      React.createElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }),
      React.createElement('title', {}, orgInfo?.name ? `${orgInfo.name} · YardPass` : 'YardPass Ticket Confirmation')
    ),
    React.createElement('body', {
      style: {
        margin: 0,
        padding: 0,
        backgroundColor: '#f4f4f5',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        color: '#0f172a',
      },
    },
      React.createElement(HiddenPreheader, { text: preheaderText }),
      React.createElement('div', {
        style: {
          padding: '32px 16px',
          backgroundColor: '#f4f4f5',
        },
      },
        React.createElement('div', {
          style: {
            maxWidth: '640px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 18px 30px rgba(15, 23, 42, 0.08)',
          },
        },
          React.createElement('div', {
            style: {
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              padding: '28px 32px',
              textAlign: 'center',
            },
          },
            React.createElement('img', {
              src: logoUrl,
              alt: orgInfo?.name || 'YardPass',
              style: { height: '40px', maxWidth: '200px', marginBottom: '12px' },
            }),
            React.createElement('div', {
              style: { fontSize: '13px', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' },
            }, 'Powered by YardPass')
          ),
          orgInfo ? React.createElement('table', {
            width: '100%',
            cellPadding: 0,
            cellSpacing: 0,
            role: 'presentation',
            style: { borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafafa' },
          },
            React.createElement('tr', {},
              React.createElement('td', {
                style: { padding: '20px 32px', width: '64px' },
                valign: 'top',
              },
                orgInfo.logoUrl ? React.createElement('img', {
                  src: orgInfo.logoUrl,
                  alt: orgInfo.name,
                  style: { width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' },
                }) : null
              ),
              React.createElement('td', { style: { padding: '20px 32px 20px 0' } },
                React.createElement('div', { style: { fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' } }, orgInfo.name),
                orgInfo.websiteUrl ? React.createElement('a', {
                  href: orgInfo.websiteUrl,
                  style: { fontSize: '13px', color: '#6366f1', textDecoration: 'none' },
                }, 'Visit website →') : null
              )
            )
          ) : null,
          React.createElement('div', { style: { padding: '32px' } }, children),
          React.createElement('div', {
            style: {
              backgroundColor: '#f8fafc',
              padding: '24px 32px',
              borderTop: '1px solid #e2e8f0',
            },
          },
            React.createElement('div', { style: { textAlign: 'center', color: '#64748b', fontSize: '13px', lineHeight: 1.6 } },
              React.createElement('p', { style: { margin: '0 0 8px 0' } },
                'Questions? Contact us at ',
                React.createElement('a', {
                  href: `mailto:${supportEmail}`,
                  style: { color: '#6366f1', textDecoration: 'none' },
                }, supportEmail)
              ),
              React.createElement('p', { style: { margin: '0 0 16px 0', fontSize: '12px' } }, `© ${currentYear} YardPass. All rights reserved.`),
              React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } },
                React.createElement('a', {
                  href: 'https://yardpass.tech/privacy',
                  style: { color: '#94a3b8', textDecoration: 'none', margin: '0 8px' },
                }, 'Privacy Policy'),
                ' • ',
                React.createElement('a', {
                  href: 'https://yardpass.tech/terms',
                  style: { color: '#94a3b8', textDecoration: 'none', margin: '0 8px' },
                }, 'Terms of Service')
              )
            )
          )
        )
      )
    )
  );
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number') return undefined;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
  } catch {
    return `$${(value / 100).toFixed(2)}`;
  }
}

function PurchaseConfirmationTemplate({ data, orgInfo, eventInfo }: { data: PurchaseConfirmationRequest; orgInfo?: OrgInfo; eventInfo?: EventInfo }) {
  const baseUrl = SUPABASE_URL?.replace('/rest/v1', '') || 'https://yardpass.tech';
  const eventTitle = eventInfo?.title || data.eventTitle;
  const preheaderText = `Your tickets for ${eventTitle} are confirmed. Access them anytime with YardPass.`;
  const formattedDate = formatDate(eventInfo?.date || data.eventDate);
  const formattedTotal = formatCurrency(data.totalAmount);

  return React.createElement(BaseEmailLayout, { orgInfo, preheaderText },
    React.createElement('div', {
      style: {
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#ffffff',
        padding: '24px',
        borderRadius: '14px',
        marginBottom: '28px',
        textAlign: 'center',
      },
    },
      React.createElement('div', { style: { fontSize: '32px', marginBottom: '8px' } }, '🎉'),
      React.createElement('h1', { style: { margin: 0, fontSize: '26px', fontWeight: 700 } }, 'Purchase Confirmed!'),
      React.createElement('p', { style: { margin: '10px 0 0 0', fontSize: '15px', opacity: 0.95 } }, 'Your tickets are ready to scan at the door.')
    ),
    eventInfo?.coverImageUrl ? React.createElement('div', {
      style: { marginBottom: '28px', borderRadius: '16px', overflow: 'hidden' },
    },
      React.createElement('img', {
        src: eventInfo.coverImageUrl,
        alt: eventTitle,
        style: { width: '100%', height: 'auto', display: 'block' },
      })
    ) : null,
    React.createElement('div', { style: { marginBottom: '24px' } },
      React.createElement('h2', { style: { margin: '0 0 12px 0', color: '#0f172a', fontSize: '20px', fontWeight: 600 } }, `Hi ${data.customerName} 👋`),
      React.createElement('p', { style: { margin: 0, color: '#475569', fontSize: '15px', lineHeight: 1.6 } },
        'Thank you for your purchase! Your tickets for ',
        React.createElement('strong', {}, eventTitle),
        ' have been confirmed and are ready to use.'
      )
    ),
    React.createElement('div', {
      style: {
        backgroundColor: '#fafafa',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '20px',
      },
    },
      React.createElement('h3', { style: { margin: '0 0 16px 0', color: '#0f172a', fontSize: '17px', fontWeight: 600 } }, '📅 Event Details'),
      React.createElement('table', { width: '100%', cellPadding: 0, cellSpacing: 0, role: 'presentation' },
        React.createElement('tbody', {},
          React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#64748b', width: '35%' } }, 'Event'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '15px', color: '#0f172a', fontWeight: 500 } }, eventTitle)
          ),
          formattedDate ? React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#64748b' } }, 'Date & Time'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '15px', color: '#0f172a', fontWeight: 500 } }, formattedDate)
          ) : null,
          React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#64748b' } }, 'Location'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '15px', color: '#0f172a', fontWeight: 500 } }, eventInfo?.venue || eventInfo?.location || data.eventLocation)
          ),
          eventInfo?.venue && eventInfo.location && eventInfo.location !== eventInfo.venue ? React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#64748b' } }, 'City'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '15px', color: '#0f172a', fontWeight: 500 } }, eventInfo.location)
          ) : null,
          eventInfo?.description ? React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#64748b', verticalAlign: 'top' } }, 'About'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '14px', color: '#475569', lineHeight: 1.6 } }, eventInfo.description)
          ) : null
        )
      )
    ),
    React.createElement('div', {
      style: {
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '20px',
      },
    },
      React.createElement('h3', { style: { margin: '0 0 16px 0', color: '#0c4a6e', fontSize: '17px', fontWeight: 600 } }, '🎟️ Your Tickets'),
      React.createElement('table', { width: '100%', cellPadding: 0, cellSpacing: 0, role: 'presentation' },
        React.createElement('tbody', {},
          React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#075985' } }, 'Ticket Type'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '15px', color: '#0c4a6e', fontWeight: 600, textAlign: 'right' } }, data.ticketType)
          ),
          React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '13px', color: '#075985' } }, 'Quantity'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '18px', color: '#0c4a6e', fontWeight: 700, textAlign: 'right' } }, `×${data.quantity}`)
          ),
          formattedTotal ? React.createElement('tr', {},
            React.createElement('td', { style: { padding: '12px 0 6px 0', fontSize: '15px', color: '#0c4a6e', fontWeight: 500 } }, 'Total Paid'),
            React.createElement('td', { style: { padding: '12px 0 6px 0', fontSize: '20px', color: '#0c4a6e', fontWeight: 700, textAlign: 'right' } }, formattedTotal)
          ) : null,
          React.createElement('tr', {},
            React.createElement('td', { style: { padding: '6px 0', fontSize: '12px', color: '#075985' } }, 'Order ID'),
            React.createElement('td', { style: { padding: '6px 0', fontSize: '12px', color: '#075985', fontFamily: 'monospace', textAlign: 'right' } }, data.orderId)
          )
        )
      ),
      React.createElement('p', { style: { margin: '16px 0 0 0', fontSize: '13px', color: '#0369a1', lineHeight: 1.6 } }, 'Need to transfer tickets to a guest? Forward this email or share access from your YardPass account.')
    ),
    data.qrCodeUrl ? React.createElement('div', {
      style: {
        backgroundColor: '#ffffff',
        border: '2px dashed #cbd5e1',
        borderRadius: '14px',
        padding: '24px',
        marginBottom: '28px',
        textAlign: 'center',
      },
    },
      React.createElement('div', { style: { fontSize: '15px', color: '#0f172a', fontWeight: 600, marginBottom: '16px' } }, 'Your Entry Pass'),
      React.createElement('img', {
        src: data.qrCodeUrl,
        alt: 'Entry QR Code',
        style: { maxWidth: '200px', height: 'auto', display: 'block', margin: '0 auto', border: '3px solid #0f172a', borderRadius: '12px', padding: '10px', backgroundColor: '#ffffff' },
      }),
      React.createElement('p', { style: { margin: '16px 0 0 0', fontSize: '13px', color: '#64748b' } }, 'Present this QR code at check-in. Each ticket will also be available in the YardPass app.')
    ) : null,
    React.createElement('div', { style: { textAlign: 'center', marginBottom: '28px' } },
      React.createElement('a', {
        href: `${baseUrl}/tickets`,
        style: {
          display: 'inline-block',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: '#ffffff',
          padding: '14px 36px',
          textDecoration: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          boxShadow: '0 12px 24px rgba(79, 70, 229, 0.25)',
        },
      }, 'View My Tickets →')
    ),
    React.createElement('div', {
      style: {
        backgroundColor: '#fefce8',
        border: '1px solid #fde047',
        borderRadius: '14px',
        padding: '20px',
      },
    },
      React.createElement('h3', { style: { margin: '0 0 12px 0', color: '#713f12', fontSize: '16px', fontWeight: 600 } }, '✨ Helpful Tips'),
      React.createElement('ul', { style: { margin: 0, paddingLeft: '20px', color: '#854d0e', fontSize: '14px', lineHeight: 1.8 } },
        React.createElement('li', {}, 'Add this event to your calendar and plan your arrival.'),
        React.createElement('li', {}, 'Bring a valid ID and have your QR code ready for scanning.'),
        React.createElement('li', {}, 'Need assistance? Reply to this email and our team will help.'),
        React.createElement('li', {}, 'Save this email for easy access to your tickets and order details.')
      )
    )
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PurchaseConfirmationRequest = await req.json();

    if (!data.customerEmail || !data.customerName || !data.eventTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch org/event context if eventId provided
    let orgInfo = data.orgInfo;
    let eventInfo = data.eventInfo;

    if (data.eventId && (!orgInfo || !eventInfo)) {
      const context = await fetchEmailContext(data.eventId);
      orgInfo = orgInfo || context.orgInfo;
      eventInfo = eventInfo || context.eventInfo;
    }

    // Render React template
    const html = '<!DOCTYPE html>' + renderToStaticMarkup(
      React.createElement(PurchaseConfirmationTemplate, { data, orgInfo, eventInfo })
    );

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: orgInfo?.name ? `${orgInfo.name} via YardPass <noreply@yardpass.tech>` : "YardPass <noreply@yardpass.tech>",
        to: [data.customerEmail],
        subject: `✅ Ticket Confirmation - ${eventInfo?.title || data.eventTitle}`,
        html,
        reply_to: orgInfo?.supportEmail || "support@yardpass.tech",
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }

    const emailResponse = await response.json();
    console.log("Purchase confirmation sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-purchase-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
