/**
 * Category extraction utilities for specialist observations
 *
 * Provides functions to parse and extract domain categories from specialist
 * observation data, filtering out reserved metadata keys and extracting
 * category-specific details like confidence levels and item counts.
 */

/**
 * Reserved keys that are not domain categories
 * These are metadata fields used for overall specialist state
 */
export const RESERVED_KEYS = [
  'confidence',
  'confidence_level',
  'keywords',
  'concerns',
  'questions',
  'observations',
  'recommendations',
  'confidence_reasoning',
] as const;

/**
 * Threshold for identifying low-confidence categories
 */
export const LOW_CONFIDENCE_THRESHOLD = 50;

/**
 * Extract domain category names from specialist observations
 *
 * @param observations - The specialist's observation data
 * @returns Array of category names (excluding reserved keys)
 *
 * @example
 * ```ts
 * const obs = {
 *   confidence_level: "75%",
 *   system_design: { ... },
 *   scalability: { ... }
 * };
 * extractCategoryNames(obs); // ["system_design", "scalability"]
 * ```
 */
export function extractCategoryNames(
  observations: Record<string, unknown>
): string[] {
  return Object.keys(observations).filter((key) => {
    // Exclude reserved keys
    if (RESERVED_KEYS.includes(key as any)) {
      return false;
    }

    // Only include keys where value is an object (not arrays or primitives)
    const value = observations[key];
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    );
  });
}

/**
 * Parse confidence value from various formats
 *
 * @param value - The confidence value (string like "75%" or number)
 * @returns Numeric confidence value (0-100)
 */
function parseConfidence(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Remove % symbol and parse
    const numStr = value.replace('%', '').trim();
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  }

  return 0;
}

/**
 * Category item - a key-value pair within a category
 */
export interface CategoryItem {
  key: string;
  value: string;
}

/**
 * Category detail information
 */
export interface CategoryDetail {
  name: string;
  confidence: number;
  itemCount: number;
  hasRecommendations: boolean;
  items: CategoryItem[];
}

/**
 * Extract detailed information for each category
 *
 * @param observations - The specialist's observation data
 * @returns Array of category details with confidence, item counts, etc.
 *
 * @example
 * ```ts
 * const obs = {
 *   system_design: {
 *     mcp_tool_integration: "...",
 *     confidence: "88%"
 *   },
 *   scalability: {
 *     specialist_spawning: "...",
 *     confidence: "79%"
 *   }
 * };
 * extractCategoryDetails(obs);
 * // [
 * //   { name: "system_design", confidence: 88, itemCount: 2, hasRecommendations: false },
 * //   { name: "scalability", confidence: 79, itemCount: 2, hasRecommendations: false }
 * // ]
 * ```
 */
export function extractCategoryDetails(
  observations: Record<string, unknown>
): CategoryDetail[] {
  const categoryNames = extractCategoryNames(observations);

  return categoryNames.map((name) => {
    const categoryData = observations[name] as Record<string, unknown>;

    // Extract confidence from category.confidence if present
    const confidence = parseConfidence(categoryData.confidence);

    // Extract items: key-value pairs excluding meta fields
    const items: CategoryItem[] = [];
    const metaFields = new Set(['confidence', 'recommendations', 'confidence_level']);

    for (const [key, value] of Object.entries(categoryData)) {
      if (metaFields.has(key)) continue;

      // Convert value to string for display
      let stringValue: string;
      if (typeof value === 'string') {
        stringValue = value;
      } else if (typeof value === 'object' && value !== null) {
        stringValue = JSON.stringify(value, null, 2);
      } else {
        stringValue = String(value);
      }

      items.push({ key, value: stringValue });
    }

    // Count items (excluding meta fields)
    const itemCount = items.length;

    // Check if category has recommendations array
    const hasRecommendations =
      'recommendations' in categoryData &&
      Array.isArray(categoryData.recommendations) &&
      categoryData.recommendations.length > 0;

    return {
      name,
      confidence,
      itemCount,
      hasRecommendations,
      items,
    };
  });
}

/**
 * Extract all recommendations from specialist observations
 *
 * @param observations - The specialist's observation data
 * @returns Flattened array of recommendation strings
 *
 * @example
 * ```ts
 * const obs = {
 *   recommendations: ["item1", "item2"],
 *   security: {
 *     recommendations: ["item3"]
 *   }
 * };
 * extractRecommendations(obs); // ["item1", "item2", "item3"]
 * ```
 */
export function extractRecommendations(
  observations: Record<string, unknown>
): string[] {
  const recommendations: string[] = [];

  // Check top-level recommendations
  if (
    'recommendations' in observations &&
    Array.isArray(observations.recommendations)
  ) {
    recommendations.push(
      ...observations.recommendations.filter(
        (item): item is string => typeof item === 'string'
      )
    );
  }

  // Check each category for recommendations
  const categoryNames = extractCategoryNames(observations);
  for (const categoryName of categoryNames) {
    const categoryData = observations[categoryName] as Record<string, unknown>;
    if (
      'recommendations' in categoryData &&
      Array.isArray(categoryData.recommendations)
    ) {
      recommendations.push(
        ...categoryData.recommendations.filter(
          (item): item is string => typeof item === 'string'
        )
      );
    }
  }

  return recommendations;
}

/**
 * Identify categories with low confidence levels
 *
 * @param observations - The specialist's observation data
 * @returns Array of category names with confidence < LOW_CONFIDENCE_THRESHOLD
 *
 * @example
 * ```ts
 * const obs = {
 *   system_design: { confidence: "88%" },
 *   threat_modeling: { confidence: "40%" }
 * };
 * identifyLowConfidenceCategories(obs); // ["threat_modeling"]
 * ```
 */
export function identifyLowConfidenceCategories(
  observations: Record<string, unknown>
): string[] {
  const details = extractCategoryDetails(observations);
  return details
    .filter((detail) => detail.confidence < LOW_CONFIDENCE_THRESHOLD)
    .map((detail) => detail.name);
}

/**
 * Format category key to human-readable name
 *
 * @param key - The category key (e.g., "system_design")
 * @returns Formatted name (e.g., "System Design")
 *
 * @example
 * ```ts
 * formatCategoryName("system_design"); // "System Design"
 * formatCategoryName("threat_modeling"); // "Threat Modeling"
 * ```
 */
export function formatCategoryName(key: string | undefined | null): string {
  if (!key) return '';
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
