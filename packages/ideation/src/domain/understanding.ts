/**
 * Ideation Domain - Freeform Understanding Schema
 *
 * Understanding is freeform: Record<string, Record<string, unknown>>
 * Intelligence lives in agent prompts, not Zod schemas.
 *
 * Each specialist contributes their own observations in whatever structure
 * makes sense for their domain expertise.
 */

import { z } from 'zod';

// =============================================================================
// Understanding Schema
// =============================================================================

/**
 * Understanding is a freeform map of specialist observations.
 *
 * Structure: { [specialistName]: { ...freeform observations } }
 *
 * Example:
 * {
 *   "Architect": {
 *     "patterns": ["microservices", "event-sourcing"],
 *     "concerns": ["scaling", "complexity"],
 *     "confidence": "forming"
 *   },
 *   "Designer": {
 *     "user_flows": ["onboarding", "checkout"],
 *     "accessibility_notes": "needs ARIA labels",
 *     "confidence": "exploring"
 *   },
 *   "CustomAPIExpert": {
 *     "integration_points": ["stripe", "auth0"],
 *     "rate_limiting_strategy": "token bucket",
 *     "confidence": "confident"
 *   }
 * }
 *
 * The structure within each specialist's observations is entirely defined
 * by the specialist's prompt, not by this schema.
 */
export const UnderstandingSchema = z.record(
  z.string(),
  z.record(z.string(), z.unknown())
);

export type Understanding = z.infer<typeof UnderstandingSchema>;

/**
 * Empty understanding for new sessions.
 */
export function createEmptyUnderstanding(): Understanding {
  return {};
}
