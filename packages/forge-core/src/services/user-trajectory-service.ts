import type { ForgeStorage } from '../storage/interface.js';
import type {
  UserTrajectoryEvent,
  UserTrajectoryScope,
  DerivedPreference,
  SimilarQuestionResult,
  CreateUserTrajectoryEventOptions,
} from '../domain/user-trajectory.js';
import {
  createUserTrajectoryEvent,
  createDerivedPreference,
  updatePreferenceWithEvidence,
  overridePreference,
  combinedTextSimilarity,
  calculateConfidence,
  PREFERENCE_CONFIDENCE_THRESHOLD,
  DEFAULT_SIMILARITY_THRESHOLD,
  MIN_EVIDENCE_FOR_PREFERENCE,
} from '../domain/user-trajectory.js';

/**
 * Options for recording a user decision
 */
export interface RecordDecisionOptions {
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

/**
 * Options for getting a preference with scope priority
 */
export interface GetPreferenceOptions {
  userId: string;
  category: string;
  runId?: string;
  projectId?: string;
  /** Minimum confidence threshold (default: 0.7) */
  confidenceThreshold?: number;
}

/**
 * Options for finding similar questions
 */
export interface FindSimilarOptions {
  userId: string;
  questionText: string;
  scope?: UserTrajectoryScope;
  /** Minimum similarity threshold (default: 0.85) */
  threshold?: number;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Options for overriding a preference
 */
export interface OverridePreferenceOptions {
  userId: string;
  scope: UserTrajectoryScope;
  category: string;
  value: string;
  projectId?: string;
  runId?: string;
  /** Optional reasoning for the override */
  reasoning?: string;
}

/**
 * UserTrajectoryService handles recording user decisions,
 * deriving preferences from patterns, and enabling auto-answering
 * similar questions based on past behavior.
 */
export class UserTrajectoryService {
  constructor(private storage: ForgeStorage) {}

  // ============================================
  // Event Recording (fut-s3)
  // ============================================

  /**
   * Records a user's decision when answering a question.
   * Triggers preference derivation after recording.
   */
  recordUserDecision(options: RecordDecisionOptions): UserTrajectoryEvent {
    // Create the trajectory event
    const eventOptions: CreateUserTrajectoryEventOptions = {
      userId: options.userId,
      scope: options.scope,
      questionText: options.questionText,
      selectedOption: options.selectedOption,
      reasoning: options.reasoning,
      runId: options.runId,
      taskId: options.taskId,
      projectId: options.projectId,
      category: options.category,
    };

    const event = createUserTrajectoryEvent(eventOptions);

    // Store the event
    this.storage.createUserTrajectoryEvent(event);

    // Trigger preference derivation if we have a category
    if (options.category) {
      this.derivePreferenceFromDecision(
        options.userId,
        options.scope,
        options.category,
        options.selectedOption,
        options.projectId,
        options.runId
      );
    }

    return event;
  }

  // ============================================
  // Preference Derivation (fut-s4)
  // ============================================

  /**
   * Analyzes decisions for patterns and derives preferences.
   * A preference is derived when 3+ similar decisions are made.
   */
  private derivePreferenceFromDecision(
    userId: string,
    scope: UserTrajectoryScope,
    category: string,
    selectedOption: string,
    projectId?: string,
    runId?: string
  ): void {
    // Get all events in this category for this user/scope
    const events = this.storage.getUserTrajectoryEventsByCategory(userId, category, scope);

    // Count occurrences of each option
    const optionCounts = new Map<string, number>();
    for (const event of events) {
      const count = optionCounts.get(event.selected_option) || 0;
      optionCounts.set(event.selected_option, count + 1);
    }

    // Find the most common option
    let maxCount = 0;
    let mostCommonOption = selectedOption;
    for (const [option, count] of optionCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonOption = option;
      }
    }

    // Only derive a preference if we have enough evidence
    if (maxCount < MIN_EVIDENCE_FOR_PREFERENCE) {
      return;
    }

    // Check if a preference already exists
    const existingPreference = this.storage.getPreference(
      userId,
      scope,
      category,
      projectId,
      runId
    );

    if (existingPreference) {
      // Update existing preference with new evidence
      const updated = updatePreferenceWithEvidence(existingPreference, mostCommonOption);
      this.storage.upsertPreference(updated);
    } else {
      // Create new preference
      const preference = createDerivedPreference({
        userId,
        scope,
        category,
        value: mostCommonOption,
        evidenceCount: maxCount,
        projectId,
        runId,
      });
      this.storage.createPreference(preference);
    }
  }

  /**
   * Manually triggers preference derivation for a specific category.
   * Useful for batch reprocessing of events.
   */
  recomputePreferences(
    userId: string,
    scope: UserTrajectoryScope,
    category: string,
    projectId?: string,
    runId?: string
  ): DerivedPreference | null {
    // Get all events in this category
    const events = this.storage.getUserTrajectoryEventsByCategory(userId, category, scope);

    if (events.length < MIN_EVIDENCE_FOR_PREFERENCE) {
      return null;
    }

    // Count occurrences of each option
    const optionCounts = new Map<string, number>();
    for (const event of events) {
      const count = optionCounts.get(event.selected_option) || 0;
      optionCounts.set(event.selected_option, count + 1);
    }

    // Find the most common option
    let maxCount = 0;
    let mostCommonOption = '';
    for (const [option, count] of optionCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonOption = option;
      }
    }

    if (!mostCommonOption || maxCount < MIN_EVIDENCE_FOR_PREFERENCE) {
      return null;
    }

    // Check if preference exists
    const existingPreference = this.storage.getPreference(
      userId,
      scope,
      category,
      projectId,
      runId
    );

