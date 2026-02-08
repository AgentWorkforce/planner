/**
 * Specialist Lifecycle Management
 *
 * Handles specialist release when sessions are abandoned.
 */

import type { IdeationStorage } from '../storage/index.js';

// =============================================================================
// Types
// =============================================================================

export interface LifecycleDeps {
  storage: IdeationStorage;
  releaseAgent?: (agentId: string) => Promise<void>;
}

// =============================================================================
// Release Functions
// =============================================================================

/**
 * Release all specialists for a session.
 *
 * Called when session status changes to 'abandoned'.
 *
 * @param sessionId - Session ID
 * @param deps - Dependencies
 * @returns Array of released agent IDs
 */
export async function releaseSpecialists(
  sessionId: string,
  deps: LifecycleDeps
): Promise<string[]> {
  const { storage, releaseAgent } = deps;

  // Get session to find active specialists
  const session = await storage.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const released: string[] = [];

  // Release each specialist
  for (const specialist of session.active_specialists) {
    try {
      if (releaseAgent) {
        await releaseAgent(specialist.agent_id);
      }
      // Remove from session
      await storage.removeActiveSpecialist(sessionId, specialist.name);
      released.push(specialist.agent_id);
    } catch (error) {
      console.error(
        `[Specialist] Failed to release ${specialist.name} (${specialist.agent_id}):`,
        error
      );
    }
  }

  console.log(`[Specialist] Released ${released.length} specialists for session ${sessionId}`);
  return released;
}

/**
 * Release a single specialist by name.
 *
 * @param sessionId - Session ID
 * @param specialistName - Name of specialist to release
 * @param deps - Dependencies
 * @returns Released agent ID or null if not found
 */
export async function releaseSpecialist(
  sessionId: string,
  specialistName: string,
  deps: LifecycleDeps
): Promise<string | null> {
  const { storage, releaseAgent } = deps;

  // Get session
  const session = await storage.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Find specialist
  const specialist = session.active_specialists.find(s => s.name === specialistName);
  if (!specialist) {
    return null;
  }

  // Release
  if (releaseAgent) {
    await releaseAgent(specialist.agent_id);
  }
  await storage.removeActiveSpecialist(sessionId, specialistName);

  console.log(`[Specialist] Released ${specialistName} (${specialist.agent_id})`);
  return specialist.agent_id;
}

/**
 * Check if session has active specialists.
 *
 * @param sessionId - Session ID
 * @param storage - Storage instance
 * @returns True if session has active specialists
 */
export async function hasActiveSpecialists(
  sessionId: string,
  storage: IdeationStorage
): Promise<boolean> {
  const session = await storage.getSession(sessionId);
  return (session?.active_specialists.length ?? 0) > 0;
}

/**
 * Get count of active specialists for a session.
 *
 * @param sessionId - Session ID
 * @param storage - Storage instance
 * @returns Number of active specialists
 */
export async function getActiveSpecialistCount(
  sessionId: string,
  storage: IdeationStorage
): Promise<number> {
  const session = await storage.getSession(sessionId);
  return session?.active_specialists.length ?? 0;
}
