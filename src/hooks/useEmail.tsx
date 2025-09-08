import { useState } from 'react';
import { emailService, EmailOptions, PurchaseConfirmationData, TicketReminderData } from '@/lib/emailService';
import { toast } from '@/hooks/use-toast';

export function useEmail() {
  const [isLoading, setIsLoading] = useState(false);

  const sendEmail = async (options: EmailOptions) => {
    setIsLoading(true);
    try {
      const result = await emailService.sendEmail(options);
      
      if (result.success) {
        toast({
          title: "Email sent",
          description: "Email was sent successfully",
        });
      } else {
        toast({
          title: "Email failed",
          description: result.error || "Failed to send email",
          variant: "destructive",
        });
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const sendPurchaseConfirmation = async (data: PurchaseConfirmationData) => {
    setIsLoading(true);
    try {
      const result = await emailService.sendPurchaseConfirmation(data);
      
      if (result.success) {
        toast({
          title: "Confirmation sent",
          description: "Purchase confirmation email sent successfully",
        });
      } else {
        toast({
          title: "Confirmation failed",
          description: result.error || "Failed to send confirmation email",
          variant: "destructive",
        });
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const sendTicketReminder = async (data: TicketReminderData) => {
    setIsLoading(true);
    try {
      const result = await emailService.sendTicketReminder(data);
      
      if (result.success) {
        toast({
          title: "Reminder sent",
          description: "Ticket reminder email sent successfully",
        });
      } else {
        toast({
          title: "Reminder failed",
          description: result.error || "Failed to send reminder email",
          variant: "destructive",
        });
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    sendEmail,
    sendPurchaseConfirmation,
    sendTicketReminder
  };
}