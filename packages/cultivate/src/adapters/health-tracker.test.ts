/**
 * Tests for SourceHealthTracker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourceHealthTracker } from './health-tracker.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { SSEBroadcaster } from '../sse/broadcaster.js';
import type { SourceConfig } from '../domain/types.js';

describe('SourceHealthTracker', () => {
  let storage: CultivateStorage;
  let broadcaster: SSEBroadcaster;
  let tracker: SourceHealthTracker;

  beforeEach(() => {
    // Mock storage
    storage = {
      getSourceConfigById: vi.fn(),
      updateSourceHealth: vi.fn(),
    } as any;

    // Mock broadcaster
    broadcaster = {
      emitSourceError: vi.fn(),
      emitSourceAuthExpired: vi.fn(),
    } as any;

    tracker = new SourceHealthTracker(storage, broadcaster);
  });

  describe('recordSuccess', () => {
    it('should reset consecutive failures and set health to healthy', async () => {
      await tracker.recordSuccess('source-1');

      expect(storage.updateSourceHealth).toHaveBeenCalledWith('source-1', {
        health: 'healthy',
        consecutive_failures: 0,
        last_error: undefined,
      });
    });
  });

  describe('recordFailure - escalation policy', () => {
    it('should set status to warning on first failure without emitting event', async () => {
      const sourceConfig: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Source',
        consecutive_failures: 0,
      };

      vi.mocked(storage.getSourceConfigById).mockResolvedValue(sourceConfig as SourceConfig);

      await tracker.recordFailure('source-1', new Error('Test error'));

      expect(storage.updateSourceHealth).toHaveBeenCalledWith('source-1', {
        health: 'warning',
        consecutive_failures: 1,
        last_error: 'Test error',
      });

      expect(broadcaster.emitSourceError).not.toHaveBeenCalled();
    });

    it('should set status to unhealthy on 3rd failure and emit event', async () => {
      const sourceConfig: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Source',
        consecutive_failures: 2,
      };

      vi.mocked(storage.getSourceConfigById).mockResolvedValue(sourceConfig as SourceConfig);

      await tracker.recordFailure('source-1', new Error('Test error'));

      expect(storage.updateSourceHealth).toHaveBeenCalledWith('source-1', {
        health: 'unhealthy',
        consecutive_failures: 3,
        last_error: 'Test error',
      });

      expect(broadcaster.emitSourceError).toHaveBeenCalledWith({
        source_config_id: 'source-1',
        error: 'Test error',
        health: 'unhealthy',
      });
    });

    it('should set status to disabled on 10th failure and emit event', async () => {
      const sourceConfig: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Source',
        consecutive_failures: 9,
      };

      vi.mocked(storage.getSourceConfigById).mockResolvedValue(sourceConfig as SourceConfig);

      await tracker.recordFailure('source-1', new Error('Test error'));

      expect(storage.updateSourceHealth).toHaveBeenCalledWith('source-1', {
        health: 'disabled',
        consecutive_failures: 10,
        last_error: 'Test error',
      });

      expect(broadcaster.emitSourceError).toHaveBeenCalledWith({
        source_config_id: 'source-1',
        error: 'Test error',
        health: 'disabled',
      });
    });

    it('should immediately disable on auth error and emit auth_expired', async () => {
      const sourceConfig: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Source',
        consecutive_failures: 0,
      };

      vi.mocked(storage.getSourceConfigById).mockResolvedValue(sourceConfig as SourceConfig);

      await tracker.recordFailure('source-1', new Error('401 Unauthorized'), true);

      expect(storage.updateSourceHealth).toHaveBeenCalledWith('source-1', {
        health: 'disabled',
        consecutive_failures: 1,
        last_error: '401 Unauthorized',
      });

      expect(broadcaster.emitSourceAuthExpired).toHaveBeenCalledWith({
        source_config_id: 'source-1',
        name: 'Test Source',
      });

      expect(broadcaster.emitSourceError).not.toHaveBeenCalled();
    });

    it('should handle missing source config gracefully', async () => {
      vi.mocked(storage.getSourceConfigById).mockResolvedValue(null);

      // Should not throw
      await tracker.recordFailure('nonexistent', new Error('Test error'));

      expect(storage.updateSourceHealth).not.toHaveBeenCalled();
    });
  });

  describe('getHealth', () => {
    it('should return current health status', async () => {
      const sourceConfig: Partial<SourceConfig> = {
        id: 'source-1',
        health: 'unhealthy',
        consecutive_failures: 5,
        last_error: 'Connection timeout',
      };

      vi.mocked(storage.getSourceConfigById).mockResolvedValue(sourceConfig as SourceConfig);

      const health = await tracker.getHealth('source-1');

      expect(health).toEqual({
        status: 'unhealthy',
        consecutive_failures: 5,
        last_error: 'Connection timeout',
      });
    });

    it('should throw if source config not found', async () => {
      vi.mocked(storage.getSourceConfigById).mockResolvedValue(null);

      await expect(tracker.getHealth('nonexistent')).rejects.toThrow('Source config nonexistent not found');
    });
  });

  describe('without broadcaster', () => {
    beforeEach(() => {
      tracker = new SourceHealthTracker(storage); // No broadcaster
    });

    it('should not crash when emitting events without broadcaster', async () => {
      const sourceConfig: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Source',
        consecutive_failures: 2,
      };

      vi.mocked(storage.getSourceConfigById).mockResolvedValue(sourceConfig as SourceConfig);

      // Should not throw
      await tracker.recordFailure('source-1', new Error('Test error'));

      expect(storage.updateSourceHealth).toHaveBeenCalled();
    });
  });
});
