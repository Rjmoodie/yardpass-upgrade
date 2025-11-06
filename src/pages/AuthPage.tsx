import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SmartAuthModal } from '@/components/auth/SmartAuthModal';

/**
 * AuthPage - Full-page authentication experience
 * 
 * Smart auth system that detects:
 * - Guest purchasers (no password) → Magic link
 * - Password users → Password field
 * - New users → Passwordless signup
 */
export default function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && location.pathname === '/auth' && !location.state?.fromProtectedRoute) {
      const redirectTo = location.state?.redirectTo || '/';
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <SmartAuthModal
        isOpen={true}
        onClose={() => navigate('/')}
        onSuccess={() => {
          const redirectTo = location.state?.redirectTo || '/';
          navigate(redirectTo, { replace: true });
        }}
      />
    </div>
  );
}
