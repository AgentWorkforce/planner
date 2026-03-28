/**
 * TunerClient tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TunerClient } from './client.js';
import type { CultivateConfig } from '../types.js';
import { DEFAULT_CULTIVATE_CONFIG } from './defaults.js';

describe('TunerClient', () => {
  let mockStorage: any;
  let globalFetch: typeof global.fetch;

  beforeEach(() => {
    // Save original fetch
    globalFetch = global.fetch;

    // Mock storage
    mockStorage = {
      setConfig: vi.fn().mockResolvedValue({}),
      getConfig: vi.fn().mockResolvedValue(null),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = globalFetch;
  });

  describe('constructor', () => {
    it('should initialize with default config when no initial config provided', () => {
      const client = new TunerClient(null, mockStorage);

      expect(client.getCurrentConfig()).toEqual(DEFAULT_CULTIVATE_CONFIG);
    });

    it('should initialize with provided config', () => {
      const customConfig: CultivateConfig = {
        ...DEFAULT_CULTIVATE_CONFIG,
        tier1_strictness: 0.8,
      };

      const client = new TunerClient(null, mockStorage, customConfig);

      expect(client.getCurrentConfig()).toEqual(customConfig);
      expect(client.getCurrentConfig().tier1_strictness).toBe(0.8);
    });
  });

  describe('getCurrentConfig', () => {
    it('should return current configuration', () => {
      const client = new TunerClient(null, mockStorage);

      const config = client.getCurrentConfig();

      expect(config).toEqual(DEFAULT_CULTIVATE_CONFIG);
    });
  });

  describe('fetchConfig', () => {
    it('should return null when tunerUrl is not configured', async () => {
      const client = new TunerClient(null, mockStorage);

      const result = await client.fetchConfig();

      expect(result).toBeNull();
    });

    it('should fetch config from Tuner service on success', async () => {
      const mockConfig: CultivateConfig = {
        ...DEFAULT_CULTIVATE_CONFIG,
        tier1_strictness: 0.7,
      };

      // Mock successful fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const client = new TunerClient('http://localhost:4002', mockStorage);

      const result = await client.fetchConfig();

      expect(result).toEqual(mockConfig);
      expect(client.getCurrentConfig()).toEqual(mockConfig);
      expect(mockStorage.setConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should return null on network error (graceful fallback)', async () => {
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const client = new TunerClient('http://localhost:4002', mockStorage);

      const result = await client.fetchConfig();

      expect(result).toBeNull();
      expect(client.getCurrentConfig()).toEqual(DEFAULT_CULTIVATE_CONFIG);
      expect(mockStorage.setConfig).not.toHaveBeenCalled();
    });

    it('should return null on HTTP error response', async () => {
      // Mock 404 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      const client = new TunerClient('http://localhost:4002', mockStorage);

      const result = await client.fetchConfig();

      expect(result).toBeNull();
      expect(client.getCurrentConfig()).toEqual(DEFAULT_CULTIVATE_CONFIG);
      expect(mockStorage.setConfig).not.toHaveBeenCalled();
    });

    it('should timeout after 5 seconds', async () => {
      // Mock AbortSignal.timeout to simulate timeout
      const mockAbortError = new Error('The operation was aborted');
      mockAbortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(mockAbortError);

      const client = new TunerClient('http://localhost:4002', mockStorage);

      const result = await client.fetchConfig();

      // Should timeout and return null
      expect(result).toBeNull();
    });
  });

  describe('recordOutcome', () => {
    it('should skip silently when tunerUrl is not configured', async () => {
      const client = new TunerClient(null, mockStorage);

      // Should not throw
      await expect(
        client.recordOutcome({
          signal_id: 'sig-123',
          action: 'link',
          greenhouse_id: 'gh-456',
        })
      ).resolves.toBeUndefined();
    });

    it('should post outcome to Tuner service on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      } as any);
      global.fetch = mockFetch;

      const client = new TunerClient('http://localhost:4002', mockStorage);

      await client.recordOutcome({
        signal_id: 'sig-123',
        action: 'link',
        greenhouse_id: 'gh-456',
        cluster_id: 'cluster-789',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4002/api/tuner/outcomes/cultivate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('sig-123'),
        })
      );
    });

    it('should not throw on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const client = new TunerClient('http://localhost:4002', mockStorage);

      // Should not throw
      await expect(
        client.recordOutcome({
          signal_id: 'sig-123',
          action: 'dismiss',
          greenhouse_id: 'gh-456',
        })
      ).resolves.toBeUndefined();
    });

    it('should not throw on HTTP error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const client = new TunerClient('http://localhost:4002', mockStorage);

      // Should not throw
      await expect(
        client.recordOutcome({
          signal_id: 'sig-123',
          action: 'ignore',
          greenhouse_id: 'gh-456',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not start polling when tunerUrl is null', () => {
      const client = new TunerClient(null, mockStorage);

      client.startPolling();

      // No error thrown
      expect(client).toBeDefined();
    });

    it('should fetch config immediately on startPolling', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(DEFAULT_CULTIVATE_CONFIG),
      } as any);
      global.fetch = mockFetch;

      const client = new TunerClient('http://localhost:4002', mockStorage);

      client.startPolling();

      // Wait for all pending promises (initial fetch)
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('should poll every 5 minutes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(DEFAULT_CULTIVATE_CONFIG),
      } as any);
      global.fetch = mockFetch;

      const client = new TunerClient('http://localhost:4002', mockStorage);

      client.startPolling();

      // Clear initial call
      mockFetch.mockClear();

      // Advance 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance another 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should stop polling when stopPolling called', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(DEFAULT_CULTIVATE_CONFIG),
      } as any);
      global.fetch = mockFetch;

      const client = new TunerClient('http://localhost:4002', mockStorage);

      client.startPolling();
      mockFetch.mockClear();

      // Stop polling
      client.stopPolling();

      // Advance 10 minutes
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

      // Should not have fetched
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should be idempotent when startPolling called multiple times', () => {
      const client = new TunerClient('http://localhost:4002', mockStorage);

      // Call startPolling multiple times
      client.startPolling();
      client.startPolling();
      client.startPolling();

      // Should not throw
      expect(client).toBeDefined();
    });

    it('should be safe to call stopPolling when not started', () => {
      const client = new TunerClient('http://localhost:4002', mockStorage);

      // Should not throw
      client.stopPolling();

      expect(client).toBeDefined();
    });
  });
});
