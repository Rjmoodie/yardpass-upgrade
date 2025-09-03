import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

export function useRequireAuth() {
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const withRequireAuth = (action: () => void, options?: { 
    title?: string; 
    description?: string; 
  }) => {
    return () => {
      if (user) {
        action();
      } else {
        setIsAuthModalOpen(true);
      }
    };
  };

  const RequireAuthButton = ({ 
    children, 
    onClick, 
    title,
    description,
    ...props 
  }: any) => {
    const handleClick = () => {
      if (user) {
        onClick?.();
      } else {
        setIsAuthModalOpen(true);
      }
    };

    return (
      <>
        {typeof children === 'function' ? 
          children({ onClick: handleClick, ...props }) :
          <button {...props} onClick={handleClick}>
            {children}
          </button>
        }
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => {
            setIsAuthModalOpen(false);
            onClick?.();
          }}
          title={title}
          description={description}
        />
      </>
    );
  };

  const AuthModalComponent = () => (
    <AuthModal
      isOpen={isAuthModalOpen}
      onClose={() => setIsAuthModalOpen(false)}
      onSuccess={() => setIsAuthModalOpen(false)}
    />
  );

  return {
    withRequireAuth,
    RequireAuthButton,
    AuthModal: AuthModalComponent,
    openAuthModal: () => setIsAuthModalOpen(true),
    closeAuthModal: () => setIsAuthModalOpen(false),
    isAuthModalOpen
  };
}