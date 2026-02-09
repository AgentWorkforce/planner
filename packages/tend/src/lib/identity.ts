/**
 * User identity management.
 *
 * Provides a stable user ID persisted in localStorage so it survives
 * page refreshes and browser restarts. Uses `user-` prefix to match
 * ws-proxy entityType detection (from.startsWith('user-')).
 */

const STORAGE_KEY = 'tend:identity:user-id';

/**
 * Get or create a user ID, persisted in localStorage.
 *
 * @returns A stable user ID across sessions
 */
export function getUserId(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.startsWith('user-')) return stored;

  const newId = `user-${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
}
