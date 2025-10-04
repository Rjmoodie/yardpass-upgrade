import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Using direct fetch to avoid npm dependency issues

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

const generatePurchaseConfirmationHtml = (data: PurchaseConfirmationRequest): string => {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "") || "https://app.yardpass.com";
  const ticketUrl = `${baseUrl}/tickets`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Purchase Confirmation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 24px;">Purchase Confirmation</h1>
        <p style="color: #64748b; margin: 0; font-size: 16px;">Your tickets have been confirmed!</p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px;">Hi ${data.customerName},</h2>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 15px 0; font-size: 16px;">
          Thank you for your purchase! Your tickets for <strong>${data.eventTitle}</strong> have been confirmed.
        </p>

        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 18px;">Event Details</h3>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Event:</strong> ${data.eventTitle}</p>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Date:</strong> ${data.eventDate}</p>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Location:</strong> ${data.eventLocation}</p>
        </div>

        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 18px;">Ticket Information</h3>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Ticket Type:</strong> ${data.ticketType}</p>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Quantity:</strong> ${data.quantity}</p>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Total Amount:</strong> $${(data.totalAmount / 100).toFixed(2)}</p>
          <p style="margin: 5px 0; color: #374151; font-size: 14px;"><strong>Order ID:</strong> ${data.orderId}</p>
        </div>

        ${data.qrCodeUrl ? `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${data.qrCodeUrl}" alt="QR Code" style="max-width: 200px; height: auto;" />
          <p style="color: #64748b; font-size: 14px; margin: 10px 0 0 0;">
            Show this QR code at the event entrance
          </p>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a
            href="${ticketUrl}"
            style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;"
          >
            View Your Tickets
          </a>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
          <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 18px;">What's Next?</h3>
          <ul style="color: #374151; line-height: 1.6; padding-left: 20px; font-size: 14px;">
            <li>Save this confirmation email for your records</li>
            <li>Add the event to your calendar</li>
            <li>Arrive 15 minutes early for check-in</li>
            <li>Bring a valid ID and show your QR code</li>
          </ul>
        </div>
      </div>

      <div style="text-align: center; color: #64748b; font-size: 14px;">
        <p>Need help? Contact us at support@yardpass.com</p>
        <p>© 2024 YardPass. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PurchaseConfirmationRequest = await req.json();

    if (!data.customerEmail || !data.customerName || !data.eventTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const html = generatePurchaseConfirmationHtml(data);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "YardPass <noreply@yardpass.tech>",
        to: [data.customerEmail],
        subject: `Ticket Confirmation - ${data.eventTitle}`,
        html,
        reply_to: "support@yardpass.tech",
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }

    const emailResponse = await response.json();

    console.log("Purchase confirmation email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-purchase-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);