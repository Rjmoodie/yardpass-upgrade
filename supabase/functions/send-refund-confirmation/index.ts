import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, email, refund_amount, tickets_refunded, event_title, reason } = await req.json();

    if (!email || !order_id) {
      throw new Error("Email and order_id required");
    }

    console.log(`[send-refund-confirmation] Sending to: ${email} for order: ${order_id}`);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("[send-refund-confirmation] RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service not configured" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Liventix <tickets@liventix.com>",
        to: [email],
        subject: `Refund Processed - ${event_title || 'Your Order'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Refund Processed</h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0;">
                Your refund has been successfully processed
              </p>
            </div>

            <!-- Content -->
            <div style="background: white; padding: 30px; margin-top: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">Refund Details</h2>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 14px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #f3f4f6;">Event</td>
                  <td style="padding: 14px 0; color: #1f2937; font-weight: 600; font-size: 15px; border-bottom: 1px solid #f3f4f6; text-align: right;">${event_title || 'Your Event'}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #f3f4f6;">Tickets Refunded</td>
                  <td style="padding: 14px 0; color: #1f2937; font-size: 15px; border-bottom: 1px solid #f3f4f6; text-align: right;">${tickets_refunded || 'All'}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #f3f4f6;">Refund Amount</td>
                  <td style="padding: 14px 0; color: #10b981; font-weight: 700; font-size: 24px; border-bottom: 1px solid #f3f4f6; text-align: right;">$${refund_amount?.toFixed(2) || '0.00'}</td>
                </tr>
              </table>

              <!-- Processing Info -->
              <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                  <strong>💳 Refund Timeline:</strong><br/>
                  The refund will appear in your account within <strong>5-10 business days</strong>, depending on your bank or card issuer.
                </p>
              </div>

              <!-- Platform Fees Note -->
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                  <strong>📝 Platform Fees:</strong> Liventix platform fees (~3.7% + $1.79) are included in this refund. Stripe payment processing fees may not be refunded per Stripe's policy.
                </p>
              </div>

              ${reason && reason !== 'Refund processed' ? `
              <div style="margin-top: 24px; padding: 16px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  <strong>Reason:</strong> ${reason}
                </p>
              </div>
              ` : ''}

              <!-- Support CTA -->
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">
                  Questions about this refund?
                </p>
                <a href="mailto:support@liventix.com" style="display: inline-block; background: #f3f4f6; color: #1f2937; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Contact Support
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 5px 0;">Liventix - Your events, simplified</p>
              <p style="margin: 10px 0;">
                <a href="https://liventix.com/refund-policy" style="color: #6b7280; text-decoration: none; margin: 0 10px;">Refund Policy</a>
                <a href="https://liventix.com/support" style="color: #6b7280; text-decoration: none; margin: 0 10px;">Support</a>
                <a href="https://liventix.com/terms" style="color: #6b7280; text-decoration: none; margin: 0 10px;">Terms</a>
              </p>
            </div>

          </body>
          </html>
        `
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailData)}`);
    }

    console.log("[send-refund-confirmation] ✅ Email sent successfully", { 
      emailId: emailData.id,
      to: email
    });

    return new Response(
      JSON.stringify({
        success: true,
        id: emailData.id,
        sentTo: email
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[send-refund-confirmation] ERROR:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});



