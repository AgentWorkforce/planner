/**
 * User identity management.
 *
 * Provides a stable anonymous user ID for this session, persisted in sessionStorage
 * so it survives page refreshes within the same tab.
 */

const STORAGE_KEY = 'tend:identity:user-id';

/**
 * Get or create an anonymous user ID, persisted in sessionStorage.
 *
 * @returns A stable user ID for this session
 */
export function getUserId(): string {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const newId = `anon-${crypto.randomUUID().slice(0, 8)}`;
  sessionStorage.setItem(STORAGE_KEY, newId);
  return newId;
}
