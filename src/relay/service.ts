/**
 * Relay Availability Service
 *
 * Single source of truth for whether relay features are active.
 * When unavailable, AI features should fall back to mock responses.
 */

import { isConnected, getConnectionState, onStateChange, type ClientState } from './client.js';

export type RelayMode = 'connected' | 'disconnected' | 'mock';

type ModeChangeCallback = (mode: RelayMode) => void;

const modeChangeListeners: Set<ModeChangeCallback> = new Set();
let forceMockMode = false;

/**
 * Check if relay is available for use.
 */
export function isRelayAvailable(): boolean {
  if (forceMockMode) {
    return false;
  }
  return isConnected();
}

/**
 * Get the current relay mode.
 */
export function getRelayMode(): RelayMode {
  if (forceMockMode) {
    return 'mock';
  }
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

/**
 * Force mock mode (useful for testing or when daemon should be ignored).
 */
export function setForceMockMode(enable: boolean): void {
  const previousMode = getRelayMode();
  forceMockMode = enable;
  const newMode = getRelayMode();

  if (previousMode !== newMode) {
    notifyModeChange(newMode);
  }
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
  if (forceMockMode) {
    return 'mock';
  }
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

// Re-export types
export type { RelayMode as RelayModeType };
