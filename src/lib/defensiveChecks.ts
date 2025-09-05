import { api } from './api';
import { toast } from '@/hooks/use-toast';

export interface DefensiveCheckOptions {
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Defensive check for post-checkout ticket visibility
 * Polls for ticket creation with exponential backoff
 */
export async function checkTicketVisibility(
  sessionId: string,
  options: DefensiveCheckOptions = {}
): Promise<boolean> {
  const { maxRetries = 5, retryDelay = 2000, onSuccess, onError } = options;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await api.getOrderStatus(sessionId);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.data?.status === 'paid') {
        onSuccess?.();
        return true;
      }
      
      if (response.data?.status === 'failed' || response.data?.status === 'cancelled') {
        throw new Error(`Payment ${response.data.status}`);
      }
      
      // Still pending, wait and retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt === maxRetries - 1) {
        onError?.(errorMessage);
        toast({
          title: "Ticket Check Failed",
          description: "Unable to verify ticket creation. Please check your tickets page.",
          variant: "destructive",
        });
        return false;
      }
    }
  }
  
  return false;
}

/**
 * Retry mechanism for failed API calls
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  options: { maxRetries?: number; delay?: number } = {}
): Promise<T | null> {
  const { maxRetries = 3, delay = 1000 } = options;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error('API call failed after retries:', error);
        return null;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  
  return null;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_FUNCTIONS_URL',
  ];
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: File, options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
} = {}): { valid: boolean; error?: string } {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] } = options;
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type must be one of: ${allowedTypes.join(', ')}`,
    };
  }
  
  return { valid: true };
}