    if (existingPreference) {
      const updated: DerivedPreference = {
        ...existingPreference,
        value: mostCommonOption,
        evidence_count: maxCount,
        confidence: calculateConfidence(maxCount),
        updated_at: new Date().toISOString(),
      };
      return this.storage.upsertPreference(updated);
    } else {
      const preference = createDerivedPreference({
        userId,
        scope,
        category,
        value: mostCommonOption,
        evidenceCount: maxCount,
        projectId,
        runId,
      });
      return this.storage.createPreference(preference);
    }
  }

  // ============================================
  // Preference Query (fut-s5)
  // ============================================

  /**
   * Gets user preference with scope priority: run > project > global.
   * Returns null if no preference exists or confidence is below threshold.
   */
  getUserPreference(options: GetPreferenceOptions): DerivedPreference | null {
    const { userId, category, runId, projectId } = options;
    const threshold = options.confidenceThreshold ?? PREFERENCE_CONFIDENCE_THRESHOLD;

    // Priority 1: Run-level preference
    if (runId) {
      const runPref = this.storage.getPreference(userId, 'run', category, projectId, runId);
      if (runPref && runPref.confidence >= threshold) {
        return runPref;
      }
    }

    // Priority 2: Project-level preference
    if (projectId) {
      const projectPref = this.storage.getPreference(userId, 'project', category, projectId);
      if (projectPref && projectPref.confidence >= threshold) {
        return projectPref;
      }
    }

    // Priority 3: Global preference
    const globalPref = this.storage.getPreference(userId, 'global', category);
    if (globalPref && globalPref.confidence >= threshold) {
      return globalPref;
    }

    return null;
  }

  /**
   * Gets all preferences for a user that meet the confidence threshold.
   */
  getAllUserPreferences(
    userId: string,
    scope?: UserTrajectoryScope,
    confidenceThreshold: number = PREFERENCE_CONFIDENCE_THRESHOLD
  ): DerivedPreference[] {
    return this.storage.getPreferencesAboveThreshold(userId, confidenceThreshold, scope);
  }

  // ============================================
  // Similar Questions (fut-s6)
  // ============================================

  /**
   * Finds similar questions from user trajectory history.
   * Returns past answers for potential auto-answering.
   */
  findSimilarQuestions(options: FindSimilarOptions): SimilarQuestionResult[] {
    const {
      userId,
      questionText,
      scope,
      threshold = DEFAULT_SIMILARITY_THRESHOLD,
      limit = 5,
    } = options;

    // Get all trajectory events for the user
    const events = this.storage.listUserTrajectoryEvents(userId, scope);

    // Calculate similarity scores for each event
    const scoredEvents: SimilarQuestionResult[] = [];
    for (const event of events) {
      const similarity = combinedTextSimilarity(questionText, event.question_text);
      if (similarity >= threshold) {
        scoredEvents.push({ event, similarity });
      }
    }

    // Sort by similarity descending and limit results
    scoredEvents.sort((a, b) => b.similarity - a.similarity);
    return scoredEvents.slice(0, limit);
  }

  /**
   * Attempts to auto-answer a question based on trajectory history.
   * Returns the answer from the most similar past question, or null if none found.
   */
  tryAutoAnswer(
    userId: string,
    questionText: string,
    scope?: UserTrajectoryScope,
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ): { answer: string; confidence: number; source: UserTrajectoryEvent } | null {
    const similar = this.findSimilarQuestions({
      userId,
      questionText,
      scope,
      threshold,
      limit: 1,
    });

    const best = similar[0];
    if (!best) {
      return null;
    }

    return {
      answer: best.event.selected_option,
      confidence: best.similarity,
      source: best.event,
    };
  }

  // ============================================
  // Preference Override (fut-s7)
  // ============================================

  /**
   * Overrides a preference with a user-specified value.
   * Resets evidence_count to 1 and marks as override.
   * Records as a trajectory event for audit.
   */
  overridePreference(options: OverridePreferenceOptions): DerivedPreference {
    const { userId, scope, category, value, projectId, runId, reasoning } = options;

    // Record this as a trajectory event for audit purposes
    const eventOptions: CreateUserTrajectoryEventOptions = {
      userId,
      scope,
      questionText: `[OVERRIDE] Preference for ${category}`,
      selectedOption: value,
      reasoning: reasoning ?? 'Manual preference override',
      runId,
      projectId,
      category,
    };
    const event = createUserTrajectoryEvent(eventOptions);
    this.storage.createUserTrajectoryEvent(event);

    // Check if preference exists
    const existingPreference = this.storage.getPreference(
      userId,
      scope,
      category,
      projectId,
      runId
    );

    if (existingPreference) {
      // Override existing preference
      const overridden = overridePreference(existingPreference, value);
      return this.storage.upsertPreference(overridden);
    } else {
      // Create new preference as override
      const preference = createDerivedPreference({
        userId,
        scope,
        category,
        value,
        evidenceCount: 1,
        projectId,
        runId,
        isOverride: true,
      });
      return this.storage.createPreference(preference);
    }
  }

  /**
   * Removes a preference entirely.
   */
  deletePreference(preferenceId: string): boolean {
    return this.storage.deletePreference(preferenceId);
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Gets the trajectory history for a user.
   */
  getUserHistory(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): UserTrajectoryEvent[] {
    return this.storage.listUserTrajectoryEvents(userId, scope, projectId, runId);
  }

  /**
   * Gets all preferences for a user.
   */
  listPreferences(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): DerivedPreference[] {
    return this.storage.listPreferences(userId, scope, projectId, runId);
  }
}
