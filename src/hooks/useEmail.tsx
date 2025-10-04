// src/hooks/useEmail.ts
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { emailService, EmailOptions, PurchaseConfirmationData, TicketReminderData } from '@/lib/emailService';
import { renderPurchaseConfirmationHTML, renderTicketReminderHTML } from '@/components/EmailTemplates';
import { getEmailContext } from '@/lib/emailHelpers';

type SendOpts = {
  previewInBrowser?: boolean;
  baseUrl?: string;
  silent?: boolean;
  eventId?: string; // For auto-fetching org/event context
};

function maybePreview(html: string, preview?: boolean) {
  if (preview && typeof window !== 'undefined') {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }
}

export function useEmail() {
  const [isLoading, setIsLoading] = useState(false);

  const notify = (ok: boolean, okMsg: string, errMsg: string, silent?: boolean) => {
    if (silent) return;
    if (ok) toast({ title: okMsg, description: 'Email sent successfully.' });
    else toast({ title: 'Email failed', description: errMsg || 'Please try again.', variant: 'destructive' });
  };

  const sendEmail = async (options: EmailOptions, opts?: SendOpts) => {
    setIsLoading(true);
    try {
      maybePreview(options.html, opts?.previewInBrowser && import.meta.env.DEV);
      const res = await emailService.sendEmail(options);
      notify(res.success, 'Email sent', res.error || '', opts?.silent);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendPurchaseConfirmation = async (data: PurchaseConfirmationData, opts?: SendOpts) => {
    setIsLoading(true);
    try {
      // Auto-fetch org/event context if eventId provided and not already in data
      let enhancedData = { ...data };
      if (opts?.eventId && (!data.orgInfo || !data.eventInfo)) {
        const context = await getEmailContext(opts.eventId);
        enhancedData = {
          ...data,
          orgInfo: data.orgInfo || context.orgInfo,
          eventInfo: data.eventInfo || context.eventInfo,
        };
      }

      const specialized = await emailService.sendPurchaseConfirmation(enhancedData);
      if (specialized.success) {
        notify(true, 'Confirmation sent', '', opts?.silent);
        return specialized;
      }
      
      const html = renderPurchaseConfirmationHTML({
        ...enhancedData,
        baseUrl: opts?.baseUrl,
      });
      maybePreview(html, opts?.previewInBrowser && import.meta.env.DEV);
      const res = await emailService.sendEmail({
        to: enhancedData.customerEmail,
        subject: `Your tickets to ${enhancedData.eventTitle} are confirmed`,
        html,
      });
      notify(res.success, 'Confirmation sent', res.error || '', opts?.silent);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendTicketReminder = async (data: TicketReminderData, opts?: SendOpts) => {
    setIsLoading(true);
    try {
      // Auto-fetch org/event context if eventId provided and not already in data
      let enhancedData = { ...data };
      if (opts?.eventId && (!data.orgInfo || !data.eventInfo)) {
        const context = await getEmailContext(opts.eventId);
        enhancedData = {
          ...data,
          orgInfo: data.orgInfo || context.orgInfo,
          eventInfo: data.eventInfo || context.eventInfo,
        };
      }

      const specialized = await emailService.sendTicketReminder(enhancedData);
      if (specialized.success) {
        notify(true, 'Reminder sent', '', opts?.silent);
        return specialized;
      }
      
      const html = renderTicketReminderHTML({ ...enhancedData, baseUrl: opts?.baseUrl });
      maybePreview(html, opts?.previewInBrowser && import.meta.env.DEV);
      const res = await emailService.sendEmail({
        to: enhancedData.customerEmail,
        subject: `Reminder: ${enhancedData.eventTitle} is coming up`,
        html,
      });
      notify(res.success, 'Reminder sent', res.error || '', opts?.silent);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, sendEmail, sendPurchaseConfirmation, sendTicketReminder };
}
