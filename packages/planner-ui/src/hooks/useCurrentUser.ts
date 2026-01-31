export interface CurrentUser {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

/**
 * Hook to get the current authenticated user.
 * Currently returns a stub user for development.
 * Will be replaced with actual auth when implemented.
 */
export function useCurrentUser(): CurrentUser | null {
  // Stub implementation for development
  // Returns a fake user so /plans/my can work
  return {
    user_id: 'dev-user-001',
    name: 'Development User',
    email: 'dev@example.com',
  };
}

/**
 * Hook to check if user is authenticated.
 */
export function useIsAuthenticated(): boolean {
  // Always true for development
  return true;
}
