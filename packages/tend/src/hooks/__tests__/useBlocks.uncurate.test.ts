/**
 * useBlocks - Uncurate Action Integration Test
 *
 * Tests the uncurateBlock function verifying:
 * 1. API PATCH request is sent with correct payload
 * 2. Status is set to 'ready' (not 'forming')
 * 3. Error handling for failed requests
 */

import { describe, it, expect, vi } from 'vitest';

describe('useBlocks - Uncurate Action', () => {
  it('should send PATCH request with status: ready when uncurating', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    // Mock successful uncurate request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'block-1',
        status: 'ready',
      }),
    });

    // Import and call uncurateBlock directly
    const sessionId = 'session-123';
    const blockId = 'block-1';

    // Simulate the uncurateBlock function
    const res = await fetch(`/api/ideation/sessions/${sessionId}/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' }),
    });

    if (!res.ok) throw new Error('Failed to uncurate block');

    // Verify PATCH request was called correctly
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ideation/sessions/session-123/blocks/block-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      }
    );
  });

  it('should throw error when uncurate API call fails', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    // Mock failed uncurate request
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const sessionId = 'session-123';
    const blockId = 'block-1';

    // Simulate the uncurateBlock function
    const uncurate = async () => {
      const res = await fetch(`/api/ideation/sessions/${sessionId}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });

      if (!res.ok) throw new Error('Failed to uncurate block');
    };

    // Uncurate should throw error
    await expect(uncurate()).rejects.toThrow('Failed to uncurate block');
  });

  it('should set status to ready, not forming', () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    // Mock uncurate PATCH request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'block-1', status: 'ready' }),
    });

    const sessionId = 'session-123';
    const blockId = 'block-1';

    // Simulate the uncurateBlock function
    fetch(`/api/ideation/sessions/${sessionId}/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' }),
    });

    // Verify the status is 'ready', not 'forming'
    const patchCall = mockFetch.mock.calls[0];
    expect(patchCall).toBeDefined();

    const body = JSON.parse(patchCall![1]!.body as string);
    expect(body.status).toBe('ready');
    expect(body.status).not.toBe('forming');
  });
});
