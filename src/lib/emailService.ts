// src/lib/emailService.ts
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
  totalAmount: number;
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

type Result = { success: boolean; error?: string; provider?: string; id?: string };

const FROM_DEFAULT = 'YardPass <support@yardpass.tech>';

export class EmailService {
  async sendEmail(options: EmailOptions): Promise<Result> {
    try {
      if (!options.to || !options.subject || !options.html) {
        return { success: false, error: 'Missing to/subject/html' };
      }

      const { data, error } = await supabase.functions.invoke('send-email', {
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

      // surface provider details (if any)
      return { success: true, provider: data?.provider, id: data?.result?.id };
    } catch (err: any) {
      console.error('[EmailService] sendEmail exception:', err);
      return { success: false, error: err?.message || 'Failed to send email' };
    }
  }

  async sendPurchaseConfirmation(data: PurchaseConfirmationData): Promise<Result> {
    try {
      const { data: res, error } = await supabase.functions.invoke('send-purchase-confirmation', { body: data });
      if (error) {
        return { success: false, error: error.message || 'send-purchase-confirmation failed' };
      }
      return { success: true, provider: res?.provider, id: res?.id };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send purchase confirmation' };
    }
  }

  async sendTicketReminder(data: TicketReminderData): Promise<Result> {
    try {
      const { data: res, error } = await supabase.functions.invoke('send-ticket-reminder', { body: data });
      if (error) {
        return { success: false, error: error.message || 'send-ticket-reminder failed' };
      }
      return { success: true, provider: res?.provider, id: res?.id };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send ticket reminder' };
    }
  }
}

export const emailService = new EmailService();
