import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import AuthModal from '@/components/AuthModal';

interface AuthProtectedButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
}

export function AuthProtectedButton({ 
  onClick, 
  children, 
  title = "Sign in to continue",
  description = "You need to be signed in to perform this action",
  variant = "default",
  size = "default",
  className,
  disabled = false,
  ...props 
}: AuthProtectedButtonProps) {
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleClick = () => {
    if (user) {
      onClick();
    } else {
      setIsAuthModalOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </Button>
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          onClick();
        }}
        title={title}
        description={description}
      />
    </>
  );
}