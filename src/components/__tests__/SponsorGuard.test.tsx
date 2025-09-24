import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SponsorGuard } from '@/components/access/SponsorGuard';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import '@testing-library/jest-dom';

// Mock LoadingSpinner
vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock the hook
vi.mock('@/hooks/useSponsorMode');
const mockUseSponsorMode = useSponsorMode as any;

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: vi.fn(({ to }) => <div data-testid="navigate">Redirected to {to}</div>),
  };
});

const TestComponent = () => <div data-testid="protected-content">Protected Sponsor Content</div>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('SponsorGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when sponsor mode is loading', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: true,
    });

    renderWithRouter(
      <SponsorGuard>
        <TestComponent />
      </SponsorGuard>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to home when sponsor mode is disabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    renderWithRouter(
      <SponsorGuard>
        <TestComponent />
      </SponsorGuard>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('Redirected to /');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to custom fallback path when specified', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    renderWithRouter(
      <SponsorGuard fallbackPath="/custom-redirect">
        <TestComponent />
      </SponsorGuard>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('Redirected to /custom-redirect');
  });

  it('renders protected content when sponsor mode is enabled', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: true,
      loading: false,
    });

    renderWithRouter(
      <SponsorGuard>
        <TestComponent />
      </SponsorGuard>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('does not render protected content for attendees by default', () => {
    mockUseSponsorMode.mockReturnValue({
      sponsorModeEnabled: false,
      loading: false,
    });

    renderWithRouter(
      <SponsorGuard>
        <TestComponent />
      </SponsorGuard>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
  });
});