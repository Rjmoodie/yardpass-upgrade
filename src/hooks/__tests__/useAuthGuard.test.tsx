import { renderHook } from '@testing-library/react';
import { useAuthGuard } from '../useAuthGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('react-router-dom');
jest.mock('@/hooks/use-toast');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseNavigate = useNavigate as jest.MockedFunction<typeof useNavigate>;
const mockToast = toast as jest.MockedFunction<typeof toast>;

describe('useAuthGuard', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
  });

  it('should return authenticated state when user is present', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      loading: false,
    } as any);

    const { result } = renderHook(() => useAuthGuard());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeDefined();
  });

  it('should return unauthenticated state when user is not present', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as any);

    const { result } = renderHook(() => useAuthGuard());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should navigate to auth page when requireAuth is called without user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as any);

    const { result } = renderHook(() => useAuthGuard());
    const mockAction = jest.fn();

    const success = result.current.requireAuth(mockAction, 'Please sign in');

    expect(success).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/auth', {
      state: { redirectTo: '/', fromProtectedRoute: true }
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Authentication Required',
      description: 'Please sign in',
      variant: 'destructive',
    });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should execute action when requireAuth is called with user', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      loading: false,
    } as any);

    const { result } = renderHook(() => useAuthGuard());
    const mockAction = jest.fn();

    const success = result.current.requireAuth(mockAction);

    expect(success).toBe(true);
    expect(mockAction).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
