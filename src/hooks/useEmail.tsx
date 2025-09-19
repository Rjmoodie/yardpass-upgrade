// src/hooks/useEmail.ts
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { emailService, EmailOptions, PurchaseConfirmationData, TicketReminderData } from '@/lib/emailService';
import { renderPurchaseConfirmationHTML, renderTicketReminderHTML } from '@/components/EmailTemplates';

type SendOpts = {
  previewInBrowser?: boolean;
  baseUrl?: string;
  silent?: boolean;
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
      const specialized = await emailService.sendPurchaseConfirmation(data);
      if (specialized.success) {
        notify(true, 'Confirmation sent', '', opts?.silent);
        return specialized;
      }
      const html = renderPurchaseConfirmationHTML({
        ...data,
        baseUrl: opts?.baseUrl,
      });
      maybePreview(html, opts?.previewInBrowser && import.meta.env.DEV);
      const res = await emailService.sendEmail({
        to: data.customerEmail,
        subject: `Your tickets to ${data.eventTitle} are confirmed`,
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
      const specialized = await emailService.sendTicketReminder(data);
      if (specialized.success) {
        notify(true, 'Reminder sent', '', opts?.silent);
        return specialized;
      }
      const html = renderTicketReminderHTML({ ...data, baseUrl: opts?.baseUrl });
      maybePreview(html, opts?.previewInBrowser && import.meta.env.DEV);
      const res = await emailService.sendEmail({
        to: data.customerEmail,
        subject: `Reminder: ${data.eventTitle} is coming up`,
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
