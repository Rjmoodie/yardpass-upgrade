import { supabase } from '@/integrations/supabase/client';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface ApiOptions {
  retries?: number;
  timeout?: number;
  onError?: (error: Error) => void;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1';
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    apiOptions: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const { retries = 3, timeout = 10000, onError } = apiOptions;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token && {
              'Authorization': `Bearer ${session.access_token}`
            }),
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        return {
          data: data.data || data,
          error: null,
          loading: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === retries) {
          onError?.(lastError);
          return {
            data: null,
            error: lastError.message,
            loading: false,
          };
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return {
      data: null,
      error: lastError?.message || 'Request failed',
      loading: false,
    };
  }

  async get<T>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' }, options);
  }

  async post<T>(endpoint: string, data?: unknown, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, options);
  }

  async put<T>(endpoint: string, data?: unknown, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, options);
  }

  async delete<T>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' }, options);
  }
}

export const apiClient = new ApiClient();

// Convenience functions for common operations
export const api = {
  // Events
  getEvents: () => apiClient.get('events'),
  getEvent: (id: string) => apiClient.get(`events/${id}`),
  
  // Tickets
  getUserTickets: () => apiClient.get('get-user-tickets'),
  getOrderStatus: (sessionId: string) => apiClient.get(`get-order-status?session_id=${sessionId}`),
  
  // Posts
  getPosts: (eventId?: string) => {
    const url = eventId ? `posts-list?event_id=${eventId}` : 'posts-list';
    return apiClient.get(url);
  },
  createPost: (data: { event_id: string; text?: string; media_urls?: string[]; ticket_tier_id?: string }) =>
    apiClient.post('posts-create', data),
  
  // Analytics
  trackAnalytics: (data: { event: string; properties?: Record<string, unknown> }) =>
    apiClient.post('track-analytics', data),
  
  // Stripe
  createCheckout: (data: { event_id: string; selections: Array<{ tierId: string; quantity: number }> }) =>
    apiClient.post('create-checkout', data),
};
