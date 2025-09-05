import { apiClient } from '../api';

// Mock fetch
global.fetch = jest.fn();

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should make GET request with proper headers', async () => {
    const mockResponse = { data: { id: '1', name: 'Test' } };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await apiClient.get('test-endpoint');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(result.data).toEqual(mockResponse);
    expect(result.error).toBeNull();
  });

  it('should handle POST request with data', async () => {
    const mockData = { name: 'Test Event' };
    const mockResponse = { data: { id: '1', ...mockData } };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await apiClient.post('test-endpoint', mockData);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(mockData),
      })
    );
    expect(result.data).toEqual(mockResponse);
  });

  it('should handle errors gracefully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await apiClient.get('test-endpoint');

    expect(result.data).toBeNull();
    expect(result.error).toBe('HTTP 500: Internal Server Error');
  });

  it('should retry failed requests', async () => {
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

    const result = await apiClient.get('test-endpoint', { retries: 1 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ data: 'success' });
  });
});
