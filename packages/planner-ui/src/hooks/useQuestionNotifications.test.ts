/**
 * Tests for useQuestionNotifications hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuestionNotifications } from './useQuestionNotifications';
import type { Question } from '@/types/plan';

// Mock question factory
function createMockQuestion(overrides: Partial<Question> = {}): Question {
  return {
    question_id: `q-${Math.random().toString(36).slice(2, 9)}`,
    plan_id: 'plan-1',
    agent_id: 'agent-1',
    agent_role: 'coder',
    text: 'What should I do?',
    blocking_level: 'soft_block',
    steps_blocked: 1,
    can_use_default: false,
    subscribers: [],
    merged_from: [],
    status: 'pending',
    priority_score: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('useQuestionNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null currentNotification when queue is empty', () => {
    const { result } = renderHook(() => useQuestionNotifications());

    expect(result.current.currentNotification).toBeNull();
    expect(result.current.queue).toHaveLength(0);
  });

  it('shows added question as currentNotification', () => {
    const { result } = renderHook(() => useQuestionNotifications());
    const question = createMockQuestion({ agent_id: 'agent-42' });

    act(() => {
      result.current.addToQueue(question);
    });

    expect(result.current.currentNotification).not.toBeNull();
    expect(result.current.currentNotification?.question.question_id).toBe(question.question_id);
    expect(result.current.currentNotification?.agentId).toBe('agent-42');
    expect(result.current.queue).toHaveLength(1);
  });

  it('auto-advances to next notification after 5 seconds', () => {
    const { result } = renderHook(() => useQuestionNotifications({ autoAdvanceDelay: 5000 }));

    const question1 = createMockQuestion({ question_id: 'q-1' });
    const question2 = createMockQuestion({ question_id: 'q-2' });

    act(() => {
      result.current.addToQueue(question1);
      result.current.addToQueue(question2);
    });

    expect(result.current.currentNotification?.question.question_id).toBe('q-1');
    expect(result.current.queue).toHaveLength(2);

    // Advance time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.currentNotification?.question.question_id).toBe('q-2');
    expect(result.current.queue).toHaveLength(1);
  });

  it('dismiss() advances queue immediately', () => {
    const { result } = renderHook(() => useQuestionNotifications());

    const question1 = createMockQuestion({ question_id: 'q-1' });
    const question2 = createMockQuestion({ question_id: 'q-2' });

    act(() => {
      result.current.addToQueue(question1);
      result.current.addToQueue(question2);
    });

    expect(result.current.currentNotification?.question.question_id).toBe('q-1');

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.currentNotification?.question.question_id).toBe('q-2');
    expect(result.current.queue).toHaveLength(1);
  });

  it('queues multiple questions correctly (FIFO)', () => {
    const { result } = renderHook(() => useQuestionNotifications());

    const questions = [
      createMockQuestion({ question_id: 'q-1' }),
      createMockQuestion({ question_id: 'q-2' }),
      createMockQuestion({ question_id: 'q-3' }),
    ];

    act(() => {
      questions.forEach((q) => result.current.addToQueue(q));
    });

    expect(result.current.queue).toHaveLength(3);
    expect(result.current.queue[0]?.question.question_id).toBe('q-1');
    expect(result.current.queue[1]?.question.question_id).toBe('q-2');
    expect(result.current.queue[2]?.question.question_id).toBe('q-3');

    // Dismiss all
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.currentNotification?.question.question_id).toBe('q-2');

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.currentNotification?.question.question_id).toBe('q-3');

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.currentNotification).toBeNull();
  });

  it('does not add duplicate questions to queue', () => {
    const { result } = renderHook(() => useQuestionNotifications());

    const question = createMockQuestion({ question_id: 'q-same' });

    act(() => {
      result.current.addToQueue(question);
      result.current.addToQueue(question); // duplicate
      result.current.addToQueue(question); // duplicate
    });

    expect(result.current.queue).toHaveLength(1);
  });

  it('clears timer when dismissed before auto-advance', () => {
    const { result } = renderHook(() => useQuestionNotifications({ autoAdvanceDelay: 5000 }));

    const question1 = createMockQuestion({ question_id: 'q-1' });
    const question2 = createMockQuestion({ question_id: 'q-2' });

    act(() => {
      result.current.addToQueue(question1);
      result.current.addToQueue(question2);
    });

    // Advance half the time
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.currentNotification?.question.question_id).toBe('q-1');

    // Dismiss manually
    act(() => {
      result.current.dismiss();
    });

    expect(result.current.currentNotification?.question.question_id).toBe('q-2');

    // Advance the remaining time - should not cause another advance since timer was reset
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // q-2 should still be current (timer restarted)
    expect(result.current.currentNotification?.question.question_id).toBe('q-2');

    // After full 5 seconds, q-2 should be dismissed
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.currentNotification).toBeNull();
  });

  it('uses custom autoAdvanceDelay', () => {
    const { result } = renderHook(() => useQuestionNotifications({ autoAdvanceDelay: 10000 }));

    const question = createMockQuestion();

    act(() => {
      result.current.addToQueue(question);
    });

    // After 5 seconds, should still be showing
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.currentNotification).not.toBeNull();

    // After 10 seconds total, should be dismissed
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.currentNotification).toBeNull();
  });
});
