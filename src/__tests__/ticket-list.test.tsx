import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TicketList } from '@/components/tickets/TicketList';
import type { UserTicket } from '@/hooks/useTickets';

const baseTicket: UserTicket = {
  id: 'ticket-1',
  eventId: 'event-1',
  eventTitle: 'Sunset Festival',
  eventDate: 'Friday, July 12, 2025',
  eventTime: '7:00 PM',
  eventLocation: 'The Pier, Miami',
  venue: 'The Pier',
  city: 'Miami',
  coverImage: 'https://example.com/cover.jpg',
  ticketType: 'VIP',
  badge: 'VIP',
  qrCode: 'qr-token',
  status: 'active',
  price: 150,
  orderDate: new Date().toISOString(),
  isUpcoming: true,
  organizerName: 'Liventix',
  startAtISO: new Date().toISOString(),
  endAtISO: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  timezone: 'America/New_York',
};

describe('TicketList', () => {
  it('groups upcoming and past tickets', async () => {
    const upcoming: UserTicket = { ...baseTicket, id: 'future-ticket', isUpcoming: true, eventTitle: 'Future Event' };
    const past: UserTicket = {
      ...baseTicket,
      id: 'past-ticket',
      isUpcoming: false,
      eventTitle: 'Past Event',
      startAtISO: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endAtISO: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    };

    render(
      <TicketList tickets={[upcoming, past]} loading={false} error={null} />,
    );

    const upcomingTab = screen.getByRole('tab', { name: /upcoming/i });
    const pastTab = screen.getByRole('tab', { name: /past/i });

    expect(upcomingTab).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(pastTab);
    expect(pastTab).toHaveAttribute('aria-selected', 'true');
  });
});

