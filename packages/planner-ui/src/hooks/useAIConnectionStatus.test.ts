import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIConnectionStatus } from './useAIConnectionStatus';

// Mock the chat API module
vi.mock('@/api/chat', () => ({
  getSessionStatus: vi.fn(),
  createSession: vi.fn(),
}));

import { getSessionStatus, createSession } from '@/api/chat';

describe('useAIConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts in loading state', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });
      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123'));

      expect(result.current.status).toBe('loading');
      expect(result.current.isConnected).toBe(false);

      // Wait for initial load to complete before unmount
      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });
      unmount();
    });

    it('returns demo status when no planId provided', async () => {
      // Note: with null planId, hook needs polling to recover from reset effect
      const { result, unmount } = renderHook(() => useAIConnectionStatus(null, 100));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });
      expect(result.current.isConnected).toBe(false);
      expect(result.current.session).toBeNull();
      unmount();
    });
  });

  describe('status checking', () => {
    it('shows connected when session is active', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({
        active: true,
        session_id: 'session-123',
        agent_id: 'agent-456',
      });

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123'));

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });
      expect(result.current.isConnected).toBe(true);
      expect(result.current.session?.session_id).toBe('session-123');
      unmount();
    });

    it('shows demo when session is not active', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123'));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });
      expect(result.current.isConnected).toBe(false);
      unmount();
    });

    it('shows demo when status check fails', async () => {
      vi.mocked(getSessionStatus).mockRejectedValue(new Error('Network error'));

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123'));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });
      expect(result.current.session).toBeNull();
      unmount();
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('polls at the specified interval', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });

      const { unmount } = renderHook(() => useAIConnectionStatus('plan-123', 5000));

      // Wait for initial check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(getSessionStatus).toHaveBeenCalledTimes(1);

      // Advance to next poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(getSessionStatus).toHaveBeenCalledTimes(2);
      unmount();
    });

    it('does not poll when planId is null', async () => {
      const { unmount } = renderHook(() => useAIConnectionStatus(null, 5000));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(getSessionStatus).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe('refresh', () => {
    it('manually triggers a status check', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0)); // disable polling

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      expect(getSessionStatus).toHaveBeenCalledTimes(1);

      // Manually refresh
      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(getSessionStatus).toHaveBeenCalledTimes(2);
      });
      unmount();
    });
  });

  describe('connect', () => {
    it('creates a session and refreshes status on success', async () => {
      vi.mocked(getSessionStatus)
        .mockResolvedValueOnce({ active: false })
        .mockResolvedValueOnce({
          active: true,
          session_id: 'new-session',
          agent_id: 'new-agent',
        });

      vi.mocked(createSession).mockResolvedValue({
        session_id: 'new-session',
        status: 'active',
        agent_id: 'new-agent',
        started_at: new Date().toISOString(),
      });

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(createSession).toHaveBeenCalledWith('plan-123');

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });
      expect(result.current.isConnected).toBe(true);
      unmount();
    });

    it('handles already connected response', async () => {
      vi.mocked(getSessionStatus)
        .mockResolvedValueOnce({ active: false })
        .mockResolvedValueOnce({
          active: true,
          session_id: 'existing-session',
          agent_id: 'existing-agent',
        });

      vi.mocked(createSession).mockResolvedValue({
        alreadyConnected: true,
        session_id: 'existing-session',
        agent_id: 'existing-agent',
        started_at: new Date().toISOString(),
      });

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });
      unmount();
    });

    it('sets error on connect failure', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });
      vi.mocked(createSession).mockRejectedValue(new Error('AI service unavailable'));

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.connectError).toBe('AI service unavailable');
      expect(result.current.status).toBe('demo');
      unmount();
    });

    it('tracks isConnecting during connection attempt', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });

      // Create a deferred promise to control timing
      let resolveCreate!: (value: unknown) => void;
      vi.mocked(createSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      // Start connection (don't await it yet)
      let connectPromise: Promise<void>;
      act(() => {
        connectPromise = result.current.connect();
      });

      // isConnecting should be true immediately
      expect(result.current.isConnecting).toBe(true);

      // Resolve the create call
      await act(async () => {
        resolveCreate({ session_id: 's1', status: 'active', agent_id: 'a1', started_at: '' });
        await connectPromise;
      });

      expect(result.current.isConnecting).toBe(false);
      unmount();
    });

    it('does not connect when already connected', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({
        active: true,
        session_id: 'existing',
        agent_id: 'existing',
      });

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0));

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(createSession).not.toHaveBeenCalled();
      unmount();
    });

    it('does not connect when no planId', async () => {
      // Note: with null planId, hook needs polling to recover from reset effect
      const { result, unmount } = renderHook(() => useAIConnectionStatus(null, 100));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(createSession).not.toHaveBeenCalled();
      unmount();
    });

    it('does not connect when already connecting', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });

      // Create a deferred promise to control timing
      let resolveCreate!: (value: unknown) => void;
      vi.mocked(createSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      const { result, unmount } = renderHook(() => useAIConnectionStatus('plan-123', 0));

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      // Start first connection
      let connectPromise: Promise<void>;
      act(() => {
        connectPromise = result.current.connect();
      });

      expect(result.current.isConnecting).toBe(true);

      // Try to connect again - should be a no-op
      await act(async () => {
        await result.current.connect();
      });

      // Should only be called once
      expect(createSession).toHaveBeenCalledTimes(1);

      // Clean up
      await act(async () => {
        resolveCreate({ session_id: 's1', status: 'active', agent_id: 'a1', started_at: '' });
        await connectPromise;
      });
      unmount();
    });
  });

  describe('plan change', () => {
    it('resets to loading state on plan change', async () => {
      vi.mocked(getSessionStatus).mockResolvedValue({ active: false });

      const { result, rerender, unmount } = renderHook(
        ({ planId }) => useAIConnectionStatus(planId, 0),
        { initialProps: { planId: 'plan-1' } }
      );

      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });

      rerender({ planId: 'plan-2' });

      expect(result.current.status).toBe('loading');

      // Wait for the new plan to settle
      await waitFor(() => {
        expect(result.current.status).toBe('demo');
      });
      unmount();
    });
  });
});
