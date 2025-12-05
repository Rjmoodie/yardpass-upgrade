/**
 * Unit tests for query key factory
 */

import { describe, it, expect } from 'vitest';
import {
  feedQueryKeys,
  normalizeParams,
  isFeedQueryKey,
  type UnifiedFeedParams,
} from '../queryKeys';

describe('queryKeys', () => {
  describe('feedQueryKeys', () => {
    it('should generate consistent base keys', () => {
      const key1 = feedQueryKeys.all;
      const key2 = feedQueryKeys.all;
      
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['unifiedFeed']);
    });

    it('should generate consistent list keys', () => {
      const key1 = feedQueryKeys.lists();
      const key2 = feedQueryKeys.lists();
      
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['unifiedFeed', 'list']);
    });

    it('should generate specific list keys with params', () => {
      const params: UnifiedFeedParams = {
        limit: 30,
        locations: ['NYC'],
        categories: ['Music'],
        dates: [],
      };
      
      const key = feedQueryKeys.list(params);
      
      expect(key[0]).toBe('unifiedFeed');
      expect(key[1]).toBe('list');
      expect(key[2]).toEqual(normalizeParams(params));
    });

    it('should generate post-specific keys', () => {
      const key = feedQueryKeys.post('post-123');
      
      expect(key).toEqual(['unifiedFeed', 'post', 'post-123']);
    });

    it('should generate legacy event feed keys', () => {
      const key = feedQueryKeys.eventFeed('event-123');
      
      expect(key).toEqual(['eventFeed', 'event-123']);
    });
  });

  describe('normalizeParams', () => {
    it('should normalize empty params', () => {
      const normalized = normalizeParams({});
      
      expect(normalized).toEqual({
        limit: 30,
        locations: [],
        categories: [],
        dates: [],
        searchRadius: undefined,
      });
    });

    it('should preserve provided params', () => {
      const params: UnifiedFeedParams = {
        limit: 20,
        locations: ['NYC', 'LA'],
        categories: ['Music'],
        dates: ['2025-01-01'],
        searchRadius: 50,
      };
      
      const normalized = normalizeParams(params);
      
      expect(normalized).toEqual(params);
    });

    it('should fill in missing params with defaults', () => {
      const params: UnifiedFeedParams = {
        locations: ['NYC'],
      };
      
      const normalized = normalizeParams(params);
      
      expect(normalized).toEqual({
        limit: 30,
        locations: ['NYC'],
        categories: [],
        dates: [],
        searchRadius: undefined,
      });
    });

    it('should produce consistent results for equivalent inputs', () => {
      const params1 = { locations: [], categories: [] };
      const params2 = {};
      
      const normalized1 = normalizeParams(params1);
      const normalized2 = normalizeParams(params2);
      
      expect(normalized1).toEqual(normalized2);
    });

    it('should handle undefined arrays correctly', () => {
      const normalized = normalizeParams({ limit: 30 });
      
      expect(Array.isArray(normalized.locations)).toBe(true);
      expect(Array.isArray(normalized.categories)).toBe(true);
      expect(Array.isArray(normalized.dates)).toBe(true);
      expect(normalized.locations).toHaveLength(0);
    });
  });

  describe('isFeedQueryKey', () => {
    it('should return true for valid feed keys', () => {
      expect(isFeedQueryKey(['unifiedFeed'])).toBe(true);
      expect(isFeedQueryKey(['unifiedFeed', 'list'])).toBe(true);
      expect(isFeedQueryKey(['unifiedFeed', 'list', {}])).toBe(true);
      expect(isFeedQueryKey(['unifiedFeed', 'post', 'post-123'])).toBe(true);
    });

    it('should return false for invalid keys', () => {
      expect(isFeedQueryKey(['otherQuery'])).toBe(false);
      expect(isFeedQueryKey(['eventFeed', 'event-123'])).toBe(false);
      expect(isFeedQueryKey([])).toBe(false);
    });

    it('should handle non-array inputs gracefully', () => {
      expect(isFeedQueryKey('not-an-array' as any)).toBe(false);
      expect(isFeedQueryKey(null as any)).toBe(false);
      expect(isFeedQueryKey(undefined as any)).toBe(false);
    });
  });

  describe('Key Stability', () => {
    it('should generate identical keys for identical params', () => {
      const params: UnifiedFeedParams = {
        limit: 30,
        locations: ['NYC'],
        categories: ['Music'],
        dates: [],
      };
      
      const key1 = feedQueryKeys.list(params);
      const key2 = feedQueryKeys.list(params);
      
      expect(key1).toEqual(key2);
    });

    it('should generate different keys for different params', () => {
      const params1: UnifiedFeedParams = { locations: ['NYC'] };
      const params2: UnifiedFeedParams = { locations: ['LA'] };
      
      const key1 = feedQueryKeys.list(params1);
      const key2 = feedQueryKeys.list(params2);
      
      expect(key1).not.toEqual(key2);
    });

    it('should be sensitive to array order', () => {
      const params1: UnifiedFeedParams = { locations: ['NYC', 'LA'] };
      const params2: UnifiedFeedParams = { locations: ['LA', 'NYC'] };
      
      const key1 = feedQueryKeys.list(params1);
      const key2 = feedQueryKeys.list(params2);
      
      // Arrays with different order should produce different keys
      expect(key1).not.toEqual(key2);
    });

    it('should be stable across multiple normalizations', () => {
      const params: UnifiedFeedParams = { locations: ['NYC'] };
      
      const key1 = feedQueryKeys.list(normalizeParams(params));
      const key2 = feedQueryKeys.list(normalizeParams(normalizeParams(params)));
      
      expect(key1).toEqual(key2);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical feed filter updates', () => {
      // User starts with no filters
      const key1 = feedQueryKeys.list({});
      
      // User adds location filter
      const key2 = feedQueryKeys.list({ locations: ['NYC'] });
      
      // User adds category filter
      const key3 = feedQueryKeys.list({ locations: ['NYC'], categories: ['Music'] });
      
      // All keys should be different (triggering separate cache entries)
      expect(key1).not.toEqual(key2);
      expect(key2).not.toEqual(key3);
      expect(key1).not.toEqual(key3);
    });

    it('should match keys used in useUnifiedFeedInfinite', () => {
      // Simulate hook usage
      const options = {
        locations: ['NYC'],
        categories: ['Music'],
        dates: [],
        limit: 30,
      };
      
      const normalizedParams = normalizeParams(options);
      const hookKey = feedQueryKeys.list(normalizedParams);
      
      // Simulate optimistic update usage
      const updateKey = feedQueryKeys.list(normalizeParams({
        limit: 30,
        locations: ['NYC'],
        categories: ['Music'],
        dates: [],
      }));
      
      // Keys should match (enabling cache mutations)
      expect(hookKey).toEqual(updateKey);
    });
  });
});

