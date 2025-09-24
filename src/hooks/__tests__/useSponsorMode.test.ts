import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/integrations/supabase/client');
vi.mock('@/hooks/use-toast');

const mockSupabase = supabase as any;
const mockUseToast = useToast as any;
const mockToast = vi.fn();

describe('useSponsorMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
  });

  it('fetches sponsor mode status on mount', async () => {
    const mockUser = { id: 'user-1' };
    const mockProfile = { sponsor_mode_enabled: true };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useSponsorMode());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sponsorModeEnabled).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('defaults to false when user profile not found', async () => {
    const mockUser = { id: 'user-1' };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useSponsorMode());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sponsorModeEnabled).toBe(false);
  });

  it('handles unauthenticated user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useSponsorMode());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sponsorModeEnabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('enableSponsorMode', () => {
    it('successfully enables sponsor mode', async () => {
      const mockUser = { id: 'user-1' };
      
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: mockUser } }) // Initial fetch
        .mockResolvedValueOnce({ data: { user: mockUser } }); // Enable call

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { sponsor_mode_enabled: false }, 
              error: null 
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const { result } = renderHook(() => useSponsorMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.enableSponsorMode();

      expect(result.current.sponsorModeEnabled).toBe(true);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sponsor mode enabled',
        description: 'You now have access to sponsor tools and features.',
      });
    });

    it('handles enable error', async () => {
      const mockUser = { id: 'user-1' };
      const mockError = new Error('Database error');

      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: mockUser } })
        .mockResolvedValueOnce({ data: { user: mockUser } });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { sponsor_mode_enabled: false }, 
              error: null 
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: mockError }),
        }),
      });

      const { result } = renderHook(() => useSponsorMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.enableSponsorMode();

      expect(result.current.error).toBe('Database error');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Database error',
        variant: 'destructive',
      });
    });
  });

  describe('disableSponsorMode', () => {
    it('successfully disables sponsor mode', async () => {
      const mockUser = { id: 'user-1' };
      
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: mockUser } })
        .mockResolvedValueOnce({ data: { user: mockUser } });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { sponsor_mode_enabled: true }, 
              error: null 
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const { result } = renderHook(() => useSponsorMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.disableSponsorMode();

      expect(result.current.sponsorModeEnabled).toBe(false);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sponsor mode disabled',
        description: 'You no longer have access to sponsor tools.',
      });
    });
  });
});