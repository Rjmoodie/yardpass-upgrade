import { Dialog, DialogContent } from '@/components/ui/dialog';
import AuthExperience from '@/components/auth/AuthExperience';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
  allowGuestTicketAccess?: boolean;
  guestScopeEventId?: string;
  guestSessionMinutes?: number;
  defaultTab?: 'signin' | 'signup' | 'guest';
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Sign in to continue',
  description = 'You need to be signed in to perform this action',
  allowGuestTicketAccess = true,
  guestScopeEventId,
  guestSessionMinutes = 30,
  defaultTab = 'signin',
}: AuthModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[420px] sm:max-w-[460px] border-none bg-transparent p-0 shadow-none">
        <AuthExperience
          isOpen={isOpen}
          layout="modal"
          title={title}
          description={description}
          allowGuestTicketAccess={allowGuestTicketAccess}
          guestScopeEventId={guestScopeEventId}
          guestSessionMinutes={guestSessionMinutes}
          defaultTab={defaultTab}
          onDismiss={onClose}
          onAuthSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
