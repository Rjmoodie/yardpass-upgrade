import { supabase } from '@/integrations/supabase/client';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface PurchaseConfirmationData {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  quantity: number;
  totalAmount: number; // cents by default
  orderId: string;
  ticketIds: string[];
  qrCodeUrl?: string;
}

export interface TicketReminderData {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  qrCodeUrl?: string;
}

type Result = { success: boolean; error?: string };

const FROM_DEFAULT = 'YardPass <onboarding@resend.dev>';

function logDev(label: string, payload: unknown) {
  if (import.meta.env.DEV) {
    // Avoid logging huge HTML; trim if needed
    if (typeof payload === 'string' && payload.length > 1000) {
      console.debug(`[EmailService] ${label}:`, payload.slice(0, 1000) + '…');
    } else {
      console.debug(`[EmailService] ${label}:`, payload);
    }
  }
}

export class EmailService {
  async sendEmail(options: EmailOptions): Promise<Result> {
    try {
      if (!options.to || !options.subject || !options.html) {
        return { success: false, error: 'Missing to/subject/html' };
      }

      logDev('sendEmail (to/subject)', { to: options.to, subject: options.subject });

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: options.to,
          subject: options.subject,
          html: options.html,
          from: options.from || FROM_DEFAULT,
        },
      });

      if (error) {
        console.error('[EmailService] send-email error:', error);
        return { success: false, error: error.message || 'send-email failed' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[EmailService] sendEmail exception:', err);
      return { success: false, error: err?.message || 'Failed to send email' };
    }
  }

  async sendPurchaseConfirmation(data: PurchaseConfirmationData): Promise<Result> {
    try {
      const { error } = await supabase.functions.invoke('send-purchase-confirmation', {
        body: data,
      });
      if (error) {
        console.warn('[EmailService] send-purchase-confirmation error:', error);
        return { success: false, error: error.message || 'send-purchase-confirmation failed' };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[EmailService] sendPurchaseConfirmation exception:', err);
      return { success: false, error: err?.message || 'Failed to send purchase confirmation' };
    }
  }

  async sendTicketReminder(data: TicketReminderData): Promise<Result> {
    try {
      const { error } = await supabase.functions.invoke('send-ticket-reminder', {
        body: data,
      });
      if (error) {
        console.warn('[EmailService] send-ticket-reminder error:', error);
        return { success: false, error: error.message || 'send-ticket-reminder failed' };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[EmailService] sendTicketReminder exception:', err);
      return { success: false, error: err?.message || 'Failed to send ticket reminder' };
    }
  }
}

export const emailService = new EmailService();