/**
 * ModelSelector — Pattern-based model routing for forge-next.
 *
 * Selects the appropriate Claude model tier (haiku, sonnet, opus) based on
 * step characteristics. Intentionally simple: keyword matching only, no
 * persistence, no learning, no Tuner integration (that belongs in forge-core).
 *
 * Research basis: SWE-bench — Opus 80.9%, Sonnet 64.8%, Haiku 60.6%.
 * Cost hierarchy: Haiku ~3.7x cheaper than Sonnet, Opus ~4x more expensive.
 */

// ============================================
// Types
// ============================================

export type ModelType = 'haiku' | 'sonnet' | 'opus';

export interface ModelSelectionResult {
  model: ModelType;
  reason: string;
}

/** Minimal step shape the selector needs. */
export interface StepForSelection {
  title: string;
  description?: string;
  scope?: string;
  owner_role?: string;
}

// ============================================
// Keyword Sets
// ============================================

/** Keywords that signal architecture/critical work warranting Opus. */
const OPUS_KEYWORDS = [
  'architect',
  'architecture',
  'design',
  'security',
  'infrastructure',
  'database schema',
  'schema migration',
  'system design',
  'api contract',
  'data model',
  'auth',
  'authentication',
  'authorization',
  'cryptograph',
] as const;

/** Keywords that signal trivial/routine work warranting Haiku. */
const HAIKU_KEYWORDS = [
  'format',
  'lint',
  'rename',
  'typo',
  'config',
  'update dependency',
  'bump version',
  'changelog',
  'comment',
  'docstring',
  'readme',
  'whitespace',
  'import order',
] as const;

// ============================================
// ModelSelector
// ============================================

/**
 * Selects a model tier based on step characteristics.
 *
 * Priority order:
 * 1. Architecture/critical/security → opus (high stakes, worth the cost)
 * 2. Trivial/routine → haiku (save money on low-complexity work)
 * 3. Everything else → sonnet (balanced default)
 */
export class ModelSelector {
  /**
   * Selects the appropriate model for a step.
   *
   * @param step - Step characteristics used for classification
   * @returns Selected model with the reason for selection
   */
  selectModel(step: StepForSelection): ModelSelectionResult {
    const searchText = buildSearchText(step);

    if (matchesAny(searchText, OPUS_KEYWORDS)) {
      return { model: 'opus', reason: 'Architecture or security-critical step detected' };
    }

    if (matchesAny(searchText, HAIKU_KEYWORDS)) {
      return { model: 'haiku', reason: 'Trivial or routine step detected' };
    }

    return { model: 'sonnet', reason: 'Standard implementation step' };
  }

  /**
   * Cost multiplier relative to Sonnet baseline.
   * Useful for budget estimation before dispatching runs.
   */
  static getCostMultiplier(model: ModelType): number {
    switch (model) {
      case 'haiku':
        return 0.27; // ~3.7x cheaper than sonnet
      case 'sonnet':
        return 1.0; // baseline
      case 'opus':
        return 4.0; // ~4x more expensive
    }
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Concatenates all searchable text fields from a step into a single lowercase
 * string for keyword matching.
 */
function buildSearchText(step: StepForSelection): string {
  return [step.title, step.description, step.scope, step.owner_role]
    .filter((s): s is string => s != null)
    .join(' ')
    .toLowerCase();
}

/**
 * Returns true if the text contains at least one keyword from the list.
 */
function matchesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}
