/**
 * Tests for centralized logger utility
 * 
 * Tests environment-aware logging behavior and verbose mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, createFeatureLogger, performanceLogger } from '@/utils/logger';

describe('logger', () => {
  const originalEnv = import.meta.env.DEV;
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    // Reset localStorage
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    } as any;

    // Mock console methods
    global.console.debug = vi.fn();
    global.console.log = vi.fn();
    global.console.warn = vi.fn();
    global.console.error = vi.fn();

    // Reset env
    (import.meta as any).env.DEV = true;
  });

  describe('logger.debug', () => {
    it('should not log in production', () => {
      (import.meta as any).env.DEV = false;
      logger.debug('Test message');
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should log when verbose mode is enabled', () => {
      global.localStorage.getItem = vi.fn((key) => 
        key === 'verbose_logs' ? 'true' : null
      );
      
      logger.debug('Test message');
      expect(console.debug).toHaveBeenCalledWith('Test message');
    });

    it('should not log when verbose mode is disabled', () => {
      global.localStorage.getItem = vi.fn(() => null);
      
      logger.debug('Test message');
      expect(console.debug).not.toHaveBeenCalled();
    });
  });

  describe('logger.info', () => {
    it('should log in development', () => {
      logger.info('Test info');
      expect(console.log).toHaveBeenCalledWith('Test info');
    });

    it('should not log in production', () => {
      (import.meta as any).env.DEV = false;
      logger.info('Test info');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('logger.warn', () => {
    it('should always log warnings', () => {
      logger.warn('Test warning');
      expect(console.warn).toHaveBeenCalledWith('Test warning');
      
      (import.meta as any).env.DEV = false;
      logger.warn('Test warning 2');
      expect(console.warn).toHaveBeenCalledWith('Test warning 2');
    });
  });

  describe('logger.error', () => {
    it('should always log errors', () => {
      logger.error('Test error');
      expect(console.error).toHaveBeenCalledWith('Test error');
      
      (import.meta as any).env.DEV = false;
      logger.error('Test error 2');
      expect(console.error).toHaveBeenCalledWith('Test error 2');
    });
  });

  describe('createFeatureLogger', () => {
    it('should create feature-specific logger', () => {
      global.localStorage.getItem = vi.fn((key) => 
        key === 'verbose_video' ? 'true' : null
      );

      const videoLogger = createFeatureLogger('video');
      videoLogger.debug('Video debug');
      
      expect(console.debug).toHaveBeenCalledWith('[video]', 'Video debug');
    });

    it('should respect global verbose mode', () => {
      global.localStorage.getItem = vi.fn((key) => 
        key === 'verbose_logs' ? 'true' : null
      );

      const videoLogger = createFeatureLogger('video');
      videoLogger.debug('Video debug');
      
      expect(console.debug).toHaveBeenCalledWith('[video]', 'Video debug');
    });
  });

  describe('performanceLogger', () => {
    it('should track performance timing', () => {
      global.localStorage.getItem = vi.fn((key) => 
        key === 'verbose_logs' ? 'true' : null
      );

      const perf = performanceLogger.start('test-operation');
      
      // Simulate some work
      const startTime = performance.now();
      while (performance.now() - startTime < 10) {
        // Small delay
      }
      
      perf.end();
      
      expect(console.debug).toHaveBeenCalled();
      const logCall = (console.debug as any).mock.calls[0][0];
      expect(logCall).toContain('[Performance]');
      expect(logCall).toContain('test-operation');
      expect(logCall).toMatch(/\d+\.\d+ms/);
    });
  });
});

