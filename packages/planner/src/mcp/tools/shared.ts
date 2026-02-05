import type { PlanStorage } from '../../storage/interface.js';
import { success, error, type ToolResponse } from './types.js';

/**
 * Error response for version conflict (structured for optimistic locking).
 */
export interface VersionConflictResponse {
  success: false;
  error: 'VERSION_CONFLICT';
  message: string;
  expected_version: number;
  current_version: number;
}

/**
 * Check for version conflict and return error response if detected.
 * Returns null if no conflict (or no expected_version provided).
 */
export function checkVersionConflict(
  expectedVersion: number | undefined,
  currentVersion: number
): VersionConflictResponse | null {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    return {
      success: false,
      error: 'VERSION_CONFLICT',
      message: 'Version has changed since last read. Re-read the plan before editing.',
      expected_version: expectedVersion,
      current_version: currentVersion,
    };
  }
  return null;
}

/**
 * Base handler context passed to all tool handlers.
 */
export interface HandlerContext {
  storage: PlanStorage;
}

// Re-export common helper functions
export { success, error };
export type { ToolResponse };
