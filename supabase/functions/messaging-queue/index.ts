import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";
import React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { MessageEmail } from './_templates/message.tsx'

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
    console.log('[messaging-queue] Processing job:', job_id, 'batch size:', batch_size);

    if (!job_id) {
      console.error('[messaging-queue] Missing job_id');
      return createErrorResponse("Missing job_id", 400);
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("message_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error('[messaging-queue] Job not found:', jobError);
      return createErrorResponse("Job not found", 404);
    }

    console.log('[messaging-queue] Found job:', job.id, 'status:', job.status, 'channel:', job.channel);

    // Get pending recipients 
    const { data: recipients, error: recipientsError } = await supabase
      .from("message_job_recipients")
      .select("*")
      .eq("job_id", job_id)
      .eq("status", "pending")
      .limit(batch_size);

    if (recipientsError) {
      console.error('[messaging-queue] Recipients error:', recipientsError);
      return createErrorResponse(recipientsError.message, 500);
    }

    console.log('[messaging-queue] Found recipients:', recipients?.length || 0);

    if (!recipients || recipients.length === 0) {
      console.log('[messaging-queue] No pending recipients found');
      return createResponse({ message: "No pending recipients", processed: 0 });
    }

    // Get event details for templating
    const { data: event } = await supabase
      .from("events")
      .select(`
        title,
        start_at,
        venue,
        city,
        cover_image_url,
        owner_context_type,
        owner_context_id
      `)
      .eq("id", job.event_id)
      .single();

    const eventTitle = event?.title || "Event";
    const eventDate = event?.start_at ? new Date(event.start_at).toLocaleDateString() : "";
    
    // Get organization info if event is owned by an org
    let orgInfo = null;
    if (event?.owner_context_type === 'organization' && event?.owner_context_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, logo_url, handle")
        .eq("id", event.owner_context_id)
        .single();
      
      if (org) {
        orgInfo = {
          name: org.name,
          logoUrl: org.logo_url,
          websiteUrl: org.handle ? `https://yardpass.tech/org/${org.handle}` : undefined,
        };
      }
    }

    // Template replacement function
    const renderTemplate = async (template: string, recipient: any) => {
      let firstName = "there";
      
      // Get user profile data if needed for templating
      if (recipient.user_id) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("display_name")
          .eq("user_id", recipient.user_id)
          .single();
        
        if (profile?.display_name) {
          firstName = profile.display_name.split(' ')[0];
        }
      }
      
      return template
        .replace(/{{event_title}}/g, eventTitle)
        .replace(/{{event_date}}/g, eventDate)
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{org_name}}/g, orgInfo?.name || eventTitle);
    };

    let processed = 0;
    let errors = 0;

    console.log('[messaging-queue] Starting to process', recipients.length, 'recipients');

    // Process each recipient
    for (const recipient of recipients) {
      try {
        // For email channel, get email from auth.users if not provided
        let recipientEmail = recipient.email;
        if (job.channel === "email" && !recipientEmail && recipient.user_id) {
          const { data: userData } = await supabase.auth.admin.getUserById(recipient.user_id);
          recipientEmail = userData.user?.email;
        }

        if (job.channel === "email" && recipientEmail && RESEND_API_KEY) {
          const subject = await renderTemplate(job.subject || eventTitle, recipient);
          const bodyText = await renderTemplate(job.body || "", recipient);
          
          // Extract preheader from special HTML comment if present
          const preheaderMatch = bodyText.match(/<!--\s*preheader:\s*(.+?)\s*-->/i);
          const preheader = preheaderMatch ? preheaderMatch[1].trim() : undefined;
          const bodyWithoutPreheader = preheaderMatch ? bodyText.replace(preheaderMatch[0], '').trim() : bodyText;

          // Render the React Email template
          const html = await renderAsync(
            React.createElement(MessageEmail, {
              subject,
              body: bodyWithoutPreheader,
              preheader,
              event_title: eventTitle,
              event_cover_image: event?.cover_image_url || undefined,
              org_name: orgInfo?.name || undefined,
              org_logo_url: orgInfo?.logoUrl || undefined,
            })
          );

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: job.from_email && job.from_name 
                ? `${job.from_name} <${job.from_email}>` 
                : job.from_email || "YardPass <noreply@yardpass.tech>",
              to: [recipientEmail],
              subject,
              html,
              reply_to: job.reply_to || "support@yardpass.tech",
            }),
          });

          if (emailResponse.ok) {
            console.log('[messaging-queue] Email sent successfully to:', recipientEmail);
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
            console.error('[messaging-queue] Email failed for:', recipientEmail, 'Error:', errorText);
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
          const body = await renderTemplate(job.sms_body || job.body || "", recipient);

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
          console.log('[messaging-queue] Missing contact info or provider not configured for recipient:', recipient.id);
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
        console.error("[messaging-queue] Recipient processing error:", error);
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

    console.log('[messaging-queue] Processing complete. Processed:', processed, 'Errors:', errors);

    // Update job status
    const { data: remainingRecipients } = await supabase
      .from("message_job_recipients")
      .select("id")
      .eq("job_id", job_id)
      .eq("status", "pending");

    const isComplete = !remainingRecipients || remainingRecipients.length === 0;
    console.log('[messaging-queue] Job completion check. Remaining recipients:', remainingRecipients?.length || 0, 'Is complete:', isComplete);

    await supabase
      .from("message_jobs")
      .update({
        status: isComplete ? "sent" : "sending",
      })
      .eq("id", job_id);

    console.log('[messaging-queue] Job status updated to:', isComplete ? "sent" : "sending");

    return createResponse({
      message: "Batch processed",
      processed,
      errors,
      completed: isComplete,
    });
  } catch (error) {
    console.error("[messaging-queue] Function error:", error);
    return createErrorResponse(String(error), 500);
  }
});