import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrderStatus } from '@/hooks/useOrderStatus';
import { useTickets } from '@/hooks/useTickets';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Ticket, ArrowLeft, CalendarPlus } from 'lucide-react';

interface TicketSuccessPageProps {
  onBack: () => void;
  onViewTickets?: () => void;
}

/**
 * Optional helper: ICS creation when orderStatus includes event timing.
 * If timing isn't available on the status payload, the Calendar button is hidden.
 */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toICSUTC = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const escapeICS = (s: string) =>
  (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function TicketSuccessPage({ onBack, onViewTickets }: TicketSuccessPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshTickets, forceRefreshTickets } = useTickets();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const navigate = useNavigate();

  // Get session ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  // Use order status hook to check payment status
  const { orderStatus, loading: statusLoading, refetch } = useOrderStatus(sessionId);

  const hasTiming = !!orderStatus;

  // Progress timer for better UX
  useEffect(() => {
    if (processing || statusLoading) {
      const interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
        setProgress(prev => Math.min(prev + 2, 90)); // Slow progress to 90%
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [processing, statusLoading]);

  // Auto-redirect after success or timeout
  useEffect(() => {
    if (orderStatus?.status === 'paid') {
      setProgress(100);
      toast({
        title: 'Payment Successful!',
        description: `Your tickets are ready! Redirecting to your tickets...`,
      });
      
      // Force refresh tickets and redirect to tickets page after 2 seconds
      const redirectTimer = setTimeout(async () => {
        try {
          // Force refresh tickets to ensure they're visible
          await forceRefreshTickets();
          
          if (onViewTickets) {
            onViewTickets();
          } else {
            // Fallback: navigate to tickets page
            window.location.href = '/tickets';
          }
        } catch (error) {
          console.error('Error refreshing tickets:', error);
          // Still redirect on error
          if (onViewTickets) {
            onViewTickets();
          } else {
            window.location.href = '/tickets';
          }
        }
      }, 2000);

      return () => clearTimeout(redirectTimer);
    }
  }, [orderStatus?.status, onViewTickets, forceRefreshTickets, toast]);

  // Timeout handler - redirect if taking too long
  useEffect(() => {
    if (timeElapsed >= 15) { // 15 seconds timeout
      toast({
        title: 'Taking longer than expected',
        description: 'Redirecting to your tickets page...',
        variant: 'default',
      });
      
      const timeoutRedirect = setTimeout(() => {
        onViewTickets?.();
      }, 1000);

      return () => clearTimeout(timeoutRedirect);
    }
  }, [timeElapsed, onViewTickets, toast]);

  // Process payment when order is found but not yet paid
  const processPayment = async () => {
    if (!sessionId || !user || processing) return;

    setProcessing(true);
    setProgress(20);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: { sessionId },
      });

      if (error) throw error;

      setProgress(80);
      
      // Refresh both order status and tickets list
      await Promise.all([refetch(), refreshTickets()]);
      
      setProgress(100);

      toast({
        title: 'Payment Successful!',
        description: `${data.order.tickets_count} tickets issued for ${data.order.event_title}`,
      });
    } catch (error: any) {
      console.error('Payment processing error:', error);
      toast({
        title: 'Payment Processing Error',
        description: error.message || 'Something went wrong. Please check your tickets page.',
        variant: 'destructive',
      });
      
      // Still redirect to tickets page in case the payment actually worked
      setTimeout(() => {
        onViewTickets?.();
      }, 3000);
    } finally {
      setProcessing(false);
    }
  };

  // Auto-process payment if order is found but still pending
  useEffect(() => {
    if (orderStatus?.status === 'pending' && !processing) {
      processPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatus?.status]);

  const loading = statusLoading || processing;

  const buildICS = () => {
    if (!orderStatus) return null;

    // Try a few common keys (support various function payloads)
    const title =
      (orderStatus as any).event_title ||
      (orderStatus as any).title ||
      'Event';

    const startISO: string =
      (orderStatus as any).event_start_at ||
      (orderStatus as any).start_at ||
      '';

    if (!startISO) return null;

    const endISO: string =
      (orderStatus as any).event_end_at ||
      (orderStatus as any).end_at ||
      new Date(new Date(startISO).getTime() + 2 * 60 * 60 * 1000).toISOString();

    const location =
      (orderStatus as any).event_location ||
      (orderStatus as any).location ||
      (orderStatus as any).venue ||
      '';

    const eventId =
      (orderStatus as any).event_id ||
      (orderStatus as any).id ||
      '';

    // Try to get event slug for better URL
    let eventUrl = `${window.location.origin}/events/${eventId}`;
    if (eventId) {
      // Fetch event to get slug if available
      supabase.from('events')
        .select('slug')
        .eq('id', eventId)
        .single()
        .then(({ data }) => {
          if (data?.slug) {
            eventUrl = `${window.location.origin}/events/${data.slug}`;
          }
        });
    }

    const url = eventId ? eventUrl : window.location.origin;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YardPass//TicketSuccess//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${(orderStatus as any).id || sessionId || Math.random().toString(36).slice(2)}@yardpass`,
      `DTSTAMP:${toICSUTC(new Date().toISOString())}`,
      `DTSTART:${toICSUTC(startISO)}`,
      `DTEND:${toICSUTC(endISO)}`,
      `SUMMARY:${escapeICS(title)}`,
      `DESCRIPTION:${escapeICS(`Your order is confirmed.\n${url}`)}`,
      `LOCATION:${escapeICS(location)}`,
      `URL:${url}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    return lines.join('\r\n');
  };

  const handleAddToCalendar = async () => {
    try {
      const content = buildICS();
      if (!content) return;

      const title =
        (orderStatus as any)?.event_title || (orderStatus as any)?.title || 'event';
      const fileName = `${String(title).replace(/[^\w\s-]/g, '')}.ics`;
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });

      // Try native share
      if (navigator.canShare && 'share' in navigator) {
        const file = new File([blob], fileName, { type: 'text/calendar' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: String(title), text: 'Add to calendar', files: [file] });
          toast({ title: 'Shared to Calendar apps' });
          return;
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: 'ICS downloaded', description: 'Open it to add to your calendar.' });
    } catch {
      toast({
        title: 'Calendar error',
        description: 'Could not generate calendar file.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-background dark:to-muted">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-bold text-green-600 mb-4">Processing Your Payment</h2>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-green-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            {timeElapsed < 3 && <p>Confirming your payment...</p>}
            {timeElapsed >= 3 && timeElapsed < 8 && <p>Creating your tickets...</p>}
            {timeElapsed >= 8 && timeElapsed < 12 && <p>Almost ready...</p>}
            {timeElapsed >= 12 && <p>Just a few more seconds...</p>}
          </div>
          
          <p className="text-xs text-muted-foreground mt-4">
            Time elapsed: {timeElapsed}s
          </p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Invalid Payment Session</h2>
            <p className="text-muted-foreground mb-4">
              No payment session found. Please try purchasing tickets again.
            </p>
            <Button onClick={onBack}>Return to Events</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-background dark:to-muted flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
          <p className="text-muted-foreground">Your tickets have been issued and are ready to use</p>
        </CardHeader>

        {orderStatus && orderStatus.status === 'paid' && (
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Event:</span>
                    <span className="font-medium">
                      {(orderStatus as any).event_title || (orderStatus as any).title || 'Event'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tickets:</span>
                    <span className="font-medium">{(orderStatus as any).tickets_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Paid:</span>
                    <span className="font-bold text-lg">${(orderStatus as any).total_amount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What's Next */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  What’s Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Check your email</p>
                    <p className="text-xs text-muted-foreground">
                      Confirmation and ticket details sent to your email
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Add to Calendar</p>
                    <p className="text-xs text-muted-foreground">
                      Download an .ics file to save the event to your calendar
                    </p>
                    {hasTiming && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleAddToCalendar}
                      >
                        <CalendarPlus className="w-4 h-4 mr-2" />
                        Add to Calendar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Event Day</p>
                    <p className="text-xs text-muted-foreground">
                      Show your QR code at the event entrance
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
              <Button
                onClick={onViewTickets}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Ticket className="w-4 h-4 mr-2" />
                View My Tickets
              </Button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-green-600 font-medium">
                🎉 Redirecting to your tickets in a few seconds...
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default TicketSuccessPage;
