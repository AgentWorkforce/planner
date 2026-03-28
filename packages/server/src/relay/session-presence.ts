/**
 * Session Presence Tracking
 *
 * Tracks which users are connected to ideation session channels and manages
 * grace/park timers for agent lifecycle. When the last user leaves a session,
 * a grace period begins; if no user returns, the agent is parked (released).
 */

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_GRACE_PERIOD_MS = 60_000; // 60 seconds before considering parking
const DEFAULT_PARK_AFTER_MS = 5 * 60_000; // 5 minutes total before killing agent

interface SessionPresenceConfig {
  onPark: (sessionId: string, agentName: string) => Promise<void>;
  gracePeriodMs?: number;
  parkAfterMs?: number;
}

let config: SessionPresenceConfig | null = null;

export function initSessionPresence(cfg: SessionPresenceConfig): void {
  config = cfg;
  console.log('[session-presence] Initialized with config:', {
    gracePeriodMs: cfg.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS,
    parkAfterMs: cfg.parkAfterMs ?? DEFAULT_PARK_AFTER_MS,
  });
}

// ============================================================================
// Data Structures
// ============================================================================

interface SessionPresence {
  sessionId: string;
  channel: string;
  watchers: Map<string, number>; // userId → connectionCount
  graceTimer: ReturnType<typeof setTimeout> | null;
  parkTimer: ReturnType<typeof setTimeout> | null;
  agentName: string | null;
  lastUserDisconnect: number | null;
}

/**
 * Registry of session presence data, keyed by channel name.
 */
const sessionRegistry = new Map<string, SessionPresence>();

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract sessionId from an ideation channel name.
 * Channel format: #ideation-{8-char-prefix} or #ideation-{full-uuid}
 * Returns the 8-char prefix as sessionId.
 */
function extractSessionId(channel: string): string | null {
  const match = channel.match(/^#ideation-([a-f0-9]{8})/);
  return match ? match[1] : null;
}

/**
 * Check if a channel is an ideation session channel (not the main #ideation channel).
 */
function isIdeationSessionChannel(channel: string): boolean {
  return /^#ideation-[a-f0-9]{8}/.test(channel) && channel !== '#ideation';
}

// ============================================================================
// Timer Management (Private)
// ============================================================================

function cancelTimers(presence: SessionPresence): void {
  if (presence.graceTimer) {
    clearTimeout(presence.graceTimer);
    presence.graceTimer = null;
  }
  if (presence.parkTimer) {
    clearTimeout(presence.parkTimer);
    presence.parkTimer = null;
  }
}

function startGracePeriod(presence: SessionPresence): void {
  if (!config) {
    console.warn('[session-presence] Cannot start grace period: config not initialized');
    return;
  }

  const gracePeriodMs = config.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;
  const parkAfterMs = config.parkAfterMs ?? DEFAULT_PARK_AFTER_MS;
  const parkCountdownMs = parkAfterMs - gracePeriodMs;

  console.log(`[session-presence] Grace period started for session ${presence.sessionId} (${gracePeriodMs / 1000}s)`);

  presence.graceTimer = setTimeout(() => {
    console.log(`[session-presence] Grace period expired for session ${presence.sessionId}, starting park countdown (${parkCountdownMs / 1000}s)`);
    presence.graceTimer = null;

    // Start park timer
    presence.parkTimer = setTimeout(async () => {
      console.log(`[session-presence] Parking agent ${presence.agentName} for session ${presence.sessionId} (no users for ${parkAfterMs / 1000}s)`);
      presence.parkTimer = null;

      if (presence.agentName && config?.onPark) {
        try {
          await config.onPark(presence.sessionId, presence.agentName);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[session-presence] Error in onPark callback for session ${presence.sessionId}:`, message);
        }
      }
    }, parkCountdownMs);
  }, gracePeriodMs);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Add a watcher to a session channel.
 * Only tracks ideation session channels (skip #ideation main channel).
 */
export function addWatcher(channel: string, userId: string): void {
  if (!isIdeationSessionChannel(channel)) {
    return;
  }

  const sessionId = extractSessionId(channel);
  if (!sessionId) {
    console.warn(`[session-presence] Invalid ideation channel format: ${channel}`);
    return;
  }

  // Get or create presence entry
  let presence = sessionRegistry.get(channel);
  if (!presence) {
    presence = {
      sessionId,
      channel,
      watchers: new Map(),
      graceTimer: null,
      parkTimer: null,
      agentName: null,
      lastUserDisconnect: null,
    };
    sessionRegistry.set(channel, presence);
  }

  // Increment connection count for this user
  const currentCount = presence.watchers.get(userId) ?? 0;
  presence.watchers.set(userId, currentCount + 1);

  const totalWatchers = presence.watchers.size;

  // If this takes watcher count from 0 → 1, cancel timers
  if (totalWatchers === 1 && currentCount === 0) {
    cancelTimers(presence);
    console.log(`[session-presence] User returned to session ${sessionId}`);
  }

  console.log(`[session-presence] User ${userId} watching session ${sessionId} (watchers: ${totalWatchers})`);
}

/**
 * Remove a watcher from a session channel.
 * If the last watcher leaves, start grace period.
 */
export function removeWatcher(channel: string, userId: string): void {
  if (!isIdeationSessionChannel(channel)) {
    return;
  }

  const presence = sessionRegistry.get(channel);
  if (!presence) {
    return;
  }

  const currentCount = presence.watchers.get(userId) ?? 0;
  if (currentCount <= 0) {
    return;
  }

  if (currentCount === 1) {
    // Last connection for this user
    presence.watchers.delete(userId);
  } else {
    // Decrement connection count
    presence.watchers.set(userId, currentCount - 1);
  }

  const totalWatchers = presence.watchers.size;

  console.log(`[session-presence] User ${userId} left session ${presence.sessionId} (watchers remaining: ${totalWatchers})`);

  // If no watchers remain, start grace period
  if (totalWatchers === 0) {
    presence.lastUserDisconnect = Date.now();
    startGracePeriod(presence);
  }
}

/**
 * Associate an agent name with a session channel.
 * Called by ideation-bridge after spawning an agent.
 */
export function setAgentForSession(channel: string, agentName: string): void {
  if (!isIdeationSessionChannel(channel)) {
    return;
  }

  const presence = sessionRegistry.get(channel);
  if (!presence) {
    console.warn(`[session-presence] Cannot set agent for unknown session: ${channel}`);
    return;
  }

  presence.agentName = agentName;
  console.log(`[session-presence] Agent ${agentName} associated with session ${presence.sessionId}`);
}

/**
 * Get presence data for a specific session.
 */
export function getSessionPresence(sessionId: string): SessionPresence | undefined {
  const entries = Array.from(sessionRegistry.values());
  for (const presence of entries) {
    if (presence.sessionId === sessionId) {
      return presence;
    }
  }
  return undefined;
}

/**
 * Get all session presence data.
 */
export function getAllPresence(): Map<string, SessionPresence> {
  return new Map(sessionRegistry);
}

/**
 * Get the lifecycle state of an agent.
 */
export function getAgentLifecycleState(agentName: string): 'active' | 'grace_period' | 'draining' | 'parked' | null {
  const entries = Array.from(sessionRegistry.values());
  for (const presence of entries) {
    if (presence.agentName === agentName) {
      if (presence.watchers.size > 0) {
        return 'active';
      }
      if (presence.graceTimer !== null) {
        return 'grace_period';
      }
      if (presence.parkTimer !== null) {
        return 'draining';
      }
      // No timers and no watchers - considered parked or cleaned up
      return 'parked';
    }
  }
  return null;
}
