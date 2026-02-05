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
 *
 * NOTE: This creates a theoretical UUID collision risk since only 8 chars are used.
 * For production, consider using full UUID or at least 12+ chars.
 * Current implementation accepts the risk for cleaner channel names.
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

/**
 * Static LLM config defaults.
 * Used as fallback when Tuner is unavailable.
 */
const DEFAULT_LLM_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
} as const;

/**
 * Get current LLM configuration.
 * Uses Tuner config if available, otherwise falls back to defaults.
 *
 * NOTE: This is a dynamic getter that reads from Tuner's cached config.
 * If Tuner is unavailable, returns hardcoded defaults for graceful degradation.
 */
export function getLLMConfig(): { model: string; maxTokens: number; temperature: number } {
  // Lazy import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tuner = (require('../tuner/index.js') as typeof import('../tuner/index.js')).getTunerIntegration();
  const config = tuner?.getConfig();

  if (config) {
    return {
      model: config.interviewer.model,
      maxTokens: config.interviewer.max_tokens,
      temperature: config.interviewer.temperature,
    };
  }

  return { ...DEFAULT_LLM_CONFIG };
}

/**
 * Static LLM config export for backward compatibility.
 * @deprecated Use getLLMConfig() instead for dynamic config
 */
export const LLM_CONFIG = DEFAULT_LLM_CONFIG;
