import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthExperience from '@/components/auth/AuthExperience';

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
    <AuthExperience
      layout="page"
      title="YardPass"
      description="Your gateway to events and culture"
      defaultTab="signin"
      allowGuestTicketAccess={true}
    />
  );
}
