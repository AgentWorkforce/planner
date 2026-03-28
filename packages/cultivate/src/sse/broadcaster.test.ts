/**
 * SSEBroadcaster Tests
 *
 * Unit tests for SSE broadcaster functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEBroadcaster, createSSEBroadcaster } from './broadcaster.js';
import type { Response } from 'express';

/**
 * Create a mock Express Response object for testing
 */
function createMockResponse(): Response {
  const written: string[] = [];

  const mockRes = {
    written,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: vi.fn(),
  } as unknown as Response;

  return mockRes;
}

describe('SSEBroadcaster', () => {
  let broadcaster: SSEBroadcaster;

  beforeEach(() => {
    broadcaster = new SSEBroadcaster();
  });

  afterEach(() => {
    broadcaster.stop();
  });

  describe('addClient', () => {
    it('should add client to client set', () => {
      const mockRes = createMockResponse();

      expect(broadcaster.clientCount).toBe(0);

      broadcaster.addClient(mockRes);

      expect(broadcaster.clientCount).toBe(1);
    });

    it('should set correct SSE headers', () => {
      const mockRes = createMockResponse();

      broadcaster.addClient(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('should flush headers', () => {
      const mockRes = createMockResponse();

      broadcaster.addClient(mockRes);

      expect(mockRes.flushHeaders).toHaveBeenCalled();
    });

    it('should send initial connection event', () => {
      const mockRes = createMockResponse();

      broadcaster.addClient(mockRes);

      expect(mockRes.write).toHaveBeenCalled();
      const firstWrite = (mockRes.write as any).mock.calls[0][0];
      expect(firstWrite).toContain('event: connected');
      expect(firstWrite).toContain('clientCount');
    });

    it('should return unsubscribe function', () => {
      const mockRes = createMockResponse();

      const unsubscribe = broadcaster.addClient(mockRes);

      expect(typeof unsubscribe).toBe('function');
      expect(broadcaster.clientCount).toBe(1);

      unsubscribe();

      expect(broadcaster.clientCount).toBe(0);
    });
  });

  describe('removeClient', () => {
    it('should remove client from set', () => {
      const mockRes = createMockResponse();

      broadcaster.addClient(mockRes);
      expect(broadcaster.clientCount).toBe(1);

      broadcaster.removeClient(mockRes);
      expect(broadcaster.clientCount).toBe(0);
    });

    it('should call end on the response', () => {
      const mockRes = createMockResponse();

      broadcaster.addClient(mockRes);
      broadcaster.removeClient(mockRes);

      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should not crash if client not in set', () => {
      const mockRes = createMockResponse();

      expect(() => broadcaster.removeClient(mockRes)).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should write SSE-formatted data to all clients', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      broadcaster.addClient(mockRes1);
      broadcaster.addClient(mockRes2);

      broadcaster.emit('signal:new', {
        signal_id: 'sig-123',
        greenhouse_id: 'gh-1',
        title: 'Test Signal',
        source_type: 'twitter',
      });

      // Both clients should receive the message
      expect(mockRes1.write).toHaveBeenCalledWith(
        expect.stringContaining('event: signal:new')
      );
      expect(mockRes2.write).toHaveBeenCalledWith(
        expect.stringContaining('event: signal:new')
      );

      // Check data payload
      const writeCall1 = (mockRes1.write as any).mock.calls.find((call: any) =>
        call[0].includes('signal:new')
      );
      expect(writeCall1[0]).toContain('"signal_id":"sig-123"');
      expect(writeCall1[0]).toContain('"title":"Test Signal"');
    });

    it('should catch errors on dead connections without crashing', () => {
      const mockRes = createMockResponse();

      broadcaster.addClient(mockRes);

      // Make write throw an error (simulating dead connection)
      (mockRes.write as any).mockImplementation(() => {
        throw new Error('Connection closed');
      });

      // Should not throw
      expect(() => {
        broadcaster.emit('signal:new', {
          signal_id: 'sig-123',
          greenhouse_id: 'gh-1',
          title: 'Test',
          source_type: 'twitter',
        });
      }).not.toThrow();

      // Client should be removed
      expect(broadcaster.clientCount).toBe(0);
    });

    it('should remove only dead connections, not all clients', () => {
      const deadClient = createMockResponse();
      const aliveClient = createMockResponse();

      broadcaster.addClient(deadClient);
      broadcaster.addClient(aliveClient);

      expect(broadcaster.clientCount).toBe(2);

      // Make only the dead client throw
      (deadClient.write as any).mockImplementation(() => {
        throw new Error('Connection closed');
      });

      broadcaster.emit('signal:new', {
        signal_id: 'sig-123',
        greenhouse_id: 'gh-1',
        title: 'Test',
        source_type: 'twitter',
      });

      // Dead client removed, alive client remains
      expect(broadcaster.clientCount).toBe(1);
    });
  });

  describe('typed emit methods', () => {
    it('should emit signal:new with correct event name', () => {
      const mockRes = createMockResponse();
      broadcaster.addClient(mockRes);

      broadcaster.emitSignalNew({
        signal_id: 'sig-123',
        greenhouse_id: 'gh-1',
        title: 'Test',
        source_type: 'twitter',
      });

      const writeCall = (mockRes.write as any).mock.calls.find((call: any) =>
        call[0].includes('signal:new')
      );
      expect(writeCall).toBeDefined();
    });

    it('should emit cluster:trending with correct event name', () => {
      const mockRes = createMockResponse();
      broadcaster.addClient(mockRes);

      broadcaster.emitClusterTrending({
        cluster_id: 'cl-123',
        greenhouse_id: 'gh-1',
        label: 'Trending Topic',
        trend: 'rising',
        velocity_weekly: 15.3,
      });

      const writeCall = (mockRes.write as any).mock.calls.find((call: any) =>
        call[0].includes('cluster:trending')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('"velocity_weekly":15.3');
    });

    it('should emit ingestion:progress with correct event name', () => {
      const mockRes = createMockResponse();
      broadcaster.addClient(mockRes);

      broadcaster.emitIngestionProgress({
        job_id: 'job-123',
        processed_chunks: 5,
        total_chunks: 10,
      });

      const writeCall = (mockRes.write as any).mock.calls.find((call: any) =>
        call[0].includes('ingestion:progress')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('"processed_chunks":5');
    });

    it('should emit source:error with correct event name', () => {
      const mockRes = createMockResponse();
      broadcaster.addClient(mockRes);

      broadcaster.emitSourceError({
        source_config_id: 'src-123',
        error: 'Connection timeout',
        health: 'degraded',
      });

      const writeCall = (mockRes.write as any).mock.calls.find((call: any) =>
        call[0].includes('source:error')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('"error":"Connection timeout"');
    });
  });

  describe('heartbeat', () => {
    it('should start heartbeat interval when start() is called', () => {
      const broadcaster = new SSEBroadcaster();

      vi.useFakeTimers();

      broadcaster.start();

      const mockRes = createMockResponse();
      broadcaster.addClient(mockRes);

      // Clear previous write calls from addClient
      (mockRes.write as any).mockClear();

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Should have sent heartbeat comment
      expect(mockRes.write).toHaveBeenCalledWith(': heartbeat\n\n');

      broadcaster.stop();
      vi.useRealTimers();
    });

    it('should send heartbeat to all clients', () => {
      const broadcaster = new SSEBroadcaster();

      vi.useFakeTimers();

      broadcaster.start();

      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      broadcaster.addClient(mockRes1);
      broadcaster.addClient(mockRes2);

      // Clear previous calls
      (mockRes1.write as any).mockClear();
      (mockRes2.write as any).mockClear();

      // Advance time
      vi.advanceTimersByTime(30000);

      expect(mockRes1.write).toHaveBeenCalledWith(': heartbeat\n\n');
      expect(mockRes2.write).toHaveBeenCalledWith(': heartbeat\n\n');

      broadcaster.stop();
      vi.useRealTimers();
    });

    it('should remove dead connections during heartbeat', () => {
      const broadcaster = new SSEBroadcaster();

      vi.useFakeTimers();

      broadcaster.start();

      const deadClient = createMockResponse();
      const aliveClient = createMockResponse();

      broadcaster.addClient(deadClient);
      broadcaster.addClient(aliveClient);

      expect(broadcaster.clientCount).toBe(2);

      // Make dead client throw on write
      (deadClient.write as any).mockImplementation(() => {
        throw new Error('Connection closed');
      });

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(30000);

      // Dead client should be removed
      expect(broadcaster.clientCount).toBe(1);

      broadcaster.stop();
      vi.useRealTimers();
    });
  });

  describe('stop', () => {
    it('should clear heartbeat interval', () => {
      const broadcaster = new SSEBroadcaster();

      vi.useFakeTimers();

      broadcaster.start();

      const mockRes = createMockResponse();
      broadcaster.addClient(mockRes);

      broadcaster.stop();

      // Clear previous calls
      (mockRes.write as any).mockClear();

      // Advance time — should not send heartbeat after stop
      vi.advanceTimersByTime(60000);

      expect(mockRes.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should close all client connections', () => {
      broadcaster.start();

      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      broadcaster.addClient(mockRes1);
      broadcaster.addClient(mockRes2);

      broadcaster.stop();

      expect(mockRes1.end).toHaveBeenCalled();
      expect(mockRes2.end).toHaveBeenCalled();
      expect(broadcaster.clientCount).toBe(0);
    });
  });

  describe('clientCount', () => {
    it('should return correct number of connected clients', () => {
      expect(broadcaster.clientCount).toBe(0);

      const mockRes1 = createMockResponse();
      broadcaster.addClient(mockRes1);
      expect(broadcaster.clientCount).toBe(1);

      const mockRes2 = createMockResponse();
      broadcaster.addClient(mockRes2);
      expect(broadcaster.clientCount).toBe(2);

      broadcaster.removeClient(mockRes1);
      expect(broadcaster.clientCount).toBe(1);

      broadcaster.removeClient(mockRes2);
      expect(broadcaster.clientCount).toBe(0);
    });
  });

  describe('createSSEBroadcaster factory', () => {
    it('should create and start broadcaster', () => {
      const broadcaster = createSSEBroadcaster();

      expect(broadcaster).toBeInstanceOf(SSEBroadcaster);
      expect(broadcaster.clientCount).toBe(0);

      // Should be started (heartbeat running)
      // We can verify by checking that start() warns if called again
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      broadcaster.start(); // Try to start again

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Heartbeat already running')
      );

      consoleWarnSpy.mockRestore();
      broadcaster.stop();
    });
  });
});
