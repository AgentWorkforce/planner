import { useState, useEffect, useCallback, useRef } from 'react';
import type { Block } from '../components/canvas';

const API_BASE_URL = '/api/ideation';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseBlocksReturn {
  blocks: Block[];
  loading: boolean;
  error: Error | null;
  curateBlock: (blockId: string) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  uncurateBlock: (blockId: string) => Promise<void>;
  updateBlock: (blockId: string, updates: Partial<Block>) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * useBlocks
 *
 * React hook for fetching blocks and subscribing to SSE updates.
 *
 * Features:
 * - Initial fetch of blocks on mount
 * - Real-time updates via SSE subscription
 * - Loading and error state management
 * - Block mutation methods (curate, delete, uncurate)
 * - Auto-reconnect with exponential backoff
 *
 * @param sessionId - The ideation session ID
 * @returns Object with blocks array, loading state, error, and mutation methods
 *
 * @example
 * ```tsx
 * const { blocks, loading, error, curateBlock, deleteBlock } = useBlocks(sessionId);
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return blocks.map(block => (
 *   <Block key={block.id} onClick={() => curateBlock(block.id)} />
 * ));
 * ```
 */
export function useBlocks(sessionId: string): UseBlocksReturn {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  /**
   * Fetch blocks from API
   */
  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/blocks`);

      if (!res.ok) {
        throw new Error(`Failed to fetch blocks: HTTP ${res.status}`);
      }

      const data = await res.json();
      setBlocks(data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[useBlocks] Fetch error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  /**
   * Connect to SSE for real-time block updates
   */
  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/sessions/${sessionId}/events`;
    console.log(`[useBlocks] Connecting to SSE: ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useBlocks] SSE connection opened for session ${sessionId}`);
      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[useBlocks] Received event: ${data.type}`);

        // Handle block-related events
        if (data.type.startsWith('session:block_')) {
          console.log(`[useBlocks] Block event detected`);

          // If the event includes the updated blocks array, use it
          if (data.blocks) {
            console.log(`[useBlocks] Updating blocks from event payload (${data.blocks.length} blocks)`);
            setBlocks(data.blocks);
          } else {
            // Otherwise, refetch from API
            console.log(`[useBlocks] Refetching blocks`);
            fetchBlocks();
          }
        }
      } catch (err) {
        console.error(`[useBlocks] Parse error:`, err);
      }
    };

    eventSource.onerror = (err) => {
      console.error(`[useBlocks] SSE error for session ${sessionId}:`, err);
      eventSource.close();

      // Limit reconnect attempts to prevent infinite loop
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 3);
        console.log(`[useBlocks] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.error(`[useBlocks] Max reconnect attempts reached`);
      }
    };

    eventSourceRef.current = eventSource;
  }, [sessionId, fetchBlocks]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  /**
   * SSE subscription
   */
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  /**
   * Curate a block (mark as ready for planning)
   */
  const curateBlock = useCallback(async (blockId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/blocks/${blockId}/curate`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(`Failed to curate block: HTTP ${res.status}`);
      }

      // SSE will handle state update
      console.log(`[useBlocks] Block ${blockId} curated`);
    } catch (err) {
      console.error('[useBlocks] Curate error:', err);
      throw err;
    }
  }, [sessionId]);

  /**
   * Delete a block
   */
  const deleteBlock = useCallback(async (blockId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/blocks/${blockId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Failed to delete block: HTTP ${res.status}`);
      }

      // SSE will handle state update
      console.log(`[useBlocks] Block ${blockId} deleted`);
    } catch (err) {
      console.error('[useBlocks] Delete error:', err);
      throw err;
    }
  }, [sessionId]);

  /**
   * Uncurate a block (revert to ready status)
   */
  const uncurateBlock = useCallback(async (blockId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });

      if (!res.ok) {
        throw new Error(`Failed to uncurate block: HTTP ${res.status}`);
      }

      // SSE will handle state update
      console.log(`[useBlocks] Block ${blockId} uncurated`);
    } catch (err) {
      console.error('[useBlocks] Uncurate error:', err);
      throw err;
    }
  }, [sessionId]);

  /**
   * Update a block with partial changes
   */
  const updateBlock = useCallback(async (blockId: string, updates: Partial<Block>) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error(`Failed to update block: HTTP ${res.status}`);
      }

      // SSE will handle state update
      console.log(`[useBlocks] Block ${blockId} updated`);
    } catch (err) {
      console.error('[useBlocks] Update error:', err);
      throw err;
    }
  }, [sessionId]);

  return {
    blocks,
    loading,
    error,
    curateBlock,
    deleteBlock,
    uncurateBlock,
    updateBlock,
    refetch: fetchBlocks,
  };
}
