import { render, screen } from '@testing-library/react';
import { EventCard } from '@/components/search/EventCard';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

// Mock EventCard component for testing
const mockEvent = {
  id: '1',
  title: 'Test Event',
  description: 'A test event',
  start_at: '2024-12-31T20:00:00Z',
  city: 'Test City',
  venue: 'Test Venue',
  cover_image_url: 'https://example.com/image.jpg',
  category: 'music',
  price_range: '$10-$50',
  distance: 5.2,
  rating: 4.5,
  organizer_name: 'Test Organizer',
};

const mockOnClick = () => {};

describe('EventCard', () => {
  it('renders event without sponsor correctly', () => {
    render(<EventCard event={mockEvent} onClick={mockOnClick} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Test City')).toBeInTheDocument();
    expect(screen.queryByText(/Sponsored by/)).not.toBeInTheDocument();
  });

  it('renders active sponsor when present', () => {
    const eventWithSponsor = {
      ...mockEvent,
      sponsor: {
        name: 'Active Sponsor',
        logo_url: 'https://example.com/logo.jpg',
        tier: 'Gold',
        amount_cents: 50000
      }
    };

    render(<EventCard event={eventWithSponsor} onClick={mockOnClick} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Sponsored by Active Sponsor')).toBeInTheDocument();
  });

  it('does not render sponsor when sponsor is null', () => {
    const eventWithNullSponsor = {
      ...mockEvent,
      sponsor: null
    };

    render(<EventCard event={eventWithNullSponsor} onClick={mockOnClick} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.queryByText(/Sponsored by/)).not.toBeInTheDocument();
  });

  it('does not render sponsor when sponsor is undefined', () => {
    const eventWithUndefinedSponsor = {
      ...mockEvent,
      sponsor: undefined
    };

    render(<EventCard event={eventWithUndefinedSponsor} onClick={mockOnClick} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.queryByText(/Sponsored by/)).not.toBeInTheDocument();
  });

  it('renders sponsor with logo when logo_url is provided', () => {
    const eventWithSponsorLogo = {
      ...mockEvent,
      sponsor: {
        name: 'Logo Sponsor',
        logo_url: 'https://example.com/sponsor-logo.png',
        tier: 'Platinum',
        amount_cents: 100000
      }
    };

    render(<EventCard event={eventWithSponsorLogo} onClick={mockOnClick} />);
    
    expect(screen.getByText('Sponsored by Logo Sponsor')).toBeInTheDocument();
    const logoImg = screen.getByRole('img', { name: /Logo Sponsor logo/i });
    expect(logoImg).toHaveAttribute('src', 'https://example.com/sponsor-logo.png');
  });

  it('renders sponsor without logo when logo_url is not provided', () => {
    const eventWithSponsorNoLogo = {
      ...mockEvent,
      sponsor: {
        name: 'No Logo Sponsor',
        tier: 'Silver',
        amount_cents: 25000
      }
    };

    render(<EventCard event={eventWithSponsorNoLogo} onClick={mockOnClick} />);
    
    expect(screen.getByText('Sponsored by No Logo Sponsor')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /No Logo Sponsor logo/i })).not.toBeInTheDocument();
  });

  describe('multiple sponsors (should only show primary)', () => {
    it('shows only primary sponsor when sponsors array exists', () => {
      const eventWithMultipleSponsors = {
        ...mockEvent,
        sponsor: {
          name: 'Primary Sponsor',
          logo_url: 'https://example.com/primary.jpg',
          tier: 'Gold',
          amount_cents: 75000
        },
        sponsors: [
          {
            name: 'Primary Sponsor',
            logo_url: 'https://example.com/primary.jpg',
            tier: 'Gold',
            amount_cents: 75000
          },
          {
            name: 'Secondary Sponsor',
            logo_url: 'https://example.com/secondary.jpg',
            tier: 'Silver',
            amount_cents: 25000
          }
        ]
      };

      render(<EventCard event={eventWithMultipleSponsors} onClick={mockOnClick} />);
      
      expect(screen.getByText('Sponsored by Primary Sponsor')).toBeInTheDocument();
      expect(screen.queryByText('Secondary Sponsor')).not.toBeInTheDocument();
    });
  });
});