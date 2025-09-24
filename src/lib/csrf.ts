/**
 * CSRF Protection utilities
 */

import { supabase } from '@/integrations/supabase/client';

export class CSRFProtection {
  private static readonly TOKEN_HEADER = 'X-CSRF-Token';
  private static readonly TOKEN_STORAGE_KEY = 'csrf-token';

  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = btoa(String.fromCharCode(...array));
    sessionStorage.setItem(this.TOKEN_STORAGE_KEY, token);
    return token;
  }

  static getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_STORAGE_KEY);
  }

  static getHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { [this.TOKEN_HEADER]: token } : {};
  }

  static validateToken(receivedToken: string): boolean {
    const storedToken = this.getToken();
    return storedToken !== null && storedToken === receivedToken;
  }

  /**
   * Add CSRF token to Supabase requests
   */
  static enhanceSupabaseClient() {
    // Add CSRF token to all requests
    const originalRequest = supabase.functions.invoke;
    supabase.functions.invoke = async function(functionName: string, options: any = {}) {
      const headers = {
        ...CSRFProtection.getHeaders(),
        ...(options.headers || {})
      };
      
      return originalRequest.call(this, functionName, {
        ...options,
        headers
      });
    };
  }
}