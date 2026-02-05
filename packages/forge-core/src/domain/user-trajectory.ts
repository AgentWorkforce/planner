import { z } from 'zod';

// ============================================
// Scope Types
// ============================================

/**
 * Scope levels for user trajectory events and preferences:
 * - global: applies across all projects and runs
 * - project: applies to a specific project
 * - run: applies to a specific run only
 */
export const UserTrajectoryScope = {
  Global: 'global',
  Project: 'project',
  Run: 'run',
} as const;

export type UserTrajectoryScope =
  (typeof UserTrajectoryScope)[keyof typeof UserTrajectoryScope];

export const UserTrajectoryScopeSchema = z.enum(['global', 'project', 'run']);

// ============================================
// User Trajectory Event
// ============================================

/**
 * UserTrajectoryEvent captures a user's decision when answering a question.
 * These events are used to derive preferences for auto-answering similar questions.
 */
export const UserTrajectoryEventSchema = z.object({
  /** Unique identifier for this event */
  event_id: z.string().uuid(),
  /** User who made the decision */
  user_id: z.string().min(1),
  /** Scope of this event (global, project, or run) */
  scope: UserTrajectoryScopeSchema,
  /** The question text that was asked */
  question_text: z.string().min(1),
  /** The option/answer the user selected */
  selected_option: z.string().min(1),
  /** Optional reasoning provided by the user */
  reasoning: z.string().optional(),
  /** Run ID if scope is 'run' or 'project' */
  run_id: z.string().uuid().optional(),
  /** Task ID if the question was task-specific */
  task_id: z.string().uuid().optional(),
  /** Project ID if scope is 'project' */
  project_id: z.string().optional(),
  /** Category derived from question context */
  category: z.string().optional(),
  /** Timestamp when the decision was made */
  timestamp: z.string().datetime(),
});

export type UserTrajectoryEvent = z.infer<typeof UserTrajectoryEventSchema>;

// ============================================
// Derived Preference
// ============================================

/**
 * DerivedPreference represents a preference derived from user trajectory events.
 * Preferences are used to auto-answer similar questions based on past behavior.
 */
export const DerivedPreferenceSchema = z.object({
  /** Unique identifier for this preference */
  preference_id: z.string().uuid(),
  /** User who expressed this preference */
  user_id: z.string().min(1),
  /** Scope of this preference (global, project, or run) */
  scope: UserTrajectoryScopeSchema,
  /** Project ID if scope is 'project' */
  project_id: z.string().optional(),
  /** Run ID if scope is 'run' */
  run_id: z.string().optional(),
  /** Category of the preference (e.g., 'testing_strategy', 'error_handling') */
  category: z.string().min(1),
  /** The preferred value/option */
  value: z.string().min(1),
  /**
   * Confidence score (0-1) based on evidence count.
   * Formula: min(0.95, 0.5 + 0.15 * evidence_count)
   */
  confidence: z.number().min(0).max(1),
  /** Number of events supporting this preference */
  evidence_count: z.number().int().min(0),
  /** Timestamp when this preference was last expressed */
  last_expressed: z.string().datetime(),
  /** Whether this preference was manually overridden by the user */
  is_override: z.boolean().default(false),
  /** Timestamp when this preference was created */
  created_at: z.string().datetime(),
  /** Timestamp when this preference was last updated */
  updated_at: z.string().datetime(),
});

export type DerivedPreference = z.infer<typeof DerivedPreferenceSchema>;

// ============================================
// Similar Question Result
// ============================================

/**
 * SimilarQuestionResult represents a past answer that matches a new question.
 */
export const SimilarQuestionResultSchema = z.object({
  /** The matching trajectory event */
  event: UserTrajectoryEventSchema,
  /** Similarity score (0-1) */
  similarity: z.number().min(0).max(1),
});

export type SimilarQuestionResult = z.infer<typeof SimilarQuestionResultSchema>;

// ============================================
// Factory Functions
// ============================================

/**
 * Calculates confidence score based on evidence count.
 * Formula: min(0.95, 0.5 + 0.15 * evidence_count)
 * - 0 events: 0.5 (no confidence from evidence)
 * - 1 event: 0.65
 * - 2 events: 0.80
 * - 3+ events: 0.95 (capped)
 */
export function calculateConfidence(evidenceCount: number): number {
  return Math.min(0.95, 0.5 + 0.15 * evidenceCount);
}

/**
 * Creates a new UserTrajectoryEvent
 */
export interface CreateUserTrajectoryEventOptions {
  userId: string;
  scope: UserTrajectoryScope;
  questionText: string;
  selectedOption: string;
  reasoning?: string;
  runId?: string;
  taskId?: string;
  projectId?: string;
  category?: string;
}

export function createUserTrajectoryEvent(
  options: CreateUserTrajectoryEventOptions
): UserTrajectoryEvent {
  const now = new Date().toISOString();
  const event: UserTrajectoryEvent = {
    event_id: crypto.randomUUID(),
    user_id: options.userId,
    scope: options.scope,
    question_text: options.questionText,
    selected_option: options.selectedOption,
    reasoning: options.reasoning,
    run_id: options.runId,
    task_id: options.taskId,
    project_id: options.projectId,
    category: options.category,
    timestamp: now,
  };
  return UserTrajectoryEventSchema.parse(event);
}

/**
 * Creates a new DerivedPreference
 */
export interface CreateDerivedPreferenceOptions {
  userId: string;
  scope: UserTrajectoryScope;
  category: string;
  value: string;
  evidenceCount?: number;
  projectId?: string;
  runId?: string;
  isOverride?: boolean;
}

export function createDerivedPreference(
  options: CreateDerivedPreferenceOptions
): DerivedPreference {
  const now = new Date().toISOString();
  const evidenceCount = options.evidenceCount ?? 1;
  const preference: DerivedPreference = {
    preference_id: crypto.randomUUID(),
    user_id: options.userId,
    scope: options.scope,
    project_id: options.projectId,
    run_id: options.runId,
    category: options.category,
    value: options.value,
    confidence: calculateConfidence(evidenceCount),
    evidence_count: evidenceCount,
    last_expressed: now,
    is_override: options.isOverride ?? false,
    created_at: now,
    updated_at: now,
  };
  return DerivedPreferenceSchema.parse(preference);
}

/**
 * Updates a preference with new evidence
 */
export function updatePreferenceWithEvidence(
  preference: DerivedPreference,
  newValue: string
): DerivedPreference {
  const now = new Date().toISOString();
  const newEvidenceCount = preference.evidence_count + 1;
  return {
    ...preference,
    value: newValue,
    evidence_count: newEvidenceCount,
    confidence: calculateConfidence(newEvidenceCount),
    last_expressed: now,
    updated_at: now,
    is_override: false, // New evidence overrides any manual override
  };
}

/**
 * Overrides a preference with user-specified value.
 * Resets evidence_count to 1 as per spec.
 */
export function overridePreference(
  preference: DerivedPreference,
  newValue: string
): DerivedPreference {
  const now = new Date().toISOString();
  return {
    ...preference,
    value: newValue,
    evidence_count: 1,
    confidence: calculateConfidence(1),
    last_expressed: now,
    updated_at: now,
    is_override: true,
  };
}

// ============================================
// Similarity Helpers
// ============================================

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Create matrix with proper initialization
  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i]![0] = i;
  }
  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const currentRow = matrix[i]!;
      const prevRow = matrix[i - 1]!;
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currentRow[j] = prevRow[j - 1]!;
      } else {
        currentRow[j] = Math.min(
          prevRow[j - 1]! + 1, // substitution
          currentRow[j - 1]! + 1, // insertion
          prevRow[j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculates text similarity using normalized Levenshtein distance.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const normalizedText1 = text1.toLowerCase().trim();
  const normalizedText2 = text2.toLowerCase().trim();

  if (normalizedText1 === normalizedText2) {
    return 1;
  }

  const maxLength = Math.max(normalizedText1.length, normalizedText2.length);
  if (maxLength === 0) {
    return 1;
  }

  const distance = levenshteinDistance(normalizedText1, normalizedText2);
  return 1 - distance / maxLength;
}

/**
 * Extracts trigrams from a string for similarity comparison.
 */
export function extractTrigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().trim();
  const trigrams = new Set<string>();

  if (normalized.length < 3) {
    trigrams.add(normalized);
    return trigrams;
  }

  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }

  return trigrams;
}

/**
 * Calculates Jaccard similarity between two sets of trigrams.
 */
export function trigramSimilarity(text1: string, text2: string): number {
  const trigrams1 = extractTrigrams(text1);
  const trigrams2 = extractTrigrams(text2);

  if (trigrams1.size === 0 && trigrams2.size === 0) {
    return 1;
  }

  const intersection = new Set([...trigrams1].filter((t) => trigrams2.has(t)));
  const union = new Set([...trigrams1, ...trigrams2]);

  return intersection.size / union.size;
}

/**
 * Combined similarity score using both Levenshtein and trigram methods.
 * Weights: 60% trigram, 40% Levenshtein (trigrams better for semantic similarity).
 */
export function combinedTextSimilarity(text1: string, text2: string): number {
  const levenshteinSim = calculateTextSimilarity(text1, text2);
  const trigramSim = trigramSimilarity(text1, text2);
  return 0.6 * trigramSim + 0.4 * levenshteinSim;
}

// ============================================
// Confidence Threshold Constants
// ============================================

/**
 * Minimum confidence threshold for returning a preference.
 * Preferences below this threshold are not considered reliable enough for auto-answering.
 */
export const PREFERENCE_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Minimum similarity threshold for finding similar questions.
 * Questions below this threshold are not considered similar enough.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/**
 * Minimum number of similar decisions needed to derive a preference.
 */
export const MIN_EVIDENCE_FOR_PREFERENCE = 3;
