/**
 * User question tools for PlannerLead.
 */

import type { PlanStorage } from '../../../../planner/src/storage/interface.js';
import { createQuestion as createQuestionEntity } from '../../../../planner/src/domain/question.js';
import { emitQuestionEvent } from '../../../../planner/src/events/question-events.js';
import { sendMessage } from '../client.js';
import { emitAgentStatusUpdate } from '../agent-status.js';
import type { ToolResult, AskUserQuestionInput } from './types.js';
import { findPlanByIdPrefix } from './plan-tools.js';

/**
 * Execute ask_user_question tool.
 * Creates a question in the queue and sets agent state to needs_input.
 */
export async function executeAskUserQuestion(
  input: AskUserQuestionInput,
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Validate plan exists
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    // Create question using domain function
    const question = createQuestionEntity({
      plan_id: plan.plan_id,
      agent_id: input.agent_id,
      agent_role: input.agent_role,
      text: input.text,
      context: input.context,
      options: input.options,
      blocking_level: input.blocking_level ?? 'soft_block',
    });

    // Store the question
    storage.createQuestion(question);

    // Emit SSE event for real-time UI updates
    emitQuestionEvent(plan.plan_id, question.question_id, 'question_added', question);

    // Broadcast to relay for WebSocket clients (StatusBar pendingQuestions counter)
    sendMessage('*', 'question_added', 'question_event', {
      type: 'question_added',
      questionId: question.question_id,
      planId: plan.plan_id,
      agentId: input.agent_id,
      question,
    });

    // Update agent state to needs_input
    emitAgentStatusUpdate(input.agent_id, 'needs_input', {
      activity: `Waiting for answer: ${input.text}`,
    });

    return {
      success: true,
      result: {
        question_id: question.question_id,
        plan_id: plan.plan_id,
        agent_id: input.agent_id,
        message: `Question submitted. Your state has been set to needs_input.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
