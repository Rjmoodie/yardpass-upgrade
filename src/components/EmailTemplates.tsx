// src/components/EmailTemplates.tsx
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export interface PurchaseConfirmationTemplateProps {
  customerName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  quantity: number;
  totalAmount: number;
  orderId: string;
  ticketIds: string[];
  qrCodeUrl?: string;
  baseUrl?: string;
  currency?: Currency;
  isAmountInCents?: boolean;
  preheaderText?: string;
}

export interface TicketReminderTemplateProps {
  customerName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  qrCodeUrl?: string;
  baseUrl?: string;
  preheaderText?: string;
}

const getBaseUrl = (override?: string) => {
  if (override) return override;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return (import.meta as any)?.env?.VITE_PUBLIC_SITE_URL || 'https://yardpass.com';
};

const formatCurrency = (amount: number, currency: Currency = 'USD', isAmountInCents = true) => {
  const n = isAmountInCents ? amount / 100 : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
};

const tryFormatDate = (input: string) => {
  const d = new Date(input);
  return isNaN(d.getTime())
    ? input
    : d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const HiddenPreheader: React.FC<{ text?: string }> = ({ text }) =>
  !text ? null : (
    <div style={{ display: 'none', overflow: 'hidden', lineHeight: '1px', opacity: 0, maxHeight: 0, maxWidth: 0 }}>
      {text}
    </div>
  );

const Outer: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = '#f6f7fb' }) => (
  <div style={{ background: bg, padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
    <div style={{ maxWidth: 640, margin: '0 auto' }}>{children}</div>
  </div>
);

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
  preheaderText = 'Your YardPass purchase is confirmed. View or download your tickets.',
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const ticketUrl = `${siteUrl}/tickets`;
  const amountText = formatCurrency(totalAmount, currency, isAmountInCents);
  const dateText = tryFormatDate(eventDate);

  return (
    <Outer>
      <HiddenPreheader text={preheaderText} />

      <div style={{ background: '#0b1324', color: '#fff', padding: 16, borderRadius: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Purchase Confirmation</h1>
        <p style={{ margin: '6px 0 0 0', color: '#c7d2fe' }}>Your tickets have been confirmed!</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#111827' }}>Hi {customerName},</h2>
        <p style={{ margin: 0, color: '#374151' }}>
          Thanks for your purchase! Your tickets for <strong>{eventTitle}</strong> are ready.
        </p>

        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: 16 }}>Event Details</h3>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Event:</strong> {eventTitle}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Date:</strong> {dateText}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Location:</strong> {eventLocation}</p>
        </div>

        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: 16 }}>Ticket Information</h3>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Ticket Type:</strong> {ticketType}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Quantity:</strong> {quantity}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Total Paid:</strong> {amountText}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Order ID:</strong> {orderId}</p>
          {!!ticketIds?.length && (
            <div style={{ marginTop: 6 }}>
              <div style={{ color: '#111827', fontWeight: 600, marginBottom: 4 }}>Ticket IDs</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#374151' }}>{ticketIds.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </div>

        {qrCodeUrl && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <img src={qrCodeUrl} alt="Your entry QR code" style={{ maxWidth: 180, height: 'auto' }} />
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Show this QR code at the event entrance</p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a
            href={ticketUrl}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              padding: '10px 18px',
              textDecoration: 'none',
              borderRadius: 8,
              display: 'inline-block',
              fontWeight: 700,
            }}
          >
            View Your Tickets
          </a>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: 16 }}>What’s Next?</h3>
          <ul style={{ color: '#374151', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
            <li>Save this email for your records</li>
            <li>Add the event to your calendar</li>
            <li>Arrive 15 minutes early for check-in</li>
            <li>Bring a valid ID and have your QR code ready</li>
          </ul>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
        <p>Need help? <a href="mailto:support@yardpass.com">support@yardpass.com</a></p>
        <p>© {new Date().getFullYear()} YardPass. All rights reserved.</p>
      </div>
    </Outer>
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
  preheaderText = 'Your event is coming up — don’t forget your tickets!',
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const ticketUrl = `${siteUrl}/tickets`;
  const dateText = tryFormatDate(eventDate);

  return (
    <Outer bg="#fffaf3">
      <HiddenPreheader text={preheaderText} />

      <div style={{ background: '#fef3c7', padding: 16, borderRadius: 10, marginBottom: 16 }}>
        <h1 style={{ color: '#92400e', margin: 0, fontSize: 20 }}>Event Reminder</h1>
        <p style={{ color: '#b45309', margin: '6px 0 0 0' }}>Your event is coming up soon!</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h2 style={{ color: '#111827', margin: '0 0 10px 0' }}>Hi {customerName},</h2>
        <p style={{ color: '#374151', margin: 0 }}>
          Just a friendly reminder that <strong>{eventTitle}</strong> is coming up!
        </p>

        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: 16 }}>Event Details</h3>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Event:</strong> {eventTitle}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Date:</strong> {dateText}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Location:</strong> {eventLocation}</p>
          <p style={{ margin: '4px 0', color: '#374151' }}><strong>Your Ticket:</strong> {ticketType}</p>
        </div>

        {qrCodeUrl && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <img src={qrCodeUrl} alt="Your entry QR code" style={{ maxWidth: 180, height: 'auto' }} />
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Your entry QR code</p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a
            href={ticketUrl}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              padding: '10px 18px',
              textDecoration: 'none',
              borderRadius: 8,
              display: 'inline-block',
              fontWeight: 700,
            }}
          >
            View Your Tickets
          </a>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: 16 }}>Event Checklist</h3>
          <ul style={{ color: '#374151', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
            <li>Arrive 15 minutes early</li>
            <li>Bring a valid ID</li>
            <li>Have your QR code ready</li>
            <li>Check the weather and dress accordingly</li>
          </ul>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
        <p>See you at the event!</p>
        <p>© {new Date().getFullYear()} YardPass. All rights reserved.</p>
      </div>
    </Outer>
  );
};

/* ========================= RENDER HELPERS ========================= */

export const renderEmailTemplate = (component: React.ReactElement): string => {
  const html = renderToStaticMarkup(component);
  return `<!DOCTYPE html><html><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0">${html}</body></html>`;
};

export const renderPurchaseConfirmationHTML = (props: PurchaseConfirmationTemplateProps) =>
  renderEmailTemplate(<PurchaseConfirmationTemplate {...props} />);

export const renderTicketReminderHTML = (props: TicketReminderTemplateProps) =>
  renderEmailTemplate(<TicketReminderTemplate {...props} />);
