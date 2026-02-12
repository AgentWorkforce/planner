/**
 * QA Channel Middleware
 *
 * Express middleware that broadcasts Q&A messages to plan channels when questions are answered.
 * Intercepts POST /api/plans/:id/questions/:questionId/answer responses and sends QA messages.
 */

import type { Request, Response, NextFunction } from 'express';
import { getPlanChannelId, ensurePlanChannelJoined } from './channels.js';
import { sendChannelMessage, isConnected } from './client.js';
import type { QAMessagePayload, QuestionBlockingLevel } from './qa-message.js';

/**
 * Response body structure from POST /api/plans/:id/questions/:questionId/answer.
 */
interface AnswerQuestionResponse {
  question: {
    question_id: string;
    plan_id: string;
    agent_id: string;
    agent_role: string;
    text: string;
    answer?: string;
    blocking_level: QuestionBlockingLevel;
    answered_at?: string;
  };
}

/**
 * Regex to match question answer endpoint.
 * Captures: planId, questionId
 */
const ANSWER_PATTERN = /^\/plans\/([^/]+)\/questions\/([^/]+)\/answer\/?$/;

/**
 * Middleware that intercepts POST /api/plans/:id/questions/:questionId/answer responses.
 * On successful answer (200), broadcasts QA message to the plan channel.
 */
export function qaChannelMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only intercept POST requests to question answer endpoint
  if (req.method !== 'POST') {
    next();
    return;
  }

  const match = req.path.match(ANSWER_PATTERN);
  if (!match) {
    next();
    return;
  }

  // Capture the original json method
  const originalJson = res.json.bind(res);

  // Override json to intercept the response
  res.json = function (body: unknown): Response {
    // Check if this is a successful answer (200)
    if (res.statusCode === 200 && body && typeof body === 'object') {
      const data = body as AnswerQuestionResponse;
      const question = data.question;

      if (question && question.answer) {
        // Send QA message asynchronously (don't block response)
        setImmediate(() => {
          try {
            if (!isConnected()) {
              console.log(`[qa-channel-middleware] Skipping QA broadcast: relay not connected`);
              return;
            }

            // Build QA message payload
            const qaMessage: QAMessagePayload = {
              type: 'qa',
              questionId: question.question_id,
              questionText: question.text,
              answerText: question.answer!,
              agentName: question.agent_id,
              agentRole: question.agent_role,
              blockingLevel: question.blocking_level,
              answeredAt: question.answered_at || new Date().toISOString(),
            };

            // Ensure channel is joined before sending
            const channelId = ensurePlanChannelJoined(question.plan_id);

            if (!channelId) {
              console.warn(
                `[qa-channel-middleware] Failed to join plan channel for plan ${question.plan_id}`
              );
              return;
            }

            // Send to channel - pass qaMessage directly (sendChannelMessage wraps it in { data })
            const sent = sendChannelMessage(
              channelId,
              'Question answered',
              qaMessage as unknown as Record<string, unknown>
            );

            if (sent) {
              console.log(
                `[qa-channel-middleware] Broadcast QA message to ${channelId} for question ${question.question_id}`
              );
            } else {
              console.warn(
                `[qa-channel-middleware] Failed to send QA message to ${channelId}`
              );
            }
          } catch (error) {
            // Log but don't fail - QA broadcast is non-critical
            console.error(`[qa-channel-middleware] Error broadcasting QA message:`, error);
          }
        });
      }
    }

    // Call original json method
    return originalJson(body);
  };

  next();
}
