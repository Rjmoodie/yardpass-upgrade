import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/* ----------------------------- ICS helpers ----------------------------- */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toICSUTC = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const escapeICS = (s: string) =>
  (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const formatUSD = (val: number | string | undefined) => {
  const num =
    typeof val === 'number'
      ? val
      : typeof val === 'string'
      ? Number(val)
      : 0;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(num) ? num : 0
  );
};

export function TicketSuccessPage({ onBack, onViewTickets }: TicketSuccessPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshTickets, forceRefreshTickets } = useTickets();

  // safer: compute once
  const sessionId = useMemo(() => new URLSearchParams(window.location.search).get('session_id'), []);

  const { orderStatus, loading: statusLoading, refetch } = useOrderStatus(sessionId);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const timers = useRef<{ progress?: number; timeout?: number; success?: number }>({});

  const goToTickets = useCallback(() => {
    if (onViewTickets) onViewTickets();
    else navigate('/tickets', { replace: true });
  }, [onViewTickets, navigate]);

  const eventMeta = useMemo(() => {
    const os: any = orderStatus ?? {};
    const start = os.event_start_at || os.start_at || '';
    const end =
      os.event_end_at ||
      os.end_at ||
      (start ? new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString() : '');
    return {
      title: os.event_title || os.title || 'Event',
      start,
      end,
      location: os.event_location || os.location || os.venue || '',
      eventId: os.event_id || os.id || '',
      ticketsCount: os.tickets_count ?? 0,
      // prefer cents when present; fallback to preformatted or number
      totalAmountDisplay:
        os.total_amount_cents != null
          ? formatUSD((Number(os.total_amount_cents) || 0) / 100)
          : formatUSD(os.total_amount),
      hasTiming: Boolean(start),
      uid: (os.id || sessionId || Math.random().toString(36).slice(2)) + '@liventix',
    };
  }, [orderStatus, sessionId]);

  /* --------------------------- Progress animation --------------------------- */
  useEffect(() => {
    // Kick the gentle progress while loading/processing
    if (statusLoading || processing) {
      timers.current.progress = window.setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
        setProgress((prev) => {
          // ease up to 90% while waiting
          if (prev >= 90) return prev;
          const step = prev < 30 ? 5 : prev < 60 ? 3 : 2;
          return Math.min(prev + step, 90);
        });
      }, 300);
    }
    return () => {
      if (timers.current.progress) window.clearInterval(timers.current.progress);
      timers.current.progress = undefined;
    };
  }, [statusLoading, processing]);

  /* -------------------------- Success auto-redirect ------------------------- */
  useEffect(() => {
    if (orderStatus?.status === 'paid') {
      setProgress(100);
      // Give users a beat to read the success card, then go
      timers.current.success = window.setTimeout(async () => {
        try {
          await forceRefreshTickets();
        } catch (e) {
          // non-fatal
          console.warn('Ticket refresh before redirect failed:', e);
        } finally {
          goToTickets();
        }
      }, 2000);
      return () => {
        if (timers.current.success) window.clearTimeout(timers.current.success);
        timers.current.success = undefined;
      };
    }
  }, [orderStatus?.status, forceRefreshTickets, goToTickets]);

  /* --------------------------- Fallback timeout ---------------------------- */
  useEffect(() => {
    if (!orderStatus || orderStatus.status !== 'paid') {
      if (timeElapsed >= 15 && !processing) {
        toast({
          title: 'Taking longer than expected',
          description: 'We’ll take you to your tickets so you can check status there.',
        });
        timers.current.timeout = window.setTimeout(() => goToTickets(), 1000);
      }
      return () => {
        if (timers.current.timeout) window.clearTimeout(timers.current.timeout);
        timers.current.timeout = undefined;
      };
    }
  }, [timeElapsed, orderStatus, processing, goToTickets, toast]);

  /* ----------------------------- Payment action ---------------------------- */
  const processPayment = useCallback(async () => {
    if (!sessionId || !user || processing) return;
    setProcessing(true);
    setProgress((p) => Math.max(p, 20));
    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: { sessionId },
      });
      if (error) throw error;

      setProgress(85);
      await Promise.allSettled([refetch(), refreshTickets()]);
      setProgress(100);

      const ticketsCount = data?.order?.tickets_count ?? eventMeta.ticketsCount ?? 0;
      toast({
        title: 'Payment Successful!',
        description: `${ticketsCount} ticket${ticketsCount === 1 ? '' : 's'} issued${
          data?.order?.event_title ? ` for ${data.order.event_title}` : ''
        }`,
      });
    } catch (err: any) {
      console.error('Payment processing error:', err);
      toast({
        title: 'Payment Processing Error',
        description: err?.message || 'Something went wrong. Please check your tickets page.',
        variant: 'destructive',
      });
      // Still head to tickets — Stripe webhooks might have completed.
      window.setTimeout(() => goToTickets(), 2500);
    } finally {
      setProcessing(false);
    }
  }, [sessionId, user, processing, refetch, refreshTickets, toast, goToTickets, eventMeta.ticketsCount]);

  // Auto-process pending orders once discovered
  useEffect(() => {
    if (orderStatus?.status === 'pending' && !processing) {
      processPayment();
    }
  }, [orderStatus?.status, processing, processPayment]);

  /* ----------------------------- Calendar export --------------------------- */
  const handleAddToCalendar = useCallback(async () => {
    try {
      if (!eventMeta.hasTiming) return;

      // Build shareable URL with slug when available
      let url = `${window.location.origin}`;
      try {
        if (eventMeta.eventId) {
          const { data: e } = await supabase.from('events').select('slug').eq('id', eventMeta.eventId).single();
          url = `${window.location.origin}/events/${e?.slug || eventMeta.eventId}`;
        }
      } catch {
        url = `${window.location.origin}/events/${eventMeta.eventId || ''}`;
      }

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Liventix//TicketSuccess//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${eventMeta.uid}`,
        `DTSTAMP:${toICSUTC(new Date().toISOString())}`,
        `DTSTART:${toICSUTC(eventMeta.start)}`,
        `DTEND:${toICSUTC(eventMeta.end)}`,
        `SUMMARY:${escapeICS(eventMeta.title)}`,
        `DESCRIPTION:${escapeICS(`Your order is confirmed.\n${url}`)}`,
        `LOCATION:${escapeICS(eventMeta.location)}`,
        `URL:${url}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const fileName = `${String(eventMeta.title).replace(/[^\w\s-]/g, '')}.ics`;
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });

      // Prefer native share with file if supported
      if (typeof navigator !== 'undefined' && navigator.canShare && 'share' in navigator) {
        const file = new File([blob], fileName, { type: 'text/calendar' });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({ title: eventMeta.title, text: 'Add to calendar', files: [file] });
          toast({ title: 'Shared to Calendar apps' });
          return;
        }
      }

      // Fallback: download
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      toast({ title: 'ICS downloaded', description: 'Open it to add to your calendar.' });
    } catch {
      toast({
        title: 'Calendar error',
        description: 'Could not generate calendar file.',
        variant: 'destructive',
      });
    }
  }, [eventMeta, toast]);

  const loading = statusLoading || processing;

  /* --------------------------------- UI ---------------------------------- */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-background dark:to-muted"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600 animate-pulse" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-4">Processing Your Payment</h2>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
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

          <p className="text-xs text-muted-foreground mt-4">Time elapsed: {timeElapsed}s</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Invalid Payment Session</h2>
            <p className="text-muted-foreground mb-4">No payment session found. Please try purchasing tickets again.</p>
            <Button onClick={onBack}>Return to Events</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Failed or canceled edge case
  if (orderStatus?.status && ['failed', 'canceled'].includes(orderStatus.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Payment {orderStatus.status === 'failed' ? 'Failed' : 'Canceled'}</CardTitle>
            <p className="text-muted-foreground">You can retry or return to events.</p>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
            <Button onClick={processPayment} className="flex-1">
              Retry Now
            </Button>
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
            <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
          <p className="text-muted-foreground">Your tickets have been issued and are ready to use</p>
        </CardHeader>

        {orderStatus?.status === 'paid' && (
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Event:</span>
                    <span className="font-medium">{eventMeta.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tickets:</span>
                    <span className="font-medium">{eventMeta.ticketsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Paid:</span>
                    <span className="font-bold text-lg">{eventMeta.totalAmountDisplay}</span>
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
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="font-medium">Check your email</p>
                    <p className="text-xs text-muted-foreground">Confirmation and ticket details sent to your email</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="font-medium">Add to Calendar</p>
                    <p className="text-xs text-muted-foreground">Download an .ics file to save the event to your calendar</p>
                    {eventMeta.hasTiming && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={handleAddToCalendar}>
                        <CalendarPlus className="w-4 h-4 mr-2" />
                        Add to Calendar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="font-medium">Event Day</p>
                    <p className="text-xs text-muted-foreground">Show your QR code at the event entrance</p>
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
              <Button onClick={goToTickets} className="flex-1 bg-green-600 hover:bg-green-700">
                <Ticket className="w-4 h-4 mr-2" />
                View My Tickets
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-green-600 font-medium">🎉 Redirecting to your tickets in a few seconds...</p>
            </div>
          </CardContent>
        )}

        {/* Pending: offer a clear manual retry */}
        {orderStatus?.status === 'pending' && (
          <CardContent className="space-y-4">
            <Card className="bg-muted/40">
              <CardContent className="p-4 text-sm">
                We’re confirming your payment. This typically takes a few seconds.
                If it’s taking too long, you can retry processing now.
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
              <Button onClick={processPayment} className="flex-1">
                Retry Now
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default TicketSuccessPage;