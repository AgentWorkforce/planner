import type { Step } from '../domain/step.js';
import {
  LanguageTier,
  LANGUAGE_TO_TIER,
  FILE_EXTENSION_TO_TIER,
  TIER_MULTIPLIERS,
  DOMAIN_ADJUSTMENTS,
  getTierMultiplier,
} from '../domain/language-tier.js';

// ============================================
// File Extension Detection
// ============================================

/**
 * Regex to extract file extensions from text.
 * Matches patterns like: .ts, .py, .java, path/to/file.tsx, etc.
 */
const FILE_EXTENSION_REGEX = /\.[a-zA-Z]{1,6}\b/g;

/**
 * Extracts file extensions from text.
 * Returns unique extensions found.
 */
export function extractFileExtensions(text: string): string[] {
  if (!text) return [];

  const matches = text.match(FILE_EXTENSION_REGEX);
  if (!matches) return [];

  // Normalize and dedupe
  const extensions = new Set(matches.map((ext) => ext.toLowerCase()));
  return Array.from(extensions);
}

// ============================================
// Language Keyword Detection
// ============================================

/**
 * Language name patterns to detect in text.
 * Maps regex patterns to tier.
 */
const LANGUAGE_PATTERNS: Array<[RegExp, LanguageTier]> = [
  // Tier S
  [/\b(python|py)\b/i, 's'],
  [/\b(typescript|ts)\b/i, 's'],
  [/\b(javascript|js|node\.?js)\b/i, 's'],
  [/\bjava\b/i, 's'],
  [/\b(c\+\+|cpp)\b/i, 's'],

  // Tier A
  [/\b(golang|go)\b/i, 'a'],
  [/\brust\b/i, 'a'],
  [/\b(c#|csharp)\b/i, 'a'],
  [/\bphp\b/i, 'a'],
  [/\bruby\b/i, 'a'],
  [/\bc\b/i, 'a'], // Plain C (be careful with false positives)

  // Tier B
  [/\bswift\b/i, 'b'],
  [/\bkotlin\b/i, 'b'],
  [/\b(r|r-lang)\b/i, 'b'],
  [/\blua\b/i, 'b'],
  [/\bhaskell\b/i, 'b'],
  [/\bscala\b/i, 'b'],
  [/\belixir\b/i, 'b'],
  [/\berlang\b/i, 'b'],
  [/\bdart\b/i, 'b'],

  // Tier C
  [/\bocaml\b/i, 'c'],
  [/\bada\b/i, 'c'],
  [/\bclojure\b/i, 'c'],
  [/\b(f#|fsharp)\b/i, 'c'],
  [/\bracket\b/i, 'c'],
  [/\bscheme\b/i, 'c'],
  [/\bprolog\b/i, 'c'],

  // Tier D
  [/\bcobol\b/i, 'd'],
  [/\bfortran\b/i, 'd'],
  [/\bvhdl\b/i, 'd'],
  [/\bverilog\b/i, 'd'],
  [/\bassembly\b/i, 'd'],
  [/\basm\b/i, 'd'],
  [/\bpascal\b/i, 'd'],
  [/\bdelphi\b/i, 'd'],
];

/**
 * Extracts language keywords from text.
 * Returns array of [language, tier] pairs found.
 */
export function extractLanguageKeywords(text: string): Array<[string, LanguageTier]> {
  if (!text) return [];

  const found: Array<[string, LanguageTier]> = [];

  for (const [pattern, tier] of LANGUAGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      found.push([match[0].toLowerCase(), tier]);
    }
  }

  return found;
}

// ============================================
// Domain Detection
// ============================================

/**
 * Domain indicators and their patterns.
 */
const DOMAIN_PATTERNS: Array<[RegExp, string]> = [
  [/\b(ios|android|mobile|react.?native|flutter)\b/i, 'mobile'],
  [/\b(embedded|microcontroller|mcu|rtos|firmware)\b/i, 'embedded'],
  [/\b(blockchain|smart.?contract|web3|solidity|ethereum)\b/i, 'blockchain'],
  [/\b(game|unity|unreal|gamedev)\b/i, 'game'],
  [/\b(ml|machine.?learning|tensorflow|pytorch|neural)\b/i, 'ml'],
  [/\b(scientific|numpy|scipy|matlab|simulation)\b/i, 'scientific'],
  [/\b(devops|kubernetes|k8s|docker|terraform|ci.?cd)\b/i, 'devops'],
];

/**
 * Detects domain from text.
 * Returns array of detected domains.
 */
export function detectDomains(text: string): string[] {
  if (!text) return [];

  const found: string[] = [];

  for (const [pattern, domain] of DOMAIN_PATTERNS) {
    if (pattern.test(text)) {
      found.push(domain);
    }
  }

  return [...new Set(found)]; // Dedupe
}

/**
 * Gets the domain adjustment multiplier.
 * Returns 0 if no domain detected.
 */
export function detectDomainAdjustment(step: Step): number {
  const text = [step.scope, step.description, step.title].filter(Boolean).join(' ');
  const domains = detectDomains(text);

  if (domains.length === 0) return 0;

  // Use highest adjustment (most impactful domain)
  let maxAdjustment = 0;
  for (const domain of domains) {
    const adjustment = DOMAIN_ADJUSTMENTS[domain] ?? 0;
    maxAdjustment = Math.max(maxAdjustment, adjustment);
  }

  return maxAdjustment;
}

// ============================================
// Main Detection Function
// ============================================

export interface LanguageDetectionResult {
  tier: LanguageTier;
  confidence: 'high' | 'medium' | 'low';
  detectedFrom: 'extension' | 'keyword' | 'default';
  extensions: string[];
  languages: string[];
  domains: string[];
  domainAdjustment: number;
}

/**
 * Detects the programming language tier from a step.
 *
 * Detection priority:
 * 1. File extensions in scope/description (most specific)
 * 2. Language keywords in description
 * 3. Default to tier 'a' (conservative estimate)
 *
 * Returns the tier with lowest multiplier if multiple languages detected
 * (most optimistic scenario).
 */
export function detectLanguageTier(step: Step): LanguageTier {
  const result = analyzeLanguage(step);
  return result.tier;
}

/**
 * Full language analysis with detailed results.
 */
export function analyzeLanguage(step: Step): LanguageDetectionResult {
  const text = [step.scope, step.description, step.title].filter(Boolean).join(' ');

  // Extract signals
  const extensions = extractFileExtensions(text);
  const languageKeywords = extractLanguageKeywords(text);
  const domains = detectDomains(text);
  const domainAdjustment = detectDomainAdjustment(step);

  // Try extension-based detection first
  const extensionTiers: LanguageTier[] = [];
  for (const ext of extensions) {
    const tier = FILE_EXTENSION_TO_TIER[ext];
    if (tier) {
      extensionTiers.push(tier);
    }
  }

  // If extensions found, use the most optimistic (lowest multiplier)
  if (extensionTiers.length > 0) {
    const tier = getMostOptimisticTier(extensionTiers);
    return {
      tier,
      confidence: 'high',
      detectedFrom: 'extension',
      extensions,
      languages: languageKeywords.map(([lang]) => lang),
      domains,
      domainAdjustment,
    };
  }

  // Try keyword-based detection
  if (languageKeywords.length > 0) {
    const keywordTiers = languageKeywords.map(([, tier]) => tier);
    const tier = getMostOptimisticTier(keywordTiers);
    return {
      tier,
      confidence: 'medium',
      detectedFrom: 'keyword',
      extensions,
      languages: languageKeywords.map(([lang]) => lang),
      domains,
      domainAdjustment,
    };
  }

  // Default to tier 'a' (conservative but not worst-case)
  return {
    tier: 'a',
    confidence: 'low',
    detectedFrom: 'default',
    extensions,
    languages: [],
    domains,
    domainAdjustment,
  };
}

/**
 * Gets the most optimistic tier (lowest multiplier).
 */
function getMostOptimisticTier(tiers: LanguageTier[]): LanguageTier {
  if (tiers.length === 0) return 'a';

  let bestTier = tiers[0];
  let bestMultiplier = TIER_MULTIPLIERS[bestTier];

  for (const tier of tiers) {
    const multiplier = TIER_MULTIPLIERS[tier];
    if (multiplier < bestMultiplier) {
      bestTier = tier;
      bestMultiplier = multiplier;
    }
  }

  return bestTier;
}

// ============================================
// Effective Multiplier
// ============================================

/**
 * Calculates the effective complexity multiplier for a step.
 * Combines language tier multiplier with domain adjustment.
 */
export function getEffectiveMultiplier(step: Step): number {
  const tier = step.language_tier ?? detectLanguageTier(step);
  const tierMultiplier = getTierMultiplier(tier);
  const domainAdjustment = detectDomainAdjustment(step);

  return tierMultiplier + domainAdjustment;
}

// ============================================
// Batch Processing
// ============================================

/**
 * Enriches steps with language tier (mutates steps).
 * Only adds tier if step doesn't already have one (respects manual overrides).
 */
export function enrichStepsWithLanguageTier(steps: Step[]): Step[] {
  return steps.map((step) => {
    if (step.language_tier) {
      // Already has tier, skip (manual override)
      return step;
    }

    return {
      ...step,
      language_tier: detectLanguageTier(step),
    };
  });
}

/**
 * Analyzes language tiers for multiple steps.
 */
export function analyzeLanguageBatch(steps: Step[]): Map<string, LanguageDetectionResult> {
  const results = new Map<string, LanguageDetectionResult>();

  for (const step of steps) {
    results.set(step.step_id, analyzeLanguage(step));
  }

  return results;
}
