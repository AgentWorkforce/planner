/**
 * Tests for User Trajectory Module
 *
 * Verifies the question-answer pair storage and retrieval functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addToTrajectory,
  getTrajectory,
  findSimilarQuestion,
  clearTrajectory,
  getAllTrajectoryPlanIds,
  getTotalTrajectoryEntries,
  type TrajectoryEntry,
} from './user-trajectory.js';

describe('User Trajectory', () => {
  beforeEach(() => {
    // Clear all trajectories before each test
    const planIds = getAllTrajectoryPlanIds();
    planIds.forEach((id) => clearTrajectory(id));
  });

  describe('addToTrajectory', () => {
    it('should add a trajectory entry to a plan', () => {
      const planId = 'plan-test-001';
      const entry = {
        questionId: 'q-123',
        questionText: 'Should we use OAuth2?',
        answer: 'Yes, use Auth0',
        priority: 'blocking' as const,
        agentId: 'planner-lead-123',
      };

      addToTrajectory(planId, entry);

      const trajectory = getTrajectory(planId);
      expect(trajectory).toHaveLength(1);
      expect(trajectory[0]?.questionId).toBe('q-123');
      expect(trajectory[0]?.questionText).toBe('Should we use OAuth2?');
      expect(trajectory[0]?.answer).toBe('Yes, use Auth0');
      expect(trajectory[0]?.priority).toBe('blocking');
      expect(trajectory[0]?.agentId).toBe('planner-lead-123');
      expect(trajectory[0]?.timestamp).toBeDefined();
    });

    it('should add multiple entries in chronological order', () => {
      const planId = 'plan-test-002';

      addToTrajectory(planId, {
        questionId: 'q-1',
        questionText: 'First question?',
        answer: 'First answer',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory(planId, {
        questionId: 'q-2',
        questionText: 'Second question?',
        answer: 'Second answer',
        priority: 'preference' as const,
        agentId: 'agent-1',
      });

      const trajectory = getTrajectory(planId);
      expect(trajectory).toHaveLength(2);
      expect(trajectory[0]?.questionId).toBe('q-1');
      expect(trajectory[1]?.questionId).toBe('q-2');
    });

    it('should handle multiple plans independently', () => {
      addToTrajectory('plan-A', {
        questionId: 'q-a1',
        questionText: 'Plan A question?',
        answer: 'Plan A answer',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory('plan-B', {
        questionId: 'q-b1',
        questionText: 'Plan B question?',
        answer: 'Plan B answer',
        priority: 'preference' as const,
        agentId: 'agent-1',
      });

      expect(getTrajectory('plan-A')).toHaveLength(1);
      expect(getTrajectory('plan-B')).toHaveLength(1);
      expect(getTrajectory('plan-A')[0]?.questionId).toBe('q-a1');
      expect(getTrajectory('plan-B')[0]?.questionId).toBe('q-b1');
    });
  });

  describe('getTrajectory', () => {
    it('should return empty array for plan with no entries', () => {
      const trajectory = getTrajectory('nonexistent-plan');
      expect(trajectory).toEqual([]);
    });

    it('should return all entries for a plan', () => {
      const planId = 'plan-test-003';

      addToTrajectory(planId, {
        questionId: 'q-1',
        questionText: 'Q1?',
        answer: 'A1',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory(planId, {
        questionId: 'q-2',
        questionText: 'Q2?',
        answer: 'A2',
        priority: 'preference' as const,
        agentId: 'agent-1',
      });

      const trajectory = getTrajectory(planId);
      expect(trajectory).toHaveLength(2);
    });
  });

  describe('findSimilarQuestion', () => {
    const setupTestData = (planId: string) => {
      addToTrajectory(planId, {
        questionId: 'q-1',
        questionText: 'Should we use OAuth2 for authentication?',
        answer: 'Yes, use Auth0',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory(planId, {
        questionId: 'q-2',
        questionText: 'What database should we use?',
        answer: 'Use PostgreSQL',
        priority: 'preference' as const,
        agentId: 'agent-1',
      });
    };

    it('should find exact substring match', () => {
      const planId = 'plan-test-004';
      setupTestData(planId);
      const match = findSimilarQuestion(planId, 'OAuth2');
      expect(match).toBeDefined();
      expect(match?.questionId).toBe('q-1');
    });

    it('should find case-insensitive match', () => {
      const planId = 'plan-test-004';
      setupTestData(planId);
      const match = findSimilarQuestion(planId, 'oauth2');
      expect(match).toBeDefined();
      expect(match?.questionId).toBe('q-1');
    });

    it('should find match when query is substring of stored question', () => {
      const planId = 'plan-test-004';
      setupTestData(planId);
      const match = findSimilarQuestion(planId, 'use OAuth');
      expect(match).toBeDefined();
      expect(match?.questionId).toBe('q-1');
    });

    it('should find match when stored question is substring of query', () => {
      const planId = 'plan-test-004';
      setupTestData(planId);
      const match = findSimilarQuestion(
        planId,
        'Should we use OAuth2 for authentication in the API?'
      );
      expect(match).toBeDefined();
      expect(match?.questionId).toBe('q-1');
    });

    it('should return undefined for non-matching question', () => {
      const planId = 'plan-test-004';
      setupTestData(planId);
      const match = findSimilarQuestion(planId, 'Redis cache strategy');
      expect(match).toBeUndefined();
    });

    it('should return undefined for empty trajectory', () => {
      const match = findSimilarQuestion('empty-plan', 'any question');
      expect(match).toBeUndefined();
    });

    it('should return most recent match when multiple matches exist', () => {
      const planId = 'plan-test-005';

      addToTrajectory(planId, {
        questionId: 'q-old',
        questionText: 'Should we use TypeScript?',
        answer: 'Maybe',
        priority: 'preference' as const,
        agentId: 'agent-1',
      });

      addToTrajectory(planId, {
        questionId: 'q-new',
        questionText: 'Should we use TypeScript strict mode?',
        answer: 'Yes',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      const match = findSimilarQuestion(planId, 'TypeScript');
      expect(match?.questionId).toBe('q-new');
    });
  });

  describe('clearTrajectory', () => {
    it('should remove all entries for a plan', () => {
      const planId = 'plan-test-006';

      addToTrajectory(planId, {
        questionId: 'q-1',
        questionText: 'Q1?',
        answer: 'A1',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      expect(getTrajectory(planId)).toHaveLength(1);

      clearTrajectory(planId);

      expect(getTrajectory(planId)).toHaveLength(0);
    });

    it('should not affect other plans', () => {
      addToTrajectory('plan-A', {
        questionId: 'q-a',
        questionText: 'Q?',
        answer: 'A',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory('plan-B', {
        questionId: 'q-b',
        questionText: 'Q?',
        answer: 'A',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      clearTrajectory('plan-A');

      expect(getTrajectory('plan-A')).toHaveLength(0);
      expect(getTrajectory('plan-B')).toHaveLength(1);
    });
  });

  describe('getAllTrajectoryPlanIds', () => {
    it('should return empty array when no trajectories exist', () => {
      expect(getAllTrajectoryPlanIds()).toEqual([]);
    });

    it('should return all plan IDs with trajectories', () => {
      addToTrajectory('plan-1', {
        questionId: 'q-1',
        questionText: 'Q?',
        answer: 'A',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory('plan-2', {
        questionId: 'q-2',
        questionText: 'Q?',
        answer: 'A',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      const planIds = getAllTrajectoryPlanIds();
      expect(planIds).toHaveLength(2);
      expect(planIds).toContain('plan-1');
      expect(planIds).toContain('plan-2');
    });

    it('should not return cleared plan IDs', () => {
      addToTrajectory('plan-1', {
        questionId: 'q-1',
        questionText: 'Q?',
        answer: 'A',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      clearTrajectory('plan-1');

      expect(getAllTrajectoryPlanIds()).toEqual([]);
    });
  });

  describe('getTotalTrajectoryEntries', () => {
    it('should return 0 when no trajectories exist', () => {
      expect(getTotalTrajectoryEntries()).toBe(0);
    });

    it('should count entries across all plans', () => {
      addToTrajectory('plan-1', {
        questionId: 'q-1',
        questionText: 'Q1?',
        answer: 'A1',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      addToTrajectory('plan-1', {
        questionId: 'q-2',
        questionText: 'Q2?',
        answer: 'A2',
        priority: 'preference' as const,
        agentId: 'agent-1',
      });

      addToTrajectory('plan-2', {
        questionId: 'q-3',
        questionText: 'Q3?',
        answer: 'A3',
        priority: 'blocking' as const,
        agentId: 'agent-1',
      });

      expect(getTotalTrajectoryEntries()).toBe(3);
    });
  });
});
