import { SmartAuthModal } from '@/components/auth/SmartAuthModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // Legacy props kept for backwards compatibility but not used
  title?: string;
  description?: string;
  allowGuestTicketAccess?: boolean;
  guestScopeEventId?: string;
  guestSessionMinutes?: number;
  defaultTab?: 'signin' | 'signup' | 'guest';
}

/**
 * AuthModal - Smart authentication modal wrapper
 * 
 * Automatically detects account type and provides appropriate auth method:
 * - Guest purchasers → Magic link
 * - Password users → Password field
 * - New users → Passwordless signup
 */
export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
}: AuthModalProps) {
  return (
    <SmartAuthModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={() => {
        onSuccess?.();
        onClose();
      }}
    />
  );
}
