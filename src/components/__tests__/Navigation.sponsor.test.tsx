import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Navigation from '@/components/Navigation';
import { BrowserRouter } from 'react-router-dom';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { useAuth } from '@/contexts/AuthContext';
import '@testing-library/jest-dom';

// Mock hooks
vi.mock('@/hooks/useSponsorMode');
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useAnalyticsIntegration', () => ({
  useAnalyticsIntegration: () => ({
    trackNavigation: vi.fn(),
  }),
}));

const mockUseSponsorMode = useSponsorMode as any;
const mockUseAuth = useAuth as any;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Navigation - Sponsor Mode Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default auth state
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    });
  });

  it('does not show sponsor menu item when sponsor mode is disabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    renderWithRouter(
      <Navigation userRole="attendee" />
    );

    expect(screen.queryByLabelText(/Navigate to Sponsor/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Sponsor')).not.toBeInTheDocument();
  });

  it('shows sponsor menu item when sponsor mode is enabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: true,
      loading: false,
    });

    renderWithRouter(
      <Navigation userRole="attendee" />
    );

    expect(screen.getByLabelText(/Navigate to Sponsor/i)).toBeInTheDocument();
    expect(screen.getByText('Sponsor')).toBeInTheDocument();
  });

  it('hides sponsor menu for organizers when sponsor mode is disabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    renderWithRouter(
      <Navigation userRole="organizer" />
    );

    expect(screen.queryByLabelText(/Navigate to Sponsor/i)).not.toBeInTheDocument();
  });

  it('shows sponsor menu for organizers when sponsor mode is enabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: true,
      loading: false,
    });

    renderWithRouter(
      <Navigation userRole="organizer" />
    );

    expect(screen.getByLabelText(/Navigate to Sponsor/i)).toBeInTheDocument();
  });

  it('preserves other navigation items when sponsor mode is disabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    renderWithRouter(
      <Navigation userRole="attendee" />
    );

    // Check that other standard nav items are still present
    expect(screen.getByLabelText(/Navigate to Feed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Navigate to Search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Navigate to Profile/i)).toBeInTheDocument();
  });

  it('does not break navigation when sponsor mode hook is loading', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: true,
    });

    renderWithRouter(
      <Navigation userRole="attendee" />
    );

    // Should still render other navigation items
    expect(screen.getByLabelText(/Navigate to Feed/i)).toBeInTheDocument();
    expect(screen.queryByText('Sponsor')).not.toBeInTheDocument();
  });
});