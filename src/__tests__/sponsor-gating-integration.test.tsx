import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { SponsorGuard } from '@/components/access/SponsorGuard';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import '@testing-library/jest-dom';

// Mock all dependencies
vi.mock('@/hooks/useSponsorMode');
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useAnalyticsIntegration', () => ({
  useAnalyticsIntegration: () => ({ trackNavigation: vi.fn() }),
}));
vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

const mockUseSponsorMode = useSponsorMode as any;
const mockUseAuth = useAuth as any;

const MockSponsorDashboard = () => <div data-testid="sponsor-dashboard">Sponsor Dashboard</div>;
const MockHomePage = () => <div data-testid="home-page">Home Page</div>;

const TestApp = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<MockHomePage />} />
      <Route
        path="/sponsor"
        element={
          <SponsorGuard>
            <MockSponsorDashboard />
          </SponsorGuard>
        }
      />
    </Routes>
    <Navigation userRole="attendee" />
  </BrowserRouter>
);

describe('Sponsor Opt-in Gating Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      loading: false,
    });
  });

  it('prevents access to sponsor routes when not opted in', async () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    render(<TestApp />);

    // Navigate to sponsor route
    window.history.pushState({}, '', '/sponsor');
    
    // Should be redirected to home
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    
    expect(screen.queryByTestId('sponsor-dashboard')).not.toBeInTheDocument();
  });

  it('allows access to sponsor routes when opted in', async () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: true,
      loading: false,
    });

    render(<TestApp />);

    // Navigate to sponsor route
    window.history.pushState({}, '', '/sponsor');
    
    // Should show sponsor dashboard
    await waitFor(() => {
      expect(screen.getByTestId('sponsor-dashboard')).toBeInTheDocument();
    });
  });

  it('hides sponsor menu item when not opted in', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    render(<TestApp />);

    // Should not show sponsor menu item
    expect(screen.queryByText('Sponsor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Navigate to Sponsor/i)).not.toBeInTheDocument();
  });

  it('shows sponsor menu item when opted in', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: true,
      loading: false,
    });

    render(<TestApp />);

    // Should show sponsor menu item
    expect(screen.getByText('Sponsor')).toBeInTheDocument();
    expect(screen.getByLabelText(/Navigate to Sponsor/i)).toBeInTheDocument();
  });

  it('provides seamless experience after opting in', async () => {
    // Start with sponsor mode disabled
    const { rerender } = render(<TestApp />);
    
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    // Verify no access initially
    expect(screen.queryByText('Sponsor')).not.toBeInTheDocument();

    // Simulate user enabling sponsor mode
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: true,
      loading: false,
    });

    rerender(<TestApp />);

    // Now should have access
    expect(screen.getByText('Sponsor')).toBeInTheDocument();
    
    // Should be able to navigate to sponsor dashboard
    window.history.pushState({}, '', '/sponsor');
    
    await waitFor(() => {
      expect(screen.getByTestId('sponsor-dashboard')).toBeInTheDocument();
    });
  });

  it('enforces 403-like behavior for direct sponsor URL access', async () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    // Directly navigate to sponsor URL
    window.history.pushState({}, '', '/sponsor');
    
    render(<TestApp />);

    // Should be immediately redirected/blocked
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    
    expect(screen.queryByTestId('sponsor-dashboard')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('handles loading states gracefully', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: true,
    });

    render(<TestApp />);

    // Navigation should still work for other items during loading
    expect(screen.getByLabelText(/Navigate to Feed/i)).toBeInTheDocument();
    
    // But sponsor menu should be hidden
    expect(screen.queryByText('Sponsor')).not.toBeInTheDocument();
  });
});