/**
 * Relay Availability Service
 *
 * Single source of truth for whether relay features are active.
 * When unavailable, endpoints return empty data with a disconnected mode indicator.
 */

import { isConnected, getConnectionState, onStateChange, type ClientState } from './client.js';

export type RelayMode = 'connected' | 'disconnected';

type ModeChangeCallback = (mode: RelayMode) => void;

const modeChangeListeners: Set<ModeChangeCallback> = new Set();

/**
 * Check if relay is available for use.
 */
export function isRelayAvailable(): boolean {
  return isConnected();
}

/**
 * Get the current relay mode.
 */
export function getRelayMode(): RelayMode {
  return isConnected() ? 'connected' : 'disconnected';
}

/**
 * Subscribe to relay mode changes.
 */
export function onModeChange(callback: ModeChangeCallback): () => void {
  modeChangeListeners.add(callback);
  return () => {
    modeChangeListeners.delete(callback);
  };
}

function notifyModeChange(mode: RelayMode): void {
  for (const listener of modeChangeListeners) {
    try {
      listener(mode);
    } catch (error) {
      console.error('[relay-service] Error in mode change listener:', error);
    }
  }
}

function mapStateToMode(state: ClientState): RelayMode {
  return state === 'READY' ? 'connected' : 'disconnected';
}

// Subscribe to client state changes and forward as mode changes
let lastMode: RelayMode = 'disconnected';
onStateChange((state: ClientState) => {
  const newMode = mapStateToMode(state);
  if (newMode !== lastMode) {
    lastMode = newMode;
    notifyModeChange(newMode);
  }
});
