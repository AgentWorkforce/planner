import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionService, createQuestionService } from './question-service.js';
import { createForgeStorage } from '../storage/sqlite/index.js';
import { TrajectoryCapture } from './trajectory-capture.js';
import { UserTrajectoryService } from './user-trajectory-service.js';
import { QuestionBlockingLevel, QuestionStatus } from '../domain/types.js';
import type { ForgeStorage } from '../storage/interface.js';

describe('QuestionService - Trajectory-Aware Deduplication', () => {
  let storage: ForgeStorage;
  let trajectoryCapture: TrajectoryCapture;
  let userTrajectoryService: UserTrajectoryService;
  let questionService: QuestionService;
  let testRunId: string;

  beforeEach(() => {
    storage = createForgeStorage(':memory:');
    trajectoryCapture = new TrajectoryCapture(storage);
    userTrajectoryService = new UserTrajectoryService(storage);
    questionService = createQuestionService(storage, trajectoryCapture, {
      userTrajectoryService,
    });

    // Create a test run
    testRunId = crypto.randomUUID();
    storage.createRun({
      run_id: testRunId,
      plan_id: crypto.randomUUID(),
      plan_version: 1,
      status: 'running',
      has_pending_gate: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  describe('Auto-answering from user trajectory', () => {
    it('should auto-answer when similar question found in trajectory', () => {
      const userId = 'user-123';
      const questionText = 'Should we use TypeScript for this project?';
      const answer = 'Yes, use TypeScript';

      // Record a past decision
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText,
        selectedOption: answer,
        category: 'tech_stack',
      });

      // Ask a similar question
      const result = questionService.askQuestion(
        testRunId,
        'agent-456',
        'Should we use TypeScript for the project?', // Similar but not identical
        QuestionBlockingLevel.SoftBlock,
        {
          userId,
          checkTrajectory: true,
          similarityThreshold: 0.85,
        }
      );

      // Should be auto-answered
      expect(result.wasAutoAnswered).toBe(true);
      expect(result.wasSubscribed).toBe(false);
      expect(result.question.status).toBe(QuestionStatus.AutoAnsweredFromTrajectory);
      expect(result.question.answer).toBe(answer);
      expect(result.question.answered_by).toBe('system');
      expect(result.sourceQuestionId).toBeDefined();
    });

    it('should NOT auto-answer when similarity below threshold', () => {
      const userId = 'user-123';

      // Record a past decision
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText: 'Should we use TypeScript?',
        selectedOption: 'Yes',
        category: 'tech_stack',
      });

      // Ask a completely different question
      const result = questionService.askQuestion(
        testRunId,
        'agent-456',
        'What database should we use?',
        QuestionBlockingLevel.SoftBlock,
        {
          userId,
          checkTrajectory: true,
          similarityThreshold: 0.85,
        }
      );

      // Should NOT be auto-answered
      expect(result.wasAutoAnswered).toBe(false);
      expect(result.question.status).toBe(QuestionStatus.Pending);
    });

    it('should use default threshold of 0.85', () => {
      const userId = 'user-123';

      // Record a past decision
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText: 'Should we use TypeScript for the backend service?',
        selectedOption: 'Yes',
      });

      // Ask very similar question without specifying threshold
      const result = questionService.askQuestion(
        testRunId,
        'agent-456',
        'Should we use TypeScript for backend service?',
        QuestionBlockingLevel.Preference,
        {
          userId,
          checkTrajectory: true,
          // No threshold specified - should use 0.85 default
        }
      );

      // With good similarity, should auto-answer
      expect(result.wasAutoAnswered).toBe(true);
    });

    it('should skip trajectory check when userId not provided', () => {
      // Ask question without userId
      const result = questionService.askQuestion(
        testRunId,
        'agent-456',
        'Should we use TypeScript?',
        QuestionBlockingLevel.SoftBlock,
        {
          checkTrajectory: true,
          // No userId provided
        }
      );

      // Should create new question (not auto-answered)
      expect(result.wasAutoAnswered).toBe(false);
      expect(result.question.status).toBe(QuestionStatus.Pending);
    });

    it('should skip trajectory check when userTrajectoryService not available', () => {
      // Create service without userTrajectoryService
      const serviceWithoutTrajectory = createQuestionService(storage, trajectoryCapture, {
        // No userTrajectoryService
      });

      const result = serviceWithoutTrajectory.askQuestion(
        testRunId,
        'agent-456',
        'Should we use TypeScript?',
        QuestionBlockingLevel.SoftBlock,
        {
          userId: 'user-123',
          checkTrajectory: true,
        }
      );

      // Should create new question
      expect(result.wasAutoAnswered).toBe(false);
      expect(result.question.status).toBe(QuestionStatus.Pending);
    });
  });

  describe('Transparency - auto-answered questions are visible', () => {
    it('should store auto-answered questions in database', () => {
      const userId = 'user-123';
      const questionText = 'Use TypeScript?';
      const answer = 'Yes';

      // Record past decision
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText,
        selectedOption: answer,
      });

      // Ask similar question
      const result = questionService.askQuestion(
        testRunId,
        'agent-456',
        questionText,
        QuestionBlockingLevel.Preference,
        { userId }
      );

      // Verify question is stored
      const storedQuestion = storage.getQuestion(result.question.question_id);
      expect(storedQuestion).toBeDefined();
      expect(storedQuestion?.status).toBe(QuestionStatus.AutoAnsweredFromTrajectory);
      expect(storedQuestion?.answer).toBe(answer);
    });

    it('should include auto-answered questions in history query', () => {
      const userId = 'user-123';

      // Record past decision
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText: 'Use TypeScript?',
        selectedOption: 'Yes',
      });

      // Ask similar question (auto-answered)
      const autoAnswered = questionService.askQuestion(
        testRunId,
        'agent-1',
        'Use TypeScript?',
        QuestionBlockingLevel.Preference,
        { userId }
      );

      // Ask different question (pending)
      const pending = questionService.askQuestion(
        testRunId,
        'agent-2',
        'What database?',
        QuestionBlockingLevel.SoftBlock,
        { userId }
      );

      // Get history
      const history = questionService.listQuestionHistory(testRunId);

      expect(history).toHaveLength(2);
      expect(history.some((q) => q.status === QuestionStatus.AutoAnsweredFromTrajectory)).toBe(
        true
      );
      expect(history.some((q) => q.status === QuestionStatus.Pending)).toBe(true);
    });

    it('should allow filtering history by auto-answered status', () => {
      const userId = 'user-123';

      // Record past decision
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText: 'Use TypeScript?',
        selectedOption: 'Yes',
      });

      // Create auto-answered question
      questionService.askQuestion(testRunId, 'agent-1', 'Use TypeScript?', QuestionBlockingLevel.Preference, { userId });

      // Create pending question
      questionService.askQuestion(testRunId, 'agent-2', 'What database?', QuestionBlockingLevel.SoftBlock);

      // Filter for auto-answered only
      const autoAnswered = questionService.listQuestionHistory(
        testRunId,
        QuestionStatus.AutoAnsweredFromTrajectory
      );

      expect(autoAnswered).toHaveLength(1);
      expect(autoAnswered[0].status).toBe(QuestionStatus.AutoAnsweredFromTrajectory);
    });

    it('should record trajectory event for auto-answered questions', () => {
      const userId = 'user-123';
      const questionText = 'Use TypeScript?';
      const answer = 'Yes';

      // Record past decision
      const pastEvent = userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText,
        selectedOption: answer,
      });

      // Ask similar question
      const result = questionService.askQuestion(
        testRunId,
        'agent-456',
        questionText,
        QuestionBlockingLevel.Preference,
        { userId }
      );

      // Verify trajectory event was captured
      const events = storage.listTrajectoryEvents(testRunId);
      const autoAnswerEvent = events.find(
        (e) => e.event_type === 'question_auto_answered'
      );

      expect(autoAnswerEvent).toBeDefined();
      expect(autoAnswerEvent?.payload).toMatchObject({
        question_id: result.question.question_id,
        agent_id: 'agent-456',
        text: questionText,
        answer,
        source_question_id: pastEvent.event_id,
      });
      expect((autoAnswerEvent?.payload as any).similarity_score).toBeGreaterThan(0);
    });
  });

  describe('Integration with existing deduplication', () => {
    it('should check trajectory before checking pending questions', () => {
      const userId = 'user-123';
      const questionText = 'Use TypeScript?';
      const trajectoryAnswer = 'Yes, with strict mode';

      // Record past decision in trajectory
      userTrajectoryService.recordUserDecision({
        userId,
        scope: 'global',
        questionText,
        selectedOption: trajectoryAnswer,
      });

      // Create a pending question (different answer)
      const pendingQuestion = questionService.askQuestion(
        testRunId,
        'agent-1',
        questionText,
        QuestionBlockingLevel.Preference
        // No userId - so it creates pending question
      );

      // Now ask with userId - should use trajectory, not subscribe to pending
      const result = questionService.askQuestion(
        testRunId,
        'agent-2',
        questionText,
        QuestionBlockingLevel.Preference,
        { userId }
      );

      expect(result.wasAutoAnswered).toBe(true);
      expect(result.wasSubscribed).toBe(false);
      expect(result.question.answer).toBe(trajectoryAnswer);
      expect(result.question.question_id).not.toBe(pendingQuestion.question.question_id);
    });
  });
});
