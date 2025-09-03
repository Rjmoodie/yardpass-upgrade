import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export function useAuthRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const requireAuth = (action: () => void, message?: string) => {
    if (!user) {
      // Store current location for redirect after auth
      const redirectTo = location.pathname + location.search;
      navigate('/auth', { 
        state: { 
          redirectTo,
          fromProtectedRoute: true 
        } 
      });
      
      toast({
        title: "Authentication Required",
        description: message || "Please sign in to continue",
        variant: "destructive",
      });
      return false;
    }
    action();
    return true;
  };

  const isAuthenticated = !!user;

  return {
    requireAuth,
    isAuthenticated,
    user
  };
}