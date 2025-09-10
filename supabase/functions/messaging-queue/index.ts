import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { job_id, batch_size = 200 } = await req.json();

    if (!job_id) {
      return createErrorResponse("Missing job_id", 400);
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("message_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return createErrorResponse("Job not found", 404);
    }

    // Get pending recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("message_job_recipients")
      .select("*")
      .eq("job_id", job_id)
      .eq("status", "pending")
      .limit(batch_size);

    if (recipientsError) {
      return createErrorResponse(recipientsError.message, 500);
    }

    if (!recipients || recipients.length === 0) {
      return createResponse({ message: "No pending recipients", processed: 0 });
    }

    // Get event details for templating
    const { data: event } = await supabase
      .from("events")
      .select("title, start_at")
      .eq("id", job.event_id)
      .single();

    const eventTitle = event?.title || "Event";
    const eventDate = event?.start_at ? new Date(event.start_at).toLocaleDateString() : "";

    // Template replacement function
    const renderTemplate = (template: string, recipient: any) => {
      return template
        .replace(/{{event_title}}/g, eventTitle)
        .replace(/{{event_date}}/g, eventDate)
        .replace(/{{first_name}}/g, recipient.first_name || "there");
    };

    let processed = 0;
    let errors = 0;

    // Process each recipient
    for (const recipient of recipients) {
      try {
        if (job.channel === "email" && recipient.email && RESEND_API_KEY) {
          const subject = renderTemplate(job.subject || eventTitle, recipient);
          const body = renderTemplate(job.body || "", recipient);

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: job.from_email || "YardPass <noreply@yardpass.app>",
              to: [recipient.email],
              subject,
              html: body,
            }),
          });

          if (emailResponse.ok) {
            await supabase
              .from("message_job_recipients")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            processed++;
          } else {
            const errorText = await emailResponse.text();
            await supabase
              .from("message_job_recipients")
              .update({
                status: "failed",
                error: `Email error: ${errorText}`,
              })
              .eq("id", recipient.id);
            errors++;
          }
        } else if (job.channel === "sms" && recipient.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
          const body = renderTemplate(job.sms_body || job.body || "", recipient);

          const smsBody = new URLSearchParams({
            To: recipient.phone,
            From: TWILIO_FROM_NUMBER,
            Body: body + " Reply STOP to opt out.",
          });

          const smsResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: smsBody.toString(),
          });

          if (smsResponse.ok) {
            await supabase
              .from("message_job_recipients")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            processed++;
          } else {
            const errorText = await smsResponse.text();
            await supabase
              .from("message_job_recipients")
              .update({
                status: "failed",
                error: `SMS error: ${errorText}`,
              })
              .eq("id", recipient.id);
            errors++;
          }
        } else {
          await supabase
            .from("message_job_recipients")
            .update({
              status: "failed",
              error: "Missing contact info or provider not configured",
            })
            .eq("id", recipient.id);
          errors++;
        }
      } catch (error) {
        console.error("Recipient processing error:", error);
        await supabase
          .from("message_job_recipients")
          .update({
            status: "failed",
            error: String(error),
          })
          .eq("id", recipient.id);
        errors++;
      }
    }

    // Update job status
    const { data: remainingRecipients } = await supabase
      .from("message_job_recipients")
      .select("id")
      .eq("job_id", job_id)
      .eq("status", "pending");

    const isComplete = !remainingRecipients || remainingRecipients.length === 0;

    await supabase
      .from("message_jobs")
      .update({
        status: isComplete ? "sent" : "sending",
      })
      .eq("id", job_id);

    return createResponse({
      message: "Batch processed",
      processed,
      errors,
      completed: isComplete,
    });
  } catch (error) {
    console.error("Function error:", error);
    return createErrorResponse(String(error), 500);
  }
});