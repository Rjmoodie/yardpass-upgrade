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

interface TicketReminderRequest {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
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
        websiteUrl: org.handle ? `https://liventix.tech/org/${org.handle}` : undefined,
        supportEmail: 'support@liventix.tech',
      };
    }
  }

  return { orgInfo, eventInfo };
}

// Import email template components (inline for edge function)
function BaseEmailLayout({ children, orgInfo }: { children: any; orgInfo?: OrgInfo }) {
  const baseUrl = SUPABASE_URL?.replace('/rest/v1', '') || 'https://liventix.tech';
  const logoUrl = `${baseUrl}/liventix-logo.png`;
  
  return React.createElement('html', {},
    React.createElement('head', {},
      React.createElement('meta', { charSet: 'utf-8' }),
      React.createElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' })
    ),
    React.createElement('body', { style: { fontFamily: 'Arial, sans-serif', margin: 0, padding: 0, backgroundColor: '#f9fafb' } },
      React.createElement('div', { style: { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' } },
        // Header
        React.createElement('div', { style: { backgroundColor: '#1a1a1a', padding: '24px', textAlign: 'center' } },
          React.createElement('img', { src: logoUrl, alt: orgInfo?.name || 'Liventix', style: { height: '60px', maxWidth: '300px' } })
        ),
        // Content
        React.createElement('div', { style: { padding: '32px 24px' } }, children),
        // Footer
        React.createElement('div', { style: { backgroundColor: '#f9fafb', padding: '24px', textAlign: 'center', fontSize: '14px', color: '#6b7280' } },
          orgInfo?.name ? React.createElement('p', { style: { margin: '0 0 8px 0' } }, 
            `Organized by ${orgInfo.name}`
          ) : null,
          React.createElement('p', { style: { margin: '0' } },
            `Questions? Contact `,
            React.createElement('a', { href: `mailto:${orgInfo?.supportEmail || 'support@liventix.tech'}`, style: { color: '#3b82f6' } },
              orgInfo?.supportEmail || 'support@liventix.tech'
            )
          )
        )
      )
    )
  );
}

function TicketReminderTemplate({ data, orgInfo, eventInfo }: { data: TicketReminderRequest; orgInfo?: OrgInfo; eventInfo?: EventInfo }) {
  const baseUrl = SUPABASE_URL?.replace('/rest/v1', '') || 'https://liventix.tech';
  
  return React.createElement(BaseEmailLayout, { orgInfo },
    React.createElement('div', { style: { backgroundColor: '#f59e0b', color: 'white', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'center' } },
      React.createElement('h1', { style: { margin: '0 0 8px 0', fontSize: '24px' } }, '⏰ Event Reminder'),
      React.createElement('p', { style: { margin: 0, fontSize: '16px' } }, 'Your event is coming up soon!')
    ),
    React.createElement('h2', { style: { fontSize: '20px', marginBottom: '16px' } }, `Hi ${data.customerName},`),
    React.createElement('p', { style: { lineHeight: '1.6', color: '#374151' } },
      `Just a friendly reminder that ${eventInfo?.title || data.eventTitle} is coming up soon! We can't wait to see you there.`
    ),
    eventInfo?.coverImageUrl && React.createElement('img', { 
      src: eventInfo.coverImageUrl, 
      alt: eventInfo.title,
      style: { width: '100%', borderRadius: '8px', marginTop: '16px', marginBottom: '16px' }
    }),
    React.createElement('div', { style: { backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', marginTop: '24px' } },
      React.createElement('h3', { style: { margin: '0 0 12px 0', fontSize: '18px' } }, 'Event Details'),
      React.createElement('p', { style: { margin: '4px 0', fontSize: '14px' } }, `📅 ${eventInfo?.date || data.eventDate}`),
      React.createElement('p', { style: { margin: '4px 0', fontSize: '14px' } }, `📍 ${eventInfo?.location || data.eventLocation}`),
      eventInfo?.venue && React.createElement('p', { style: { margin: '4px 0', fontSize: '14px' } }, `🏛️ ${eventInfo.venue}`),
      React.createElement('p', { style: { margin: '4px 0', fontSize: '14px' } }, `🎫 ${data.ticketType}`)
    ),
    data.qrCodeUrl && React.createElement('div', { style: { textAlign: 'center', margin: '24px 0' } },
      React.createElement('img', { src: data.qrCodeUrl, alt: 'QR Code', style: { width: '200px', height: '200px' } }),
      React.createElement('p', { style: { fontSize: '14px', color: '#6b7280', marginTop: '8px' } }, 'Your entry QR code')
    ),
    React.createElement('div', { style: { backgroundColor: '#fef3c7', padding: '16px', borderRadius: '8px', marginTop: '24px' } },
      React.createElement('h3', { style: { margin: '0 0 12px 0', fontSize: '18px' } }, '✅ Event Checklist'),
      React.createElement('ul', { style: { margin: '0', paddingLeft: '20px', lineHeight: '1.8' } },
        React.createElement('li', {}, 'Arrive 15-30 minutes early'),
        React.createElement('li', {}, 'Bring a valid ID'),
        React.createElement('li', {}, 'Have your QR code ready'),
        React.createElement('li', {}, 'Check the weather and dress accordingly')
      )
    ),
    React.createElement('div', { style: { textAlign: 'center', marginTop: '32px' } },
      React.createElement('a', { 
        href: `${baseUrl}/tickets`,
        style: { 
          display: 'inline-block',
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '12px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 'bold'
        }
      }, 'View Your Tickets')
    )
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: TicketReminderRequest = await req.json();

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
      React.createElement(TicketReminderTemplate, { data, orgInfo, eventInfo })
    );

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Liventix <hello@liventix.tech>",
        to: [data.customerEmail],
        subject: `⏰ Reminder: ${eventInfo?.title || data.eventTitle} is coming up!`,
        html,
        reply_to: orgInfo?.supportEmail || "support@liventix.tech",
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }

    const emailResponse = await response.json();
    console.log("Ticket reminder sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);