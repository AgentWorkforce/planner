import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteStorage } from '../storage/index.js';
import { createPlan } from '../domain/plan.js';
import { createOrganization } from '../domain/organization.js';
import { createQuestion } from '../domain/question.js';
import { createTrajectoryService } from './service.js';

describe('TrajectoryService', () => {
  let storage: SqliteStorage;
  let service: ReturnType<typeof createTrajectoryService>;
  let planId: string;
  let questionId: string;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    service = createTrajectoryService(storage);

    // Create test organization and plan
    const org = createOrganization('Test Org', 'test-org');
    storage.createOrganization(org);

    const plan = createPlan(org.org_id);
    storage.createPlan(plan);
    planId = plan.plan_id;

    // Create a test question
    const question = createQuestion({
      plan_id: planId,
      agent_id: 'agent-1',
      agent_role: 'Planner',
      text: 'Should we use TypeScript for this project?',
      options: ['Yes', 'No'],
      blocking_level: 'preference',
    });
    storage.createQuestion(question);
    questionId = question.question_id;
  });

  describe('recordDecision', () => {
    it('should record a decision event', () => {
      const event = service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for this project?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
        reasoning: 'TypeScript provides better type safety',
      });

      expect(event).toBeDefined();
      expect(event.event_id).toBeTruthy();
      expect(event.type).toBe('decision');
      expect(event.selected_option).toBe('Yes');
    });

    it('should record free text response', () => {
      const event = service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'What testing framework should we use?',
        options_presented: [],
        selected_option: null,
        free_text_response: 'Vitest with React Testing Library',
      });

      expect(event.free_text_response).toBe('Vitest with React Testing Library');
    });
  });

  describe('queryEvents', () => {
    beforeEach(() => {
      // Record multiple decisions
      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });

      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-2',
        question_text: 'Should we use React?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });
    });

    it('should query all events for a plan', () => {
      const events = service.queryEvents(planId);
      expect(events).toHaveLength(2);
    });

    it('should filter events by agent', () => {
      const events = service.queryEvents(planId, { agent_id: 'agent-1' });
      expect(events).toHaveLength(1);
      expect(events[0].asking_agent).toBe('agent-1');
    });
  });

  describe('findSimilarQuestions', () => {
    beforeEach(() => {
      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for the backend?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });

      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for the frontend?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });
    });

    it('should find similar questions', () => {
      const similar = service.findSimilarQuestions(
        planId,
        'Should we use TypeScript for the API?'
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].question_text).toContain('TypeScript');
    });
  });

  describe('getPreferences', () => {
    beforeEach(() => {
      // Record consistent preferences
      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for the backend?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });

      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for the frontend?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });

      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for tests?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
      });
    });

    it('should derive preferences from consistent choices', () => {
      const preferences = service.getPreferences(planId);

      expect(preferences.length).toBeGreaterThan(0);
      const pref = preferences[0];
      expect(pref.confidence).toBeGreaterThan(0.5);
      expect(pref.preference_text).toContain('Yes');
    });
  });

  describe('findPreviousAnswer', () => {
    beforeEach(() => {
      service.recordDecision({
        plan_id: planId,
        question_id: questionId,
        asking_agent: 'agent-1',
        question_text: 'Should we use TypeScript for the backend?',
        options_presented: ['Yes', 'No'],
        selected_option: 'Yes',
        reasoning: 'Type safety is important',
      });
    });

    it('should find previous answer for similar question', () => {
      const previous = service.findPreviousAnswer(
        planId,
        'Should we use TypeScript for the API?'
      );

      expect(previous).toBeDefined();
      expect(previous?.selected_option).toBe('Yes');
      expect(previous?.reasoning).toBe('Type safety is important');
    });

    it('should return null if no similar question found with distinct keywords', () => {
      // This test verifies that questions with completely different keywords
      // don't match. The v1 algorithm uses simple keyword matching.
      const previous = service.findPreviousAnswer(
        planId,
        'xyz abc def ghi jkl'
      );

      expect(previous).toBeNull();
    });
  });
});
