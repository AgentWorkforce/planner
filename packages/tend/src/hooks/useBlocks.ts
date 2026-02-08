import { useState, useEffect, useCallback } from 'react';
import type { Block } from '../components/canvas';

const API_BASE_URL = '/api/ideation';

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
export function useBlocks(sessionId: string | undefined, refreshKey?: number): UseBlocksReturn {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch blocks from API
   */
  const fetchBlocks = useCallback(async () => {
    if (!sessionId) {
      setBlocks([]);
      setLoading(false);
      return;
    }

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
   * Initial fetch on mount + refetch when refreshKey changes
   * (SSE removed — useProjectEvents in ProjectContext handles real-time updates
   *  and increments refreshKey to trigger refetch, avoiding browser connection limit exhaustion)
   */
  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks, refreshKey]);

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
