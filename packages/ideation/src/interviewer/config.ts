/**
 * Interviewer Configuration and Constants
 *
 * Central config for the Interviewer persistent service.
 */

// =============================================================================
// Interviewer Identity
// =============================================================================

export const INTERVIEWER_CONFIG = {
  name: 'Interviewer',
  displayName: 'Brainstorming Facilitator',
  role: 'interviewer',
  agentId: 'ideation-interviewer',
} as const;

// =============================================================================
// Channels
// =============================================================================

/**
 * Main ideation channel where sessions are announced.
 */
export const IDEATION_CHANNEL = '#ideation';

/**
 * Generate session-specific channel ID.
 * Uses first 8 chars of session ID for brevity.
 */
export function sessionChannelId(sessionId: string): string {
  return `#ideation-${sessionId.slice(0, 8)}`;
}

/**
 * Check if a channel is an ideation channel.
 */
export function isIdeationChannel(channelId: string): boolean {
  return channelId === IDEATION_CHANNEL || channelId.startsWith('#ideation-');
}

/**
 * Extract session ID prefix from channel ID.
 * Returns undefined if not a session channel.
 */
export function extractSessionPrefix(channelId: string): string | undefined {
  const match = channelId.match(/^#ideation-(.+)$/);
  return match?.[1];
}

// =============================================================================
// LLM Config
// =============================================================================

export const LLM_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
} as const;
