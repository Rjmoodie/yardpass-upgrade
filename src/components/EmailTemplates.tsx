import React from 'react';

interface PurchaseConfirmationTemplateProps {
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
}

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
  qrCodeUrl
}) => {
  const baseUrl = window.location.origin;
  const ticketUrl = `${baseUrl}/tickets`;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Purchase Confirmation</h1>
        <p style={{ color: '#64748b', margin: '0' }}>Your tickets have been confirmed!</p>
      </div>

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ color: '#1e293b', margin: '0 0 15px 0' }}>Hi {customerName},</h2>
        <p style={{ color: '#374151', lineHeight: '1.6', margin: '0 0 15px 0' }}>
          Thank you for your purchase! Your tickets for <strong>{eventTitle}</strong> have been confirmed.
        </p>

        <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '6px', margin: '20px 0' }}>
          <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Event Details</h3>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Event:</strong> {eventTitle}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Date:</strong> {eventDate}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Location:</strong> {eventLocation}</p>
        </div>

        <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '6px', margin: '20px 0' }}>
          <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Ticket Information</h3>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Ticket Type:</strong> {ticketType}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Quantity:</strong> {quantity}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Total Amount:</strong> ${(totalAmount / 100).toFixed(2)}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Order ID:</strong> {orderId}</p>
        </div>

        {qrCodeUrl && (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <img src={qrCodeUrl} alt="QR Code" style={{ maxWidth: '200px', height: 'auto' }} />
            <p style={{ color: '#64748b', fontSize: '14px', margin: '10px 0 0 0' }}>
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
              borderRadius: '6px',
              display: 'inline-block',
              fontWeight: 'bold'
            }}
          >
            View Your Tickets
          </a>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '20px' }}>
          <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>What's Next?</h3>
          <ul style={{ color: '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
            <li>Save this confirmation email for your records</li>
            <li>Add the event to your calendar</li>
            <li>Arrive 15 minutes early for check-in</li>
            <li>Bring a valid ID and show your QR code</li>
          </ul>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
        <p>Need help? Contact us at support@yardpass.com</p>
        <p>© 2024 YardPass. All rights reserved.</p>
      </div>
    </div>
  );
};

interface TicketReminderTemplateProps {
  customerName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  qrCodeUrl?: string;
}

export const TicketReminderTemplate: React.FC<TicketReminderTemplateProps> = ({
  customerName,
  eventTitle,
  eventDate,
  eventLocation,
  ticketType,
  qrCodeUrl
}) => {
  const baseUrl = window.location.origin;
  const ticketUrl = `${baseUrl}/tickets`;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ color: '#92400e', margin: '0 0 10px 0' }}>Event Reminder</h1>
        <p style={{ color: '#d97706', margin: '0' }}>Your event is coming up soon!</p>
      </div>

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ color: '#1e293b', margin: '0 0 15px 0' }}>Hi {customerName},</h2>
        <p style={{ color: '#374151', lineHeight: '1.6', margin: '0 0 15px 0' }}>
          Just a friendly reminder that <strong>{eventTitle}</strong> is coming up soon!
        </p>

        <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '6px', margin: '20px 0' }}>
          <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Event Details</h3>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Event:</strong> {eventTitle}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Date:</strong> {eventDate}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Location:</strong> {eventLocation}</p>
          <p style={{ margin: '5px 0', color: '#374151' }}><strong>Your Ticket:</strong> {ticketType}</p>
        </div>

        {qrCodeUrl && (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <img src={qrCodeUrl} alt="QR Code" style={{ maxWidth: '200px', height: 'auto' }} />
            <p style={{ color: '#64748b', fontSize: '14px', margin: '10px 0 0 0' }}>
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
              borderRadius: '6px',
              display: 'inline-block',
              fontWeight: 'bold'
            }}
          >
            View Your Tickets
          </a>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '20px' }}>
          <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Event Checklist</h3>
          <ul style={{ color: '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
            <li>Arrive 15 minutes early</li>
            <li>Bring a valid ID</li>
            <li>Have your QR code ready</li>
            <li>Check the weather and dress accordingly</li>
          </ul>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
        <p>See you at the event!</p>
        <p>© 2024 YardPass. All rights reserved.</p>
      </div>
    </div>
  );
};

// Helper function to generate HTML from React components
export const renderEmailTemplate = (component: React.ReactElement): string => {
  // This is a simple implementation - in production you might want to use react-dom/server
  // For now, we'll return a basic HTML structure
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Email</title></head><body>${component}</body></html>`;
};