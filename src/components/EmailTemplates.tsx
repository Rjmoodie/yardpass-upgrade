// src/components/EmailTemplates.tsx
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export interface OrgInfo {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
}

export interface EventInfo {
  title: string;
  date: string;
  location: string;
  venue?: string;
  coverImageUrl?: string;
  description?: string;
}

export interface PurchaseConfirmationTemplateProps {
  customerName: string;
  customerEmail?: string;
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
  orgInfo?: OrgInfo;
  eventInfo?: EventInfo;
}

export interface TicketReminderTemplateProps {
  customerName: string;
  customerEmail?: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  qrCodeUrl?: string;
  baseUrl?: string;
  preheaderText?: string;
  orgInfo?: OrgInfo;
  eventInfo?: EventInfo;
}

export interface EventUpdateTemplateProps {
  customerName: string;
  eventTitle: string;
  updateType: 'info' | 'venue_change' | 'time_change' | 'cancellation';
  updateMessage: string;
  eventDate: string;
  eventLocation: string;
  baseUrl?: string;
  preheaderText?: string;
  orgInfo?: OrgInfo;
  eventInfo?: EventInfo;
}

const getBaseUrl = (override?: string) => {
  if (override) return override;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://yardpass.tech';
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

/* ========================= BASE LAYOUT ========================= */

interface BaseEmailLayoutProps {
  children: React.ReactNode;
  orgInfo?: OrgInfo;
  preheaderText?: string;
}

const BaseEmailLayout: React.FC<BaseEmailLayoutProps> = ({ children, orgInfo, preheaderText }) => {
  const yardpassLogo = 'https://yardpass.tech/yardpass-logo.png';
  const currentYear = new Date().getFullYear();
  const supportEmail = orgInfo?.supportEmail || 'support@yardpass.tech';

  return (
    <div style={{ background: '#f4f4f5', padding: '32px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: '#0f172a' }}>
      {preheaderText && <HiddenPreheader text={preheaderText} />}

      <div style={{ maxWidth: 640, margin: '0 auto', background: '#ffffff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 30px rgba(15, 23, 42, 0.08)' }}>
        {/* Header with YardPass Logo */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '28px 32px', textAlign: 'center' }}>
          <img
            src={orgInfo?.logoUrl || yardpassLogo}
            alt={orgInfo?.name || 'YardPass'}
            style={{ height: 40, width: 'auto', marginBottom: 12 }}
          />
          <div style={{ fontSize: 13, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Powered by YardPass
          </div>
        </div>

        {/* Organization Info (if provided) */}
        {orgInfo && (
          <table width="100%" style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }} cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ padding: '20px 32px', width: 64 }}>
                  {orgInfo.logoUrl && (
                    <img
                      src={orgInfo.logoUrl}
                      alt={orgInfo.name}
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }}
                    />
                  )}
                </td>
                <td style={{ padding: '20px 32px 20px 0' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                    {orgInfo.name}
                  </div>
                  {orgInfo.websiteUrl && (
                    <a
                      href={orgInfo.websiteUrl}
                      style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none' }}
                    >
                      Visit website →
                    </a>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Main Content */}
        <div style={{ padding: '32px' }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', padding: '24px 32px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px 0' }}>
              Questions? Contact us at{' '}
              <a href={`mailto:${supportEmail}`} style={{ color: '#6366f1', textDecoration: 'none' }}>
                {supportEmail}
              </a>
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: 12 }}>
              © {currentYear} YardPass. All rights reserved.
            </p>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              <a href="https://yardpass.tech/privacy" style={{ color: '#94a3b8', textDecoration: 'none', margin: '0 8px' }}>
                Privacy Policy
              </a>
              •
              <a href="https://yardpass.tech/terms" style={{ color: '#94a3b8', textDecoration: 'none', margin: '0 8px' }}>
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================= PURCHASE CONFIRMATION TEMPLATE ========================= */

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
  orgInfo,
  eventInfo,
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const ticketUrl = `${siteUrl}/tickets`;
  const amountText = formatCurrency(totalAmount, currency, isAmountInCents);
  const dateText = tryFormatDate(eventInfo?.date || eventDate);
  const primaryLocation = eventInfo?.venue || eventLocation;
  const secondaryLocation = eventInfo?.location && eventInfo?.location !== eventInfo?.venue ? eventInfo.location : undefined;

  return (
    <BaseEmailLayout orgInfo={orgInfo} preheaderText={preheaderText}>
      <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', padding: '24px', borderRadius: 14, marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Purchase Confirmed!</h1>
        <p style={{ margin: '10px 0 0 0', fontSize: 15, opacity: 0.95 }}>Your tickets are ready to scan at the door.</p>
      </div>

      {eventInfo?.coverImageUrl && (
        <div style={{ marginBottom: 28, borderRadius: 16, overflow: 'hidden' }}>
          <img
            src={eventInfo.coverImageUrl}
            alt={eventInfo.title || eventTitle}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: 20, fontWeight: 600 }}>
          Hi {customerName} 👋
        </h2>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
          Thank you for your purchase! Your tickets for <strong>{eventInfo?.title || eventTitle}</strong> have been confirmed and are ready to use.
        </p>
      </div>

      <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 17, fontWeight: 600 }}>📅 Event Details</h3>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 0', fontSize: 13, color: '#64748b', width: '35%' }}>Event</td>
              <td style={{ padding: '6px 0', fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{eventInfo?.title || eventTitle}</td>
            </tr>
            {dateText && (
              <tr>
                <td style={{ padding: '6px 0', fontSize: 13, color: '#64748b' }}>Date &amp; Time</td>
                <td style={{ padding: '6px 0', fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{dateText}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '6px 0', fontSize: 13, color: '#64748b' }}>Location</td>
              <td style={{ padding: '6px 0', fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{primaryLocation}</td>
            </tr>
            {secondaryLocation && (
              <tr>
                <td style={{ padding: '6px 0', fontSize: 13, color: '#64748b' }}>City</td>
                <td style={{ padding: '6px 0', fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{secondaryLocation}</td>
              </tr>
            )}
            {eventInfo?.description && (
              <tr>
                <td style={{ padding: '6px 0', fontSize: 13, color: '#64748b', verticalAlign: 'top' }}>About</td>
                <td style={{ padding: '6px 0', fontSize: 14, color: '#475569', lineHeight: 1.6 }}>{eventInfo.description}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0c4a6e', fontSize: 17, fontWeight: 600 }}>🎟️ Your Tickets</h3>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 0', fontSize: 13, color: '#075985' }}>Ticket Type</td>
              <td style={{ padding: '6px 0', fontSize: 15, color: '#0c4a6e', fontWeight: 600, textAlign: 'right' }}>{ticketType}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 0', fontSize: 13, color: '#075985' }}>Quantity</td>
              <td style={{ padding: '6px 0', fontSize: 18, color: '#0c4a6e', fontWeight: 700, textAlign: 'right' }}>×{quantity}</td>
            </tr>
            {amountText && (
              <tr>
                <td style={{ padding: '12px 0 6px 0', fontSize: 15, color: '#0c4a6e', fontWeight: 500 }}>Total Paid</td>
                <td style={{ padding: '12px 0 6px 0', fontSize: 20, color: '#0c4a6e', fontWeight: 700, textAlign: 'right' }}>{amountText}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '6px 0', fontSize: 12, color: '#075985' }}>Order ID</td>
              <td style={{ padding: '6px 0', fontSize: 12, color: '#075985', fontFamily: 'monospace', textAlign: 'right' }}>{orderId}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: '16px 0 0 0', fontSize: 13, color: '#0369a1', lineHeight: 1.6 }}>
          Need to transfer tickets to a guest? Forward this email or share access from your YardPass account.
        </p>
      </div>

      {qrCodeUrl && (
        <div style={{ background: '#ffffff', border: '2px dashed #cbd5e1', borderRadius: 14, padding: 24, marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 600, marginBottom: 16 }}>Your Entry Pass</div>
          <img
            src={qrCodeUrl}
            alt="Entry QR Code"
            style={{ maxWidth: 200, height: 'auto', margin: '0 auto', display: 'block', border: '3px solid #0f172a', borderRadius: 12, padding: 10, background: '#fff' }}
          />
          <p style={{ margin: '16px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Present this QR code at check-in. Each ticket is also available in the YardPass app.
          </p>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <a
          href={ticketUrl}
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#ffffff',
            padding: '14px 36px',
            textDecoration: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            boxShadow: '0 12px 24px rgba(79, 70, 229, 0.25)',
          }}
        >
          View My Tickets →
        </a>
      </div>

      <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#713f12', fontSize: 16, fontWeight: 600 }}>✨ Helpful Tips</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#854d0e', fontSize: 14, lineHeight: 1.8 }}>
          <li>Add this event to your calendar and plan your arrival.</li>
          <li>Bring a valid ID and have your QR code ready for scanning.</li>
          <li>Need assistance? Reply to this email and our team will help.</li>
          <li>Save this email for easy access to your tickets and order details.</li>
        </ul>
      </div>
    </BaseEmailLayout>
  );
};

/* ========================= TICKET REMINDER TEMPLATE ========================= */

export const TicketReminderTemplate: React.FC<TicketReminderTemplateProps> = ({
  customerName,
  eventTitle,
  eventDate,
  eventLocation,
  ticketType,
  qrCodeUrl,
  baseUrl,
  preheaderText = "Your event is coming up - don't forget your tickets!",
  orgInfo,
  eventInfo,
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const ticketUrl = `${siteUrl}/tickets`;
  const dateText = tryFormatDate(eventInfo?.date || eventDate);

  return (
    <BaseEmailLayout orgInfo={orgInfo} preheaderText={preheaderText}>
      {/* Reminder Banner */}
      <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', padding: '20px 24px', borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏰</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Event Reminder</h1>
        <p style={{ margin: '8px 0 0 0', fontSize: 15, opacity: 0.95 }}>Your event is coming up soon!</p>
      </div>

      {/* Event Cover Image */}
      {eventInfo?.coverImageUrl && (
        <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}>
          <img 
            src={eventInfo.coverImageUrl} 
            alt={eventInfo.title || eventTitle}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: 20, fontWeight: 600 }}>
          Hi {customerName} 👋
        </h2>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
          Just a friendly reminder that <strong>{eventInfo?.title || eventTitle}</strong> is coming up! Make sure you're ready.
        </p>
      </div>

      {/* Event Details Card */}
      <div style={{ background: '#fef3c7', border: '1px solid #fde047', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#713f12', fontSize: 17, fontWeight: 600 }}>
          📅 Event Details
        </h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>Event</div>
            <div style={{ fontSize: 15, color: '#713f12', fontWeight: 500 }}>{eventInfo?.title || eventTitle}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>Date & Time</div>
            <div style={{ fontSize: 15, color: '#713f12', fontWeight: 500 }}>{dateText}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>Location</div>
            <div style={{ fontSize: 15, color: '#713f12', fontWeight: 500 }}>
              {eventInfo?.venue || eventLocation}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>Your Ticket</div>
            <div style={{ fontSize: 15, color: '#713f12', fontWeight: 500 }}>{ticketType}</div>
          </div>
        </div>
      </div>

      {/* QR Code */}
      {qrCodeUrl && (
        <div style={{ background: '#ffffff', border: '2px dashed #cbd5e1', borderRadius: 12, padding: 24, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 600, marginBottom: 16 }}>
            Your Entry Pass
          </div>
          <img 
            src={qrCodeUrl} 
            alt="Entry QR Code" 
            style={{ maxWidth: 200, height: 'auto', margin: '0 auto', display: 'block', border: '3px solid #0f172a', borderRadius: 8, padding: 8, background: '#fff' }}
          />
          <p style={{ margin: '16px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Have this ready at check-in
          </p>
        </div>
      )}

      {/* CTA Button */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <a
          href={ticketUrl}
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#ffffff',
            padding: '14px 32px',
            textDecoration: 'none',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          View My Tickets →
        </a>
      </div>

      {/* Event Checklist */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#14532d', fontSize: 16, fontWeight: 600 }}>
          ✓ Event Checklist
        </h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#166534', fontSize: 14, lineHeight: 1.8 }}>
          <li>Arrive 15 minutes early for check-in</li>
          <li>Bring a valid government-issued ID</li>
          <li>Have your QR code ready (digital or printed)</li>
          <li>Check the weather and dress appropriately</li>
          <li>Review parking/transportation options</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14, marginTop: 24, padding: '16px 0', borderTop: '1px solid #e2e8f0' }}>
        <p style={{ margin: 0 }}>See you at the event! 🎉</p>
      </div>
    </BaseEmailLayout>
  );
};

/* ========================= EVENT UPDATE TEMPLATE ========================= */

export const EventUpdateTemplate: React.FC<EventUpdateTemplateProps> = ({
  customerName,
  eventTitle,
  updateType,
  updateMessage,
  eventDate,
  eventLocation,
  baseUrl,
  preheaderText,
  orgInfo,
  eventInfo,
}) => {
  const siteUrl = getBaseUrl(baseUrl);
  const eventUrl = `${siteUrl}/events`;
  const dateText = tryFormatDate(eventInfo?.date || eventDate);

  const getBannerConfig = () => {
    switch (updateType) {
      case 'cancellation':
        return { bg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', icon: '⚠️', title: 'Event Cancelled' };
      case 'time_change':
        return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '🕐', title: 'Time Changed' };
      case 'venue_change':
        return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '📍', title: 'Venue Changed' };
      default:
        return { bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', icon: 'ℹ️', title: 'Event Update' };
    }
  };

  const config = getBannerConfig();

  return (
    <BaseEmailLayout orgInfo={orgInfo} preheaderText={preheaderText || `Important update about ${eventTitle}`}>
      {/* Update Banner */}
      <div style={{ background: config.bg, color: '#fff', padding: '20px 24px', borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{config.icon}</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{config.title}</h1>
        <p style={{ margin: '8px 0 0 0', fontSize: 15, opacity: 0.95 }}>{eventInfo?.title || eventTitle}</p>
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: 20, fontWeight: 600 }}>
          Hi {customerName},
        </h2>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
          We have an important update regarding <strong>{eventInfo?.title || eventTitle}</strong>.
        </p>
      </div>

      {/* Update Message */}
      <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#991b1b', fontSize: 17, fontWeight: 600 }}>
          What's Changed
        </h3>
        <p style={{ margin: 0, color: '#7f1d1d', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {updateMessage}
        </p>
      </div>

      {/* Event Details */}
      {updateType !== 'cancellation' && (
        <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 17, fontWeight: 600 }}>
            Current Event Details
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Event</div>
              <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{eventInfo?.title || eventTitle}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Date & Time</div>
              <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{dateText}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Location</div>
              <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>
                {eventInfo?.venue || eventLocation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA Button */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <a
          href={eventUrl}
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#ffffff',
            padding: '14px 32px',
            textDecoration: 'none',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          {updateType === 'cancellation' ? 'View Refund Options' : 'View Event Details'}
        </a>
      </div>

      {/* Help Section */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e', fontSize: 16, fontWeight: 600 }}>
          Need Help?
        </h3>
        <p style={{ margin: 0, color: '#075985', fontSize: 14, lineHeight: 1.6 }}>
          If you have questions about this update, please contact {orgInfo?.name || 'the event organizer'} or reach out to our support team.
        </p>
      </div>
    </BaseEmailLayout>
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

export const renderEventUpdateHTML = (props: EventUpdateTemplateProps) =>
  renderEmailTemplate(<EventUpdateTemplate {...props} />);