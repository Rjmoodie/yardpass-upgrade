import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SponsorOptInModal } from '@/components/sponsor/SponsorOptInModal';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import '@testing-library/jest-dom';

// Mock the hook
vi.mock('@/hooks/useSponsorMode');
const mockUseSponsorMode = useSponsorMode as any;

describe('SponsorOptInModal', () => {
  const mockOnOpenChange = vi.fn();
  const mockEnableSponsorMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSponsorMode.mockReturnValue({
      enableSponsorMode: mockEnableSponsorMode,
    });
  });

  it('renders opt-in modal with sponsor features', () => {
    render(
      <SponsorOptInModal open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText('Enable Sponsor Mode')).toBeInTheDocument();
    expect(screen.getByText('Sponsor Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Event Targeting')).toBeInTheDocument();
    expect(screen.getByText('Analytics & Insights')).toBeInTheDocument();
    expect(screen.getByText('Flexible Packages')).toBeInTheDocument();
  });

  it('calls enableSponsorMode when user opts in', async () => {
    render(
      <SponsorOptInModal open={true} onOpenChange={mockOnOpenChange} />
    );

    const enableButton = screen.getByText('Enable Sponsor Mode');
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockEnableSponsorMode).toHaveBeenCalledTimes(1);
    });
  });

  it('closes modal when user clicks "Not Now"', () => {
    render(
      <SponsorOptInModal open={true} onOpenChange={mockOnOpenChange} />
    );

    const notNowButton = screen.getByText('Not Now');
    fireEvent.click(notNowButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes modal after successful opt-in', async () => {
    mockEnableSponsorMode.mockResolvedValue(undefined);

    render(
      <SponsorOptInModal open={true} onOpenChange={mockOnOpenChange} />
    );

    const enableButton = screen.getByText('Enable Sponsor Mode');
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows loading state while enabling sponsor mode', async () => {
    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    mockEnableSponsorMode.mockReturnValue(promise);

    render(
      <SponsorOptInModal open={true} onOpenChange={mockOnOpenChange} />
    );

    const enableButton = screen.getByText('Enable Sponsor Mode');
    fireEvent.click(enableButton);

    expect(screen.getByText('Enabling...')).toBeInTheDocument();
    expect(enableButton).toBeDisabled();

    resolvePromise!();
    await waitFor(() => {
      expect(screen.queryByText('Enabling...')).not.toBeInTheDocument();
    });
  });

  it('displays important information about sponsor mode', () => {
    render(
      <SponsorOptInModal open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText(/Access to sponsor marketplace/)).toBeInTheDocument();
    expect(screen.getByText(/You can disable sponsor mode at any time/)).toBeInTheDocument();
  });
});