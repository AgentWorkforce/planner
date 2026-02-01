/**
 * Specialist Input Queue
 *
 * Queues specialist questions/observations for Interviewer to weave into conversation.
 * Specialists are invisible to user - their inputs become Interviewer's questions.
 */

// =============================================================================
// Types
// =============================================================================

export type SpecialistInputType = 'question' | 'observation' | 'concern';

export interface SpecialistInput {
  /** Which specialist provided this input */
  specialist_name: string;
  /** Type of input */
  type: SpecialistInputType;
  /** The content to weave into conversation */
  content: string;
  /** Priority (higher = more urgent) */
  priority: number;
  /** When this was queued */
  timestamp: string;
}

// =============================================================================
// Queue Store
// =============================================================================

class SpecialistInputQueueStore {
  private queues: Map<string, SpecialistInput[]> = new Map();

  /**
   * Queue an input from a specialist.
   */
  queueInput(sessionId: string, input: Omit<SpecialistInput, 'timestamp'>): void {
    if (!this.queues.has(sessionId)) {
      this.queues.set(sessionId, []);
    }
    const queue = this.queues.get(sessionId)!;
    queue.push({
      ...input,
      timestamp: new Date().toISOString(),
    });
    // Sort by priority (highest first)
    queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get the next input (highest priority).
   * Returns undefined if queue is empty.
   */
  getNextInput(sessionId: string): SpecialistInput | undefined {
    const queue = this.queues.get(sessionId);
    if (!queue || queue.length === 0) return undefined;
    return queue.shift();
  }

  /**
   * Peek at the next input without removing it.
   */
  peekNextInput(sessionId: string): SpecialistInput | undefined {
    const queue = this.queues.get(sessionId);
    return queue?.[0];
  }

  /**
   * Get all pending inputs for a session.
   */
  getAllInputs(sessionId: string): SpecialistInput[] {
    return this.queues.get(sessionId) ?? [];
  }

  /**
   * Get count of pending inputs.
   */
  getPendingCount(sessionId: string): number {
    return this.queues.get(sessionId)?.length ?? 0;
  }

  /**
   * Clear all inputs for a session.
   */
  clearQueue(sessionId: string): void {
    this.queues.delete(sessionId);
  }

  /**
   * Clear all queues.
   */
  clearAll(): void {
    this.queues.clear();
  }
}

// Singleton instance
export const specialistQueue = new SpecialistInputQueueStore();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format specialist inputs for injection into prompt.
 * Never reveals specialist names - presents as Interviewer thoughts.
 */
export function formatPendingInsights(sessionId: string): string | undefined {
  const inputs = specialistQueue.getAllInputs(sessionId);
  if (inputs.length === 0) return undefined;

  const formatted = inputs.map(input => {
    switch (input.type) {
      case 'question':
        return `Consider asking: ${input.content}`;
      case 'observation':
        return `Note: ${input.content}`;
      case 'concern':
        return `Potential issue to explore: ${input.content}`;
    }
  });

  return `\n\n## Insights to weave into conversation:\n${formatted.join('\n')}`;
}
