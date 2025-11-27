/**
 * Tests for messaging utility functions
 * 
 * Tests conversation creation and participant management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { startConversation } from '@/utils/messaging';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('startConversation', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockConversation = {
    id: 'conversation-123',
    request_status: 'accepted',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: authenticated user
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock conversation insert
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockConversation,
          error: null,
        }),
      }),
    });

    // Mock participant insert
    const mockParticipantInsert = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'direct_conversations') {
        return { insert: mockInsert };
      }
      if (table === 'conversation_participants') {
        return { insert: mockParticipantInsert };
      }
      return {};
    });
  });

  it('should create a conversation for a user target', async () => {
    const result = await startConversation({
      targetType: 'user',
      targetId: 'target-user-123',
      subject: 'Test conversation',
    });

    expect(result.conversationId).toBe('conversation-123');
    expect(result.requestStatus).toBe('accepted');
    expect(supabase.from).toHaveBeenCalledWith('direct_conversations');
    expect(supabase.from).toHaveBeenCalledWith('conversation_participants');
  });

  it('should throw error if user is not authenticated', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      startConversation({
        targetType: 'user',
        targetId: 'target-user-123',
      })
    ).rejects.toThrow('You must be signed in to message');
  });

  it('should create pending conversation when forceRequest is true', async () => {
    const mockPendingConversation = {
      id: 'conversation-123',
      request_status: 'pending',
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'direct_conversations') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPendingConversation,
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const result = await startConversation({
      targetType: 'user',
      targetId: 'target-user-123',
      forceRequest: true,
    });

    expect(result.requestStatus).toBe('pending');
  });

  it('should handle organization-to-organization messaging', async () => {
    const result = await startConversation({
      targetType: 'organization',
      targetId: 'org-123',
      asOrganizationId: 'org-456',
    });

    expect(result.conversationId).toBe('conversation-123');
  });

  it('should throw error if conversation creation fails', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'direct_conversations') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error'),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      startConversation({
        targetType: 'user',
        targetId: 'target-user-123',
      })
    ).rejects.toThrow('Database error');
  });
});

