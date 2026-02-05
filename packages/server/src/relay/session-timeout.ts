/**
 * Session Timeout Service
 *
 * Background service that monitors active planning sessions
 * and terminates those that exceed the configured timeout.
 */

import type { PlanStorage } from '../../../planner/src/storage/interface.js';
import { terminateAgent } from './spawner.js';

/** Default session timeout in minutes */
const DEFAULT_TIMEOUT_MINUTES = 30;

/** Interval between timeout checks in milliseconds (1 minute) */
const CHECK_INTERVAL_MS = 60 * 1000;

/** Get configured timeout in minutes from environment */
function getTimeoutMinutes(): number {
  const envValue = process.env.SESSION_TIMEOUT_MINUTES;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_TIMEOUT_MINUTES;
}

/** Check if a session has exceeded its timeout */
function isSessionTimedOut(startedAt: string, timeoutMinutes: number): boolean {
  const started = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - started) / (60 * 1000);
  return elapsedMinutes > timeoutMinutes;
}

/**
 * Check for and handle timed-out sessions.
 * Returns the number of sessions that were timed out.
 */
export async function checkSessionTimeouts(storage: PlanStorage): Promise<number> {
  const timeoutMinutes = getTimeoutMinutes();
  const activeSessions = storage.getActiveSessions();

  let timedOutCount = 0;

  for (const session of activeSessions) {
    if (isSessionTimedOut(session.started_at, timeoutMinutes)) {
      // Mark session as timed out
      storage.updateSessionStatus(session.session_id, 'timeout');
      timedOutCount++;

      console.log(
        `[session-timeout] Session ${session.session_id} timed out after ${timeoutMinutes} minutes`
      );

      // Terminate the agent
      try {
        await terminateAgent(session.agent_id);
        console.log(`[session-timeout] Terminated agent ${session.agent_id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[session-timeout] Failed to terminate agent ${session.agent_id}: ${message}`);
      }
    }
  }

  return timedOutCount;
}

/**
 * Session timeout service state.
 */
interface SessionTimeoutService {
  /** Start the background timeout checker */
  start(): void;
  /** Stop the background timeout checker */
  stop(): void;
  /** Check if the service is running */
  isRunning(): boolean;
}

/**
 * Create a session timeout service.
 * Call start() to begin the background timeout checker.
 */
export function createSessionTimeoutService(storage: PlanStorage): SessionTimeoutService {
  let intervalId: NodeJS.Timeout | null = null;
  let checkCount = 0;

  return {
    start() {
      if (intervalId) {
        return; // Already running
      }

      const timeoutMinutes = getTimeoutMinutes();
      console.log(
        `[session-timeout] Starting timeout service (timeout: ${timeoutMinutes} min, check interval: 1 min)`
      );

      // Run check immediately, then on interval
      checkSessionTimeouts(storage).catch((err) => {
        console.error('[session-timeout] Error in timeout check:', err);
      });

      intervalId = setInterval(async () => {
        checkCount++;
        try {
          const timedOut = await checkSessionTimeouts(storage);
          // Only log if sessions were timed out, or every 10 checks (10 min) for heartbeat
          if (timedOut > 0) {
            console.log(`[session-timeout] Timed out ${timedOut} session(s)`);
          } else if (checkCount % 10 === 0) {
            const activeSessions = storage.getActiveSessions();
            if (activeSessions.length > 0) {
              console.log(`[session-timeout] Monitoring ${activeSessions.length} active session(s)`);
            }
          }
        } catch (err) {
          console.error('[session-timeout] Error in timeout check:', err);
        }
      }, CHECK_INTERVAL_MS);
    },

    stop() {
      if (intervalId) {
        console.log('[session-timeout] Stopping timeout service');
        clearInterval(intervalId);
        intervalId = null;
        checkCount = 0;
      }
    },

    isRunning() {
      return intervalId !== null;
    },
  };
}
