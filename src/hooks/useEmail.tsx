import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { emailService, EmailOptions, PurchaseConfirmationData, TicketReminderData } from '@/lib/emailService';
import {
  renderPurchaseConfirmationHTML,
  renderTicketReminderHTML,
} from '@/components/EmailTemplates';

type SendOpts = {
  /** If true in dev, open a window to preview the compiled HTML */
  previewInBrowser?: boolean;
  /** Override base URL for links inside the email HTML */
  baseUrl?: string;
  /** Suppress toasts (for silent programmatic flows) */
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
    if (ok) {
      toast({ title: okMsg, description: 'Email sent successfully.' });
    } else {
      toast({ title: errMsg, description: 'Please try again.', variant: 'destructive' });
    }
  };

  /** Generic raw HTML sender (goes to Supabase function `send-email`) */
  const sendEmail = async (options: EmailOptions, opts?: SendOpts) => {
    setIsLoading(true);
    try {
      maybePreview(options.html, opts?.previewInBrowser && import.meta.env.DEV);

      const res = await emailService.sendEmail(options);
      notify(res.success, 'Email sent', res.error || 'Email failed', opts?.silent);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  /** First try specialized function; if it fails, fall back to generic renderer + send-email */
  const sendPurchaseConfirmation = async (data: PurchaseConfirmationData, opts?: SendOpts) => {
    setIsLoading(true);
    try {
      // Try specialized function
      const specialized = await emailService.sendPurchaseConfirmation(data);
      if (specialized.success) {
        notify(true, 'Confirmation sent', '', opts?.silent);
        return specialized;
      }

      // Fallback to local render + generic sender
      const html = renderPurchaseConfirmationHTML({
        customerName: data.customerName,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        eventLocation: data.eventLocation,
        ticketType: data.ticketType,
        quantity: data.quantity,
        totalAmount: data.totalAmount,
        orderId: data.orderId,
        ticketIds: data.ticketIds,
        qrCodeUrl: data.qrCodeUrl,
        baseUrl: opts?.baseUrl,
      });

      maybePreview(html, opts?.previewInBrowser && import.meta.env.DEV);

      const res = await emailService.sendEmail({
        to: data.customerEmail,
        subject: `Your tickets to ${data.eventTitle} are confirmed`,
        html,
      });

      notify(res.success, 'Confirmation sent', res.error || 'Confirmation failed', opts?.silent);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendTicketReminder = async (data: TicketReminderData, opts?: SendOpts) => {
    setIsLoading(true);
    try {
      // Try specialized function
      const specialized = await emailService.sendTicketReminder(data);
      if (specialized.success) {
        notify(true, 'Reminder sent', '', opts?.silent);
        return specialized;
      }

      // Fallback to local render + generic sender
      const html = renderTicketReminderHTML({
        customerName: data.customerName,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        eventLocation: data.eventLocation,
        ticketType: data.ticketType,
        qrCodeUrl: data.qrCodeUrl,
        baseUrl: opts?.baseUrl,
      });

      maybePreview(html, opts?.previewInBrowser && import.meta.env.DEV);

      const res = await emailService.sendEmail({
        to: data.customerEmail,
        subject: `Reminder: ${data.eventTitle} is coming up`,
        html,
      });

      notify(res.success, 'Reminder sent', res.error || 'Reminder failed', opts?.silent);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    sendEmail,
    sendPurchaseConfirmation,
    sendTicketReminder,
  };
}