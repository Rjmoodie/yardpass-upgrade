import { useEffect } from 'react';
import { handleUserFriendlyError } from '@/utils/errorMessages';
import { useToast } from '@/hooks/use-toast';

/**
 * Global error handler that catches unhandled errors and shows user-friendly messages
 */
export function GlobalErrorHandler() {
  const { toast } = useToast();

  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      const { message } = handleUserFriendlyError(event.reason, {});
      
      toast({
        title: 'Something went wrong',
        description: message,
        variant: 'destructive'
      });
    };

    // Handle unhandled errors
    const handleError = (event: ErrorEvent) => {
      console.error('Unhandled error:', event.error);
      
      const { message } = handleUserFriendlyError(event.error, {});
      
      toast({
        title: 'Something went wrong',
        description: message,
        variant: 'destructive'
      });
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [toast]);

  return null;
}
