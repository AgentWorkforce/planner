import type { PlanStorage } from '../storage/interface.js';
import type { DecisionEvent, TrajectoryEventFilter, DerivedPreference } from '../domain/trajectory.js';
import { createDecisionEvent, createDerivedPreference } from '../domain/trajectory.js';

/**
 * TrajectoryService wraps trajectory operations using the storage layer.
 * This provides a clean interface for recording and querying user decisions.
 */
export class TrajectoryService {
  constructor(private storage: PlanStorage) {}

  /**
   * Records a decision event from a user answering a question.
   */
  recordDecision(data: Omit<DecisionEvent, 'event_id' | 'type' | 'timestamp'>): DecisionEvent {
    const event = createDecisionEvent(data);
    return this.storage.createTrajectoryEvent(event);
  }

  /**
   * Queries trajectory events for a plan with optional filtering.
   */
  queryEvents(planId: string, filter?: TrajectoryEventFilter): DecisionEvent[] {
    return this.storage.listTrajectoryEvents(planId, filter);
  }

  /**
   * Finds similar past questions based on text similarity.
   * Uses a simple prefix matching algorithm (v1).
   */
  findSimilarQuestions(planId: string, text: string, threshold: number = 0.7): DecisionEvent[] {
    return this.storage.findSimilarQuestions(planId, text, threshold);
  }

  /**
   * Derives user preferences from trajectory events.
   * Currently uses rule-based logic (v1).
   *
   * Rules:
   * - If user consistently selects the same option for similar questions, derive preference
   * - Confidence based on frequency of consistent choice
   */
  getPreferences(planId: string): DerivedPreference[] {
    const events = this.storage.listTrajectoryEvents(planId);

    // Group events by question text prefix to find patterns
    const patternMap = new Map<string, DecisionEvent[]>();

    for (const event of events) {
      if (!event.selected_option) continue;

      const prefix = event.question_text.substring(0, 30).toLowerCase();
      const existing = patternMap.get(prefix) || [];
      existing.push(event);
      patternMap.set(prefix, existing);
    }

    const preferences: DerivedPreference[] = [];

    // Analyze patterns for consistent preferences
    for (const [prefix, groupEvents] of patternMap.entries()) {
      if (groupEvents.length < 2) continue; // Need at least 2 instances

      // Count option selections
      const optionCounts = new Map<string, number>();
      for (const event of groupEvents) {
        if (event.selected_option) {
          optionCounts.set(
            event.selected_option,
            (optionCounts.get(event.selected_option) || 0) + 1
          );
        }
      }

      // Find most common option
      let maxCount = 0;
      let preferredOption = '';
      for (const [option, count] of optionCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          preferredOption = option;
        }
      }

      // If option selected consistently (>50%), derive preference
      const confidence = maxCount / groupEvents.length;
      if (confidence > 0.5) {
        const preference = createDerivedPreference({
          plan_id: planId,
          category: 'option_preference',
          preference_text: `Prefers "${preferredOption}" for questions about "${prefix}..."`,
          confidence,
          source_event_ids: groupEvents.map(e => e.event_id),
        });
        preferences.push(preference);
      }
    }

    return preferences;
  }

  /**
   * Checks if a similar question has been asked before.
   * Returns the previous answer if found (>threshold similarity).
   */
  findPreviousAnswer(planId: string, questionText: string, threshold: number = 0.7): DecisionEvent | null {
    const similar = this.findSimilarQuestions(planId, questionText, threshold);

    // Return most recent similar question with an answer
    for (const event of similar) {
      if (event.selected_option || event.free_text_response) {
        return event;
      }
    }

    return null;
  }
}

/**
 * Creates a TrajectoryService instance with the given storage.
 */
export function createTrajectoryService(storage: PlanStorage): TrajectoryService {
  return new TrajectoryService(storage);
}
