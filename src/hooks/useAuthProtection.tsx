import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useAuthProtection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requireAuth = (action: () => void, message?: string) => {
    if (!user) {
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