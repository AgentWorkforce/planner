/**
 * Anthropic API Client Configuration
 *
 * Provides configured Anthropic client instance for PlannerLead.
 * Reads API key from environment and handles missing key gracefully.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Model to use for PlannerLead responses */
export const MODEL = 'claude-sonnet-4-20250514';

/** Maximum tokens for responses */
export const MAX_TOKENS = 1024;

/** Cache the client instance */
let anthropicClient: Anthropic | null = null;

/** Track if we've warned about missing API key */
let missingKeyWarned = false;

/**
 * Check if API key is available.
 */
export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Get configured Anthropic client instance.
 * Returns null if API key is not set (allows mock mode).
 */
export function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (!missingKeyWarned) {
      console.warn('[anthropic] ANTHROPIC_API_KEY not set - PlannerLead will run in mock mode');
      missingKeyWarned = true;
    }
    return null;
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log('[anthropic] Anthropic client initialized');
  }

  return anthropicClient;
}

/**
 * Reset client (for testing).
 */
export function resetClient(): void {
  anthropicClient = null;
  missingKeyWarned = false;
}
