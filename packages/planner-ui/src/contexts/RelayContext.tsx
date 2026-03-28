/**
 * RelayContext - Shared WebSocket connection for relay messaging
 *
 * Provides a single WebSocket connection to the relay proxy that is shared
 * across all components. This prevents the user registration churn that
 * occurs when each component creates its own connection.
 *
 * Usage:
 *   // In App.tsx, wrap your routes:
 *   <RelayProvider>
 *     <Routes>...</Routes>
 *   </RelayProvider>
 *
 *   // In any component:
 *   const { connection, isConnected, userId, displayName, isMock } = useRelay();
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useRelayConnection } from '@/hooks/useRelayConnection';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getUserId } from '@/lib/identity';
import type { UseRelayConnectionResult } from '@/types';

interface RelayContextValue {
  /** The underlying relay connection (useRelayConnection result) */
  connection: UseRelayConnectionResult;
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** User ID used for this connection */
  userId: string | null;
  /** Display name shown to other users/agents */
  displayName: string;
  /** Whether running in mock mode (relay daemon unavailable) */
  isMock: boolean;
}

const RelayContext = createContext<RelayContextValue | null>(null);

interface RelayProviderProps {
  children: ReactNode;
}

/**
 * RelayProvider - Establishes a single shared relay connection for the app.
 *
 * Uses useCurrentUser() for stable user identity. For anonymous users,
 * generates a stable ID that persists in sessionStorage. The connection
 * persists across page navigation because this provider wraps the entire app.
 */
export function RelayProvider({ children }: RelayProviderProps) {
  const currentUser = useCurrentUser();

  // Compute stable identity - use authenticated user or generate anonymous ID
  const { userId, displayName } = useMemo(() => {
    if (currentUser) {
      return {
        userId: currentUser.user_id,
        displayName: currentUser.name,
      };
    }
    // Anonymous user - use session-persistent ID
    return {
      userId: getUserId(),
      displayName: 'Anonymous',
    };
  }, [currentUser]);

  // Create single shared connection with stable user identity
  const connection = useRelayConnection(displayName, true, userId);

  const value: RelayContextValue = {
    connection,
    isConnected: connection.isConnected,
    userId: connection.userId,
    displayName,
    isMock: connection.isMock,
  };

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

/**
 * useRelay - Access the shared relay connection.
 *
 * @throws Error if used outside RelayProvider
 *
 * @example
 * const { connection, isConnected } = useRelay();
 * connection.sendChannelMessage('#general', 'Hello!');
 */
export function useRelay(): RelayContextValue {
  const context = useContext(RelayContext);
  if (!context) {
    throw new Error('useRelay must be used within a RelayProvider');
  }
  return context;
}
