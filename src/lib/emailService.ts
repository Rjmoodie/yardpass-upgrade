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

export class EmailService {
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: options.to,
          subject: options.subject,
          html: options.html,
          from: options.from || 'YardPass <noreply@yardpass.com>'
        }
      });

      if (error) {
        console.error('Email sending failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: 'Failed to send email' };
    }
  }

  async sendPurchaseConfirmation(data: PurchaseConfirmationData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('send-purchase-confirmation', {
        body: data
      });

      if (error) {
        console.error('Purchase confirmation email failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Purchase confirmation error:', error);
      return { success: false, error: 'Failed to send purchase confirmation' };
    }
  }

  async sendTicketReminder(data: TicketReminderData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('send-ticket-reminder', {
        body: data
      });

      if (error) {
        console.error('Ticket reminder email failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Ticket reminder error:', error);
      return { success: false, error: 'Failed to send ticket reminder' };
    }
  }
}

export const emailService = new EmailService();