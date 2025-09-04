import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sharePayload } from '../share';

// Mock analytics
vi.mock('../analytics', () => ({
  capture: vi.fn(),
}));

// Mock utils/platform
vi.mock('../../utils/platform', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

const mockCapture = vi.fn();
vi.mocked(import('../analytics')).then(module => {
  vi.mocked(module.capture).mockImplementation(mockCapture);
});

describe('share', () => {
  const mockPayload = {
    title: 'Test Event',
    text: 'Join us for this amazing event',
    url: 'https://yardpass.com/e/test-event',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset window mocks
    delete (window as any).Capacitor;
    delete (window as any).CapacitorShare;
    delete (window.navigator as any).share;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Capacitor share when available', async () => {
    const mockCapacitorShare = vi.fn().mockResolvedValue(undefined);
    (window as any).Capacitor = { isNativePlatform: true };
    (window as any).CapacitorShare = { share: mockCapacitorShare };

    await sharePayload(mockPayload);

    expect(mockCapacitorShare).toHaveBeenCalledWith({
      title: mockPayload.title,
      text: mockPayload.text,
      url: mockPayload.url,
      dialogTitle: 'Share',
    });
    expect(mockCapture).toHaveBeenCalledWith('share_intent', mockPayload);
    expect(mockCapture).toHaveBeenCalledWith('share_completed', {
      channel: 'native',
      ...mockPayload,
    });
  });

  it('falls back to Web Share API when Capacitor unavailable', async () => {
    const mockNavigatorShare = vi.fn().mockResolvedValue(undefined);
    (window.navigator as any).share = mockNavigatorShare;

    await sharePayload(mockPayload);

    expect(mockNavigatorShare).toHaveBeenCalledWith(mockPayload);
    expect(mockCapture).toHaveBeenCalledWith('share_intent', mockPayload);
    expect(mockCapture).toHaveBeenCalledWith('share_completed', {
      channel: 'web_api',
      ...mockPayload,
    });
  });

  it('dispatches modal event when neither Capacitor nor Web Share available', async () => {
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

    await sharePayload(mockPayload);

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      new CustomEvent('open-share-modal', { detail: mockPayload })
    );
    expect(mockCapture).toHaveBeenCalledWith('share_intent', mockPayload);
    expect(mockCapture).toHaveBeenCalledWith('share_completed', {
      channel: 'fallback_modal',
      ...mockPayload,
    });
  });

  it('falls back to modal when Capacitor share fails', async () => {
    const mockCapacitorShare = vi.fn().mockRejectedValue(new Error('Share failed'));
    const mockNavigatorShare = vi.fn().mockResolvedValue(undefined);
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

    (window as any).Capacitor = { isNativePlatform: true };
    (window as any).CapacitorShare = { share: mockCapacitorShare };
    (window.navigator as any).share = mockNavigatorShare;

    await sharePayload(mockPayload);

    expect(mockCapacitorShare).toHaveBeenCalled();
    expect(mockNavigatorShare).toHaveBeenCalledWith(mockPayload);
    expect(mockCapture).toHaveBeenCalledWith('share_completed', {
      channel: 'web_api',
      ...mockPayload,
    });
  });

  it('falls back to modal when Web Share API fails', async () => {
    const mockNavigatorShare = vi.fn().mockRejectedValue(new Error('Share failed'));
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

    (window.navigator as any).share = mockNavigatorShare;

    await sharePayload(mockPayload);

    expect(mockNavigatorShare).toHaveBeenCalledWith(mockPayload);
    expect(mockDispatchEvent).toHaveBeenCalledWith(
      new CustomEvent('open-share-modal', { detail: mockPayload })
    );
    expect(mockCapture).toHaveBeenCalledWith('share_completed', {
      channel: 'fallback_modal',
      ...mockPayload,
    });
  });

  it('always calls share_intent analytics', async () => {
    await sharePayload(mockPayload);

    expect(mockCapture).toHaveBeenCalledWith('share_intent', mockPayload);
  });
});