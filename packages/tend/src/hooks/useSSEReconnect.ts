import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSSEReconnectOptions {
  /**
   * Maximum number of retry attempts before giving up
   * @default 5
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for exponential backoff
   * @default 1000 (1 second)
   */
  baseDelay?: number;

  /**
   * Maximum delay cap in milliseconds
   * @default 16000 (16 seconds)
   */
  maxDelay?: number;

  /**
   * Called when connection is established
   */
  onConnect?: () => void;

  /**
   * Called when connection is lost
   */
  onDisconnect?: () => void;

  /**
   * Called when max retries exhausted
   */
  onMaxRetriesExceeded?: () => void;
}

export interface UseSSEReconnectReturn {
  /**
   * Whether currently connected
   */
  isConnected: boolean;

  /**
   * Current retry attempt count (0 = no retries yet)
   */
  retryCount: number;

  /**
   * Maximum retry attempts allowed
   */
  maxRetries: number;

  /**
   * Manually trigger a reconnection attempt
   */
  reconnect: () => void;

  /**
   * Mark connection as established (call from EventSource onopen)
   */
  markConnected: () => void;

  /**
   * Mark connection as lost (call from EventSource onerror)
   */
  markDisconnected: () => void;

  /**
   * Reset retry count (useful when connection succeeds)
   */
  resetRetries: () => void;
}

/**
 * useSSEReconnect - Generic reconnection logic for SSE streams
 *
 * Implements exponential backoff with max retries.
 * Can be composed with existing SSE hooks.
 *
 * @example
 * const { isConnected, markConnected, markDisconnected } = useSSEReconnect({
 *   maxRetries: 5,
 *   onConnect: () => console.log('Connected!'),
 *   onDisconnect: () => console.log('Disconnected'),
 * });
 *
 * useEffect(() => {
 *   const eventSource = new EventSource(url);
 *   eventSource.onopen = () => markConnected();
 *   eventSource.onerror = () => markDisconnected();
 *   return () => eventSource.close();
 * }, [url, markConnected, markDisconnected]);
 */
export function useSSEReconnect(options: UseSSEReconnectOptions = {}): UseSSEReconnectReturn {
  const {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 16000,
    onConnect,
    onDisconnect,
    onMaxRetriesExceeded,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectCallbackRef = useRef<(() => void) | null>(null);

  // Exponential backoff calculation
  const getBackoffDelay = useCallback((attempt: number): number => {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay;
  }, [baseDelay, maxDelay]);

  // Mark as connected
  const markConnected = useCallback(() => {
    setIsConnected(true);
    setRetryCount(0);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    onConnect?.();
  }, [onConnect]);

  // Mark as disconnected and schedule retry
  const markDisconnected = useCallback(() => {
    setIsConnected(false);
    onDisconnect?.();

    // Schedule retry if under max attempts
    setRetryCount((prev) => {
      const nextCount = prev + 1;

      if (nextCount > maxRetries) {
        onMaxRetriesExceeded?.();
        return prev;
      }

      // Schedule reconnection with exponential backoff
      const delay = getBackoffDelay(nextCount - 1);
      retryTimeoutRef.current = setTimeout(() => {
        reconnectCallbackRef.current?.();
      }, delay);

      return nextCount;
    });
  }, [onDisconnect, onMaxRetriesExceeded, maxRetries, getBackoffDelay]);

  // Manual reconnect trigger
  const reconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setRetryCount(0);
    reconnectCallbackRef.current?.();
  }, []);

  // Reset retry count
  const resetRetries = useCallback(() => {
    setRetryCount(0);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    retryCount,
    maxRetries,
    reconnect,
    markConnected,
    markDisconnected,
    resetRetries,
  };
}
