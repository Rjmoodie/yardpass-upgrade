import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { useStripeConnect } from '@/hooks/useStripeConnect';

interface StripeConnectButtonProps {
  contextType: 'individual' | 'organization';
  contextId: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showStatus?: boolean;
}

export function StripeConnectButton({
  contextType,
  contextId,
  variant = 'outline',
  size = 'default',
  className = "",
  showStatus = true
}: StripeConnectButtonProps) {
  const {
    account,
    loading,
    isFullySetup,
    createStripeConnectAccount,
    openStripePortal
  } = useStripeConnect(contextType, contextId);

  const getButtonContent = () => {
    if (!account) {
      return (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          Enable Payouts
        </>
      );
    }

    if (isFullySetup) {
      return (
        <>
          <CheckCircle className="w-4 h-4 mr-2" />
          Manage Payouts
        </>
      );
    }

    return (
      <>
        <AlertCircle className="w-4 h-4 mr-2" />
        Complete Setup
      </>
    );
  };

  const getStatusBadge = () => {
    if (!account) {
      return (
        <Badge variant="outline" className="ml-2">
          Not Connected
        </Badge>
      );
    }

    if (isFullySetup) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 ml-2">
          Active
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="border-yellow-300 text-yellow-700 ml-2">
        Setup Pending
      </Badge>
    );
  };

  const handleClick = () => {
    if (!account || !isFullySetup) {
      createStripeConnectAccount();
    } else {
      openStripePortal();
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {getButtonContent()}
      </Button>
      {showStatus && getStatusBadge()}
    </div>
  );
}