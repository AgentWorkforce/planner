/**
 * Centralized storage key constants for localStorage and sessionStorage.
 *
 * Using consistent 'plannr:' namespace for all keys.
 */

export const STORAGE_KEYS = {
  // Identity (sessionStorage)
  USER_ID: 'plannr:identity:user-id',

  // Chat (localStorage)
  chatHistory: (planId: string) => `plannr:chat:${planId}`,

  // Sidebar (localStorage)
  SIDEBAR_COLLAPSED: 'plannr:sidebar:collapsed',
  MESSAGING_SIDEBAR_COLLAPSED: 'plannr:messaging:sidebar-collapsed',

  // Messaging (localStorage)
  LAST_CHANNEL: 'plannr:messaging:last-channel',
} as const;
