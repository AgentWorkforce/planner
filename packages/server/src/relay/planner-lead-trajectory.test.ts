/**
 * Integration tests for PlannerLead trajectory integration
 *
 * Verifies that questions and answers are properly stored in user trajectory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initPlannerLead, stopPlannerLead, emitQuestion, answerQuestion } from './planner-lead.js';
import { getTrajectory, clearTrajectory, findSimilarQuestion } from './user-trajectory.js';
import { SqliteStorage } from '../../../planner/src/storage/sqlite.js';

describe('PlannerLead Trajectory Integration', () => {
  let storage: SqliteStorage;
  const testPlanId = 'test-plan-123';

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    initPlannerLead(storage);
    clearTrajectory(testPlanId);
  });

  afterEach(() => {
    stopPlannerLead();
    clearTrajectory(testPlanId);
    storage.close();
  });

  describe('emitQuestion and answerQuestion', () => {
    it('should store question-answer pair in trajectory', () => {
      // Emit a question
      const questionId = emitQuestion(
        'Should we use TypeScript strict mode?',
        'blocking',
        testPlanId
      );

      expect(questionId).toBeTruthy();

      // Initially, trajectory should be empty (question not answered yet)
      expect(getTrajectory(testPlanId)).toHaveLength(0);

      // Answer the question
      answerQuestion(questionId, 'Yes, enable strict mode for better type safety');

      // Now trajectory should contain the entry
      const trajectory = getTrajectory(testPlanId);
      expect(trajectory).toHaveLength(1);
      expect(trajectory[0]?.questionId).toBe(questionId);
      expect(trajectory[0]?.questionText).toBe('Should we use TypeScript strict mode?');
      expect(trajectory[0]?.answer).toBe('Yes, enable strict mode for better type safety');
      expect(trajectory[0]?.priority).toBe('blocking');
      expect(trajectory[0]?.timestamp).toBeDefined();
    });

    it('should store multiple question-answer pairs', () => {
      // Ask and answer multiple questions
      const q1 = emitQuestion('Use OAuth2?', 'blocking', testPlanId);
      answerQuestion(q1, 'Yes, use Auth0');

      const q2 = emitQuestion('Database choice?', 'preference', testPlanId);
      answerQuestion(q2, 'PostgreSQL');

      const q3 = emitQuestion('Enable caching?', 'confirmation', testPlanId);
      answerQuestion(q3, 'Yes, use Redis');

      // Check trajectory
      const trajectory = getTrajectory(testPlanId);
      expect(trajectory).toHaveLength(3);

      expect(trajectory[0]?.questionId).toBe(q1);
      expect(trajectory[0]?.answer).toBe('Yes, use Auth0');

      expect(trajectory[1]?.questionId).toBe(q2);
      expect(trajectory[1]?.answer).toBe('PostgreSQL');

      expect(trajectory[2]?.questionId).toBe(q3);
      expect(trajectory[2]?.answer).toBe('Yes, use Redis');
    });

    it('should not store trajectory for questions without planId', () => {
      // Emit question without planId
      const questionId = emitQuestion('Generic question?', 'preference');

      // Answer it
      answerQuestion(questionId, 'Generic answer');

      // Trajectory for testPlanId should be empty
      expect(getTrajectory(testPlanId)).toHaveLength(0);
    });

    it('should handle answering unknown question gracefully', () => {
      // Answer a question that was never emitted
      expect(() => {
        answerQuestion('unknown-question-id', 'Some answer');
      }).not.toThrow();

      // Trajectory should remain empty
      expect(getTrajectory(testPlanId)).toHaveLength(0);
    });

    it('should allow finding similar previously answered questions', () => {
      // Ask and answer a question
      const questionId = emitQuestion(
        'Should we use OAuth2 for authentication?',
        'blocking',
        testPlanId
      );
      answerQuestion(questionId, 'Yes, use Auth0 provider');

      // Later, find similar question using substring match
      const similar = findSimilarQuestion(testPlanId, 'use OAuth2 for authentication');
      expect(similar).toBeDefined();
      expect(similar?.questionId).toBe(questionId);
      expect(similar?.answer).toBe('Yes, use Auth0 provider');
    });

    it('should find most recent answer for similar questions', () => {
      // Ask and answer similar questions over time
      const q1 = emitQuestion('Use TypeScript?', 'preference', testPlanId);
      answerQuestion(q1, 'Maybe');

      const q2 = emitQuestion('Should we use TypeScript strict mode?', 'blocking', testPlanId);
      answerQuestion(q2, 'Yes, definitely');

      // Find similar question - should return most recent
      const similar = findSimilarQuestion(testPlanId, 'TypeScript');
      expect(similar?.questionId).toBe(q2);
      expect(similar?.answer).toBe('Yes, definitely');
    });
  });

  describe('trajectory isolation per plan', () => {
    it('should keep trajectories separate for different plans', () => {
      const planA = 'plan-A';
      const planB = 'plan-B';

      // Add trajectory entries for plan A
      const qaA = emitQuestion('Plan A question?', 'blocking', planA);
      answerQuestion(qaA, 'Plan A answer');

      // Add trajectory entries for plan B
      const qbB = emitQuestion('Plan B question?', 'preference', planB);
      answerQuestion(qbB, 'Plan B answer');

      // Check isolation
      expect(getTrajectory(planA)).toHaveLength(1);
      expect(getTrajectory(planB)).toHaveLength(1);

      expect(getTrajectory(planA)[0]?.questionText).toBe('Plan A question?');
      expect(getTrajectory(planB)[0]?.questionText).toBe('Plan B question?');

      // Clear plan A shouldn't affect plan B
      clearTrajectory(planA);
      expect(getTrajectory(planA)).toHaveLength(0);
      expect(getTrajectory(planB)).toHaveLength(1);

      // Cleanup
      clearTrajectory(planB);
    });
  });
});
