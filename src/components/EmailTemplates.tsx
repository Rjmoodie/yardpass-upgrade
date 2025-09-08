import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export interface PurchaseConfirmationTemplateProps {
  customerName: string;
  eventTitle: string;
  eventDate: string;          // Accepts preformatted string OR ISO
  eventLocation: string;
  ticketType: string;
  quantity: number;
  totalAmount: number;        // In cents by default unless isAmountInCents=false
  orderId: string;
  ticketIds: string[];
  qrCodeUrl?: string;
  baseUrl?: string;           // Optional override for emails rendered server-side
  currency?: Currency;        // default 'USD'
  isAmountInCents?: boolean;  // default true
  preheaderText?: string;
}

export interface TicketReminderTemplateProps {
  customerName: string;
  eventTitle: string;
  eventDate: string;          // Accepts preformatted string OR ISO
  eventLocation: string;
  ticketType: string;
  qrCodeUrl?: string;
  baseUrl?: string;           // Optional override for emails rendered server-side
  preheaderText?: string;
}

const getBaseUrl = (override?: string) => {
  if (override) return override;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // Fallback for server/edge
  // Configure in your .env as VITE_PUBLIC_SITE_URL (or change to your own env key)
  // This avoids broken links when rendering on the server
  return (import.meta as any)?.env?.VITE_PUBLIC_SITE_URL || 'https://yardpass.com';
};

const formatCurrency = (
  amount: number,
  currency: Currency = 'USD',
  isAmountInCents = true
) => {
  const n = isAmountInCents ? amount / 100 : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(n);
};

const tryFormatDate = (input: string) => {
  // If it's an ISO date string, format it nicely. Otherwise, assume it's already formatted.
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return input;
};

const HiddenPreheader: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  // Preheader improves inbox preview — hidden in the body
  return (
    <div
      style={{
        display: 'none',
        overflow: 'hidden',
        lineHeight: '1px',
        opacity: 0,
        maxHeight: 0,
        maxWidth: 0,
      }}
    >
      {text}
    </div>
  );
};

/* ========================= TEMPLATES ========================= */

