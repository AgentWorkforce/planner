/**
 * Tier 0 greenhouse keyword gate filter
 *
 * Applies keyword-based filtering at the greenhouse level:
 * - Checks for required keywords (keyword_require)
 * - Checks for excluded keywords (keyword_exclude)
 *
 * This is the first line of defense in the signal pipeline.
 */

import { SignalFilteredError, SignalMetadata } from '../errors.js';

/**
 * Signal data required for greenhouse gate filtering
 */
export interface GreenhouseGateSignal {
  title: string;
  body: string;
  source_type: string;
  external_id: string;
  greenhouse_id?: string;
}

/**
 * Greenhouse filtering rules
 */
export interface GreenhouseGateRules {
  keyword_require: string[];
  keyword_exclude: string[];
}

/**
 * Result of greenhouse gate filtering
 */
export interface GreenhouseGateResult {
  passed: boolean;
  reason?: string;
}

/**
 * Apply greenhouse keyword gate to a signal
 *
 * Logic:
 * 1. If keyword_require is non-empty, check that title+body contains at least one required keyword
 * 2. Check that title+body does not contain any excluded keyword
 * 3. Throw SignalFilteredError on rejection (filter_tier=0)
 *
 * @param signal - Signal with title and body to filter
 * @param greenhouse - Greenhouse rules with keyword_require and keyword_exclude
 * @returns Result with passed=true if signal passes, or throws SignalFilteredError on rejection
 * @throws SignalFilteredError when signal is rejected by keyword rules
 */
export function applyGreenhouseGate(
  signal: GreenhouseGateSignal,
  greenhouse: GreenhouseGateRules
): GreenhouseGateResult {
  // Combine title and body into searchable text (case-insensitive)
  const searchableText = `${signal.title} ${signal.body}`.toLowerCase();

  // Check required keywords (if non-empty)
  if (greenhouse.keyword_require && greenhouse.keyword_require.length > 0) {
    const hasRequiredKeyword = greenhouse.keyword_require.some((keyword) =>
      searchableText.includes(keyword.toLowerCase())
    );

    if (!hasRequiredKeyword) {
      const reason = `Missing required keyword: ${greenhouse.keyword_require.join(' OR ')}`;
      const metadata: SignalMetadata = {
        source_type: signal.source_type,
        external_id: signal.external_id,
        greenhouse_id: signal.greenhouse_id,
      };

      throw new SignalFilteredError(0, reason, metadata);
    }
  }

  // Check excluded keywords
  if (greenhouse.keyword_exclude && greenhouse.keyword_exclude.length > 0) {
    for (const keyword of greenhouse.keyword_exclude) {
      if (searchableText.includes(keyword.toLowerCase())) {
        const reason = `Contains excluded keyword: ${keyword}`;
        const metadata: SignalMetadata = {
          source_type: signal.source_type,
          external_id: signal.external_id,
          greenhouse_id: signal.greenhouse_id,
        };

        throw new SignalFilteredError(0, reason, metadata);
      }
    }
  }

  // Signal passed all checks
  return { passed: true };
}
