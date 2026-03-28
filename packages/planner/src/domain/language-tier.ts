import { z } from 'zod';

// ============================================
// Language Tier
// ============================================

/**
 * Language tiers based on LLM training data distribution.
 * Research basis: MultiPL-E - Python 80% vs COBOL 12% = 68-point accuracy gap.
 *
 * Tier S (1.0x): Python, TypeScript, JavaScript, Java, C++ - Most training data
 * Tier A (1.4x): Go, Rust, C#, PHP, Ruby - Good representation
 * Tier B (2.0x): Swift, Kotlin, R, Lua, Haskell - Moderate representation
 * Tier C (3.2x): OCaml, Ada, Clojure - Limited representation
 * Tier D (5.0x): COBOL, Fortran, VHDL - Sparse training data
 */
export const LanguageTier = {
  S: 's',
  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
} as const;

export type LanguageTier = (typeof LanguageTier)[keyof typeof LanguageTier];

export const LanguageTierSchema = z.enum(['s', 'a', 'b', 'c', 'd']);

// ============================================
// Language to Tier Mapping
// ============================================

/**
 * Maps programming languages to their tiers.
 * Based on MultiPL-E research and LLM training data distribution.
 */
export const LANGUAGE_TO_TIER: Record<string, LanguageTier> = {
  // Tier S - Most training data
  python: 's',
  typescript: 's',
  javascript: 's',
  java: 's',
  'c++': 's',
  cpp: 's',

  // Tier A - Good representation
  go: 'a',
  golang: 'a',
  rust: 'a',
  'c#': 'a',
  csharp: 'a',
  php: 'a',
  ruby: 'a',
  c: 'a',

  // Tier B - Moderate representation
  swift: 'b',
  kotlin: 'b',
  r: 'b',
  lua: 'b',
  haskell: 'b',
  scala: 'b',
  elixir: 'b',
  erlang: 'b',
  dart: 'b',

  // Tier C - Limited representation
  ocaml: 'c',
  ada: 'c',
  clojure: 'c',
  fsharp: 'c',
  'f#': 'c',
  racket: 'c',
  scheme: 'c',
  prolog: 'c',

  // Tier D - Sparse training data
  cobol: 'd',
  fortran: 'd',
  vhdl: 'd',
  verilog: 'd',
  assembly: 'd',
  asm: 'd',
  pascal: 'd',
  delphi: 'd',
  pl1: 'd',
  'pl/1': 'd',
};

// ============================================
// File Extension to Tier Mapping
// ============================================

/**
 * Maps file extensions to their language tiers.
 * Used for detecting language from step scope or file mentions.
 */
export const FILE_EXTENSION_TO_TIER: Record<string, LanguageTier> = {
  // Tier S
  '.py': 's',
  '.ts': 's',
  '.tsx': 's',
  '.js': 's',
  '.jsx': 's',
  '.mjs': 's',
  '.cjs': 's',
  '.java': 's',
  '.cpp': 's',
  '.cc': 's',
  '.cxx': 's',
  '.hpp': 's',
  '.h': 's', // Could be C or C++, defaulting to S

  // Tier A
  '.go': 'a',
  '.rs': 'a',
  '.cs': 'a',
  '.php': 'a',
  '.rb': 'a',
  '.c': 'a',

  // Tier B
  '.swift': 'b',
  '.kt': 'b',
  '.kts': 'b',
  '.r': 'b',
  '.R': 'b',
  '.lua': 'b',
  '.hs': 'b',
  '.scala': 'b',
  '.sc': 'b',
  '.ex': 'b',
  '.exs': 'b',
  '.erl': 'b',
  '.dart': 'b',

  // Tier C
  '.ml': 'c',
  '.mli': 'c',
  '.adb': 'c',
  '.ads': 'c',
  '.clj': 'c',
  '.cljs': 'c',
  '.cljc': 'c',
  '.fs': 'c',
  '.fsx': 'c',
  '.rkt': 'c',
  '.scm': 'c',
  '.pl': 'c',

  // Tier D
  '.cob': 'd',
  '.cbl': 'd',
  '.f': 'd',
  '.f90': 'd',
  '.f95': 'd',
  '.for': 'd',
  '.vhd': 'd',
  '.vhdl': 'd',
  '.v': 'd',
  '.sv': 'd',
  '.asm': 'd',
  '.s': 'd',
  '.pas': 'd',
  '.dpr': 'd',
};

// ============================================
// Tier Multipliers
// ============================================

/**
 * Complexity multipliers for each tier.
 * Higher tier languages require more effort due to less training data.
 */
export const TIER_MULTIPLIERS: Record<LanguageTier, number> = {
  s: 1.0,
  a: 1.4,
  b: 2.0,
  c: 3.2,
  d: 5.0,
};

// ============================================
// Domain Adjustments
// ============================================

/**
 * Additional multipliers for domain-specific complexity.
 * Applied on top of language tier multiplier.
 */
export const DOMAIN_ADJUSTMENTS: Record<string, number> = {
  /** Mobile development (iOS/Android specific APIs) */
  mobile: 0.25,
  /** Embedded systems (hardware constraints, real-time) */
  embedded: 1.0,
  /** Blockchain/Web3 (security-critical, domain-specific) */
  blockchain: 0.5,
  /** Game development (performance-critical, engine-specific) */
  game: 0.3,
  /** Scientific computing (numerical precision, algorithms) */
  scientific: 0.4,
  /** DevOps/Infrastructure (tooling-specific) */
  devops: 0.2,
  /** Machine learning (framework-specific, math-heavy) */
  ml: 0.3,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Gets the complexity multiplier for a language tier.
 */
export function getTierMultiplier(tier: LanguageTier): number {
  return TIER_MULTIPLIERS[tier];
}

/**
 * Gets the tier for a language name (case-insensitive).
 * Returns 'a' as default for unknown languages (conservative estimate).
 */
export function getLanguageTier(language: string): LanguageTier {
  return LANGUAGE_TO_TIER[language.toLowerCase()] ?? 'a';
}

/**
 * Gets the tier for a file extension.
 * Returns 'a' as default for unknown extensions (conservative estimate).
 */
export function getExtensionTier(extension: string): LanguageTier {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return FILE_EXTENSION_TO_TIER[ext.toLowerCase()] ?? 'a';
}

/**
 * Gets the domain adjustment multiplier.
 * Returns 0 if domain is not recognized.
 */
export function getDomainAdjustment(domain: string): number {
  return DOMAIN_ADJUSTMENTS[domain.toLowerCase()] ?? 0;
}

/**
 * Calculates the effective multiplier combining tier and domain.
 */
export function getEffectiveMultiplier(tier: LanguageTier, domain?: string): number {
  const tierMultiplier = getTierMultiplier(tier);
  const domainAdjustment = domain ? getDomainAdjustment(domain) : 0;
  return tierMultiplier + domainAdjustment;
}