export const PurchaseConfirmationTemplate: React.FC<PurchaseConfirmationTemplateProps> = ({
  customerName,
  eventTitle,
  eventDate,
  eventLocation,
  ticketType,
  quantity,
  totalAmount,
  orderId,
  ticketIds,
  qrCodeUrl,
  baseUrl,
  currency = 'USD',
  isAmountInCents = true,
  preheaderText = 'Your YardPass purchase is confirmed. View or download your tickets.'
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const ticketUrl = `${siteUrl}/tickets`;
  const amountText = formatCurrency(totalAmount, currency, isAmountInCents);
  const dateText = tryFormatDate(eventDate);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#f6f7fb', padding: 20 }}>
      <HiddenPreheader text={preheaderText} />
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <h1 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Purchase Confirmation</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Your tickets have been confirmed!</p>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h2 style={{ color: '#1e293b', margin: '0 0 15px 0' }}>Hi {customerName},</h2>
          <p style={{ color: '#374151', lineHeight: 1.6, margin: '0 0 15px 0' }}>
            Thanks for your purchase! Your tickets for <strong>{eventTitle}</strong> are ready.
          </p>

          <div style={{ backgroundColor: '#f1f5f9', padding: 15, borderRadius: 6, margin: '20px 0' }}>
            <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Event Details</h3>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Event:</strong> {eventTitle}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Date:</strong> {dateText}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Location:</strong> {eventLocation}</p>
          </div>

          <div style={{ backgroundColor: '#f1f5f9', padding: 15, borderRadius: 6, margin: '20px 0' }}>
            <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Ticket Information</h3>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Ticket Type:</strong> {ticketType}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Quantity:</strong> {quantity}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Total Paid:</strong> {amountText}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Order ID:</strong> {orderId}</p>
            {ticketIds?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: '#1e293b', fontWeight: 600, marginBottom: 6 }}>Ticket IDs</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#374151' }}>
                  {ticketIds.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>

          {qrCodeUrl && (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <img src={qrCodeUrl} alt="Your entry QR code" style={{ maxWidth: 200, height: 'auto' }} />
              <p style={{ color: '#64748b', fontSize: 14, margin: '10px 0 0 0' }}>
                Show this QR code at the event entrance
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center', margin: '30px 0' }}>
            <a
              href={ticketUrl}
              style={{
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: 6,
                display: 'inline-block',
                fontWeight: 700
              }}
            >
              View Your Tickets
            </a>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 20 }}>
            <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>What’s Next?</h3>
            <ul style={{ color: '#374151', lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
              <li>Save this email for your records</li>
              <li>Add the event to your calendar</li>
              <li>Arrive 15 minutes early for check-in</li>
              <li>Bring a valid ID and have your QR code ready</li>
            </ul>
          </div>
        </div>

        <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <p>Need help? Contact us at <a href="mailto:support@yardpass.com">support@yardpass.com</a></p>
          <p>© {new Date().getFullYear()} YardPass. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export const TicketReminderTemplate: React.FC<TicketReminderTemplateProps> = ({
  customerName,
  eventTitle,
  eventDate,
  eventLocation,
  ticketType,
  qrCodeUrl,
  baseUrl,
  preheaderText = 'Your event is coming up — don’t forget your tickets!'
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const ticketUrl = `${siteUrl}/tickets`;
  const dateText = tryFormatDate(eventDate);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#fffaf3', padding: 20 }}>
      <HiddenPreheader text={preheaderText} />
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ backgroundColor: '#fef3c7', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <h1 style={{ color: '#92400e', margin: '0 0 10px 0' }}>Event Reminder</h1>
          <p style={{ color: '#d97706', margin: 0 }}>Your event is coming up soon!</p>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h2 style={{ color: '#1e293b', margin: '0 0 15px 0' }}>Hi {customerName},</h2>
          <p style={{ color: '#374151', lineHeight: 1.6, margin: '0 0 15px 0' }}>
            Just a friendly reminder that <strong>{eventTitle}</strong> is coming up!
          </p>

          <div style={{ backgroundColor: '#f1f5f9', padding: 15, borderRadius: 6, margin: '20px 0' }}>
            <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Event Details</h3>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Event:</strong> {eventTitle}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Date:</strong> {dateText}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Location:</strong> {eventLocation}</p>
            <p style={{ margin: '5px 0', color: '#374151' }}><strong>Your Ticket:</strong> {ticketType}</p>
          </div>

          {qrCodeUrl && (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <img src={qrCodeUrl} alt="Your entry QR code" style={{ maxWidth: 200, height: 'auto' }} />
              <p style={{ color: '#64748b', fontSize: 14, margin: '10px 0 0 0' }}>
                Your entry QR code
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center', margin: '30px 0' }}>
            <a
              href={ticketUrl}
              style={{
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: 6,
                display: 'inline-block',
                fontWeight: 700
              }}
            >
              View Your Tickets
            </a>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 20 }}>
            <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Event Checklist</h3>
            <ul style={{ color: '#374151', lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
              <li>Arrive 15 minutes early</li>
              <li>Bring a valid ID</li>
              <li>Have your QR code ready</li>
              <li>Check the weather and dress accordingly</li>
            </ul>
          </div>
        </div>

        <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <p>See you at the event!</p>
          <p>© {new Date().getFullYear()} YardPass. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

/* ========================= RENDER HELPERS ========================= */

export const renderEmailTemplate = (component: React.ReactElement): string => {
  // Safer, production-ready static markup render
  const html = renderToStaticMarkup(component);
  // Add minimal doc structure + charset
  return `<!DOCTYPE html><html><head><meta charSet="utf-8" /></head><body>${html}</body></html>`;
};

// Convenience helpers so you can do: renderPurchaseConfirmationHTML(data)
export const renderPurchaseConfirmationHTML = (props: PurchaseConfirmationTemplateProps) =>
  renderEmailTemplate(<PurchaseConfirmationTemplate {...props} />);

export const renderTicketReminderHTML = (props: TicketReminderTemplateProps) =>
  renderEmailTemplate(<TicketReminderTemplate {...props} />);