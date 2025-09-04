import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export function useAuthGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = (action: () => void, message?: string) => {
    if (loading) {
      return false;
    }

    if (!user) {
      // Store current location for redirect after auth
      const redirectTo = location.pathname + location.search;
      navigate('/auth', { 
        state: { 
          redirectTo,
          fromProtectedRoute: true 
        } 
      });
      
      if (message) {
        toast({
          title: "Authentication Required",
          description: message,
          variant: "destructive",
        });
      }
      return false;
    }
    
    action();
    return true;
  };

  const withAuth = <T extends any[]>(
    action: (...args: T) => void,
    message?: string
  ) => {
    return (...args: T) => {
      requireAuth(() => action(...args), message);
    };
  };

  const isAuthenticated = !!user && !loading;

  return {
    requireAuth,
    withAuth,
    isAuthenticated,
    user,
    loading
  };
}