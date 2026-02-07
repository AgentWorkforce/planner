export type ConfidenceLevel = 'exploring' | 'forming' | 'confident';

// Reserved keys that have special meaning (flat format)
export const RESERVED_KEYS = new Set([
  'confidence',
  'keywords',
  'concerns',
  'questions',
  'observations',
]);

export function extractConfidenceLevel(
  observations: Record<string, unknown>
): ConfidenceLevel {
  const confidence = observations.confidence;
  if (typeof confidence === 'string') {
    if (confidence === 'confident' || confidence === 'forming' || confidence === 'exploring') {
      return confidence;
    }
  }
  if (typeof confidence === 'number') {
    if (confidence >= 70) return 'confident';
    if (confidence >= 40) return 'forming';
  }
  return 'exploring';
}

export function extractKeywords(observations: Record<string, unknown>): string[] {
  const keywords = observations.keywords;
  if (Array.isArray(keywords)) {
    return keywords
      .filter((k): k is string => typeof k === 'string')
      .slice(0, 5);
  }
  return [];
}

export function extractConcerns(observations: Record<string, unknown>): number {
  const concerns = observations.concerns;
  if (Array.isArray(concerns)) {
    return concerns.length;
  }
  if (typeof concerns === 'number') {
    return concerns;
  }
  return 0;
}

export function extractQuestions(observations: Record<string, unknown>): number {
  const questions = observations.questions;
  if (Array.isArray(questions)) {
    return questions.length;
  }
  if (typeof questions === 'number') {
    return questions;
  }
  return 0;
}

export function extractObservationsList(observations: Record<string, unknown>): string[] {
  const obs = observations.observations;
  if (Array.isArray(obs)) {
    return obs.filter((o): o is string => typeof o === 'string');
  }
  return [];
}

export function extractQuestionsList(observations: Record<string, unknown>): string[] {
  const questions = observations.questions;
  if (Array.isArray(questions)) {
    return questions.filter((q): q is string => typeof q === 'string');
  }
  return [];
}

export function extractConcernsList(observations: Record<string, unknown>): string[] {
  const concerns = observations.concerns;
  if (Array.isArray(concerns)) {
    return concerns.filter((c): c is string => typeof c === 'string');
  }
  return [];
}

/**
 * Check if the observations contain nested domain data (not flat format).
 * Nested format has object values for non-reserved keys.
 */
export function hasNestedDomainData(observations: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(observations)) {
    if (!RESERVED_KEYS.has(key) && typeof value === 'object' && value !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Extract domain categories from nested observations.
 * Returns array of { category, items } where items are key-value pairs.
 */
export function extractDomainCategories(
  observations: Record<string, unknown>
): Array<{ category: string; items: Array<{ key: string; value: string }> }> {
  const categories: Array<{ category: string; items: Array<{ key: string; value: string }> }> = [];

  for (const [key, value] of Object.entries(observations)) {
    if (RESERVED_KEYS.has(key)) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object - extract as category with items
      const items: Array<{ key: string; value: string }> = [];
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === 'string') {
          items.push({ key: subKey, value: subValue });
        } else if (typeof subValue === 'object' && subValue !== null) {
          // Deeper nesting - flatten to string
          items.push({ key: subKey, value: JSON.stringify(subValue) });
        }
      }
      if (items.length > 0) {
        categories.push({ category: key, items });
      }
    } else if (typeof value === 'string') {
      // Simple key-value at top level (like random_keyword)
      categories.push({
        category: 'notes',
        items: [{ key, value }],
      });
    }
  }

  // Merge all top-level string values into a single "notes" category
  const notesCategory = categories.find(c => c.category === 'notes');
  if (notesCategory) {
    const otherNotes = categories.filter(c => c.category === 'notes' && c !== notesCategory);
    for (const other of otherNotes) {
      notesCategory.items.push(...other.items);
    }
    return categories.filter(c => c.category !== 'notes' || c === notesCategory);
  }

  return categories;
}

/**
 * Format a snake_case key to Title Case for display.
 */
export function formatKey(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
