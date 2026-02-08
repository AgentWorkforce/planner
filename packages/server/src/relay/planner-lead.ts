/**
 * PlannerLead Service
 *
 * A persistent planning assistant that:
 * - Listens to messages via the relay client
 * - Responds to messages in #planner and #plan-* channels
 * - Uses Anthropic API for response generation
 * - Can call planning tools (read_plan, add_step, etc.)
 *
 * Unlike spawn()-based agents, PlannerLead runs as part of the Relay
 * process and persists across messages.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { onMessage, sendMessage, sendChannelMessage, isConnected, onStateChange, isAgentSpawned, getSpawnedAgentChannel, type ClientState } from './client.js';
import { getRelayMode } from './service.js';
import { PLANNER_CHANNEL } from './channels.js';
import { getAnthropicClient, hasApiKey, MODEL, MAX_TOKENS } from './anthropic-config.js';
import { getSystemPrompt } from './planner-lead-prompt.js';
import { PLANNER_LEAD_TOOLS, executeTool, getMockToolResult, type ToolResult } from './planner-lead-tools/index.js';
import { addMessage, getHistory, type ConversationMessage } from './conversation-history.js';
import type { PlanStorage } from '../../../planner/src/storage/interface.js';
import { emitAgentJoined, emitAgentStatusUpdate, emitAgentLeft, type AgentState, type AgentRole } from './agent-status.js';
import { addToTrajectory, findSimilarQuestion, type TrajectoryEntry } from './user-trajectory.js';
import { getSessionForPlanChannel } from './ideation-bridge.js';

/** PlannerLead configuration */
const PLANNER_LEAD_CONFIG = {
  name: 'PlannerLead',
  displayName: 'Planning Assistant',
  role: 'planner-lead' as AgentRole,
  /** Channels PlannerLead responds in */
  respondInChannels: true,
  /** Whether to require @mention to respond */
  requireMention: false,
};

/** Track initialization state */
let initialized = false;
let storage: PlanStorage | null = null;
let unsubscribeMessage: (() => void) | null = null;

/** Unique agent ID for status tracking */
let agentId: string | null = null;

/** Health tracking */
let lastActivityTimestamp: string | null = null;
let messagesProcessed = 0;
let errorCount = 0;

/**
 * Pending questions map for trajectory tracking.
 * Maps questionId -> question metadata needed for trajectory storage.
 */
interface PendingQuestionMetadata {
  questionText: string;
  priority: QuestionPriority;
  planId?: string;
}
const pendingQuestions = new Map<string, PendingQuestionMetadata>();

/**
 * Extract plan ID from channel name.
 * #plan-abc12345 -> abc12345 (partial UUID)
 * Returns null for non-plan channels.
 */
function extractPlanIdFromChannel(channelId: string): string | null {
  const match = channelId.match(/^#plan-([a-f0-9-]+)$/i);
  return match?.[1] ?? null;
}

/**
 * Check if a message should be handled by PlannerLead.
 */
function shouldHandleMessage(from: string, body: string, channelId?: string, data?: Record<string, unknown>): boolean {
  // Don't respond to our own messages — but DO accept Relay messages from the Interviewer
  if (from === PLANNER_LEAD_CONFIG.name) {
    return false;
  }
  if (from === 'Relay') {
    // Accept messages from the Interviewer in plan channels
    if (data?.fromAgent === 'ideation-interviewer' && channelId?.startsWith('#plan-')) {
      return true;
    }
    return false;
  }

  // Handle direct messages from agents we spawned (they reply to their spawner via DM)
  if (!channelId && isAgentSpawned(from)) {
    return true;
  }

  // Check if this is a channel we care about
  const isRelevantChannel = channelId === PLANNER_CHANNEL || channelId?.startsWith('#plan-');
  if (!isRelevantChannel) {
    return false;
  }

  // If mention filtering is enabled, check for @PlannerLead
  if (PLANNER_LEAD_CONFIG.requireMention) {
    const mentionPattern = /@PlannerLead\b/i;
    return mentionPattern.test(body);
  }

  return true;
}

/**
 * Generate a response using Anthropic API.
 */
async function generateResponse(
  channelId: string,
  userMessage: string,
  planId: string | null,
  options?: { domainExpertAvailable?: boolean }
): Promise<string> {
  const client = getAnthropicClient();

  // Mock mode - return helpful mock response
  if (!client) {
    return generateMockResponse(userMessage, planId);
  }

  // Build messages array from conversation history
  const history = getHistory(channelId);
  const messages: Anthropic.MessageParam[] = history.map((msg: ConversationMessage) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Add the current message
  messages.push({ role: 'user', content: userMessage });

  // Get system prompt with context
  const systemPrompt = getSystemPrompt({
    channelId,
    planId: planId || undefined,
    domainExpertAvailable: options?.domainExpertAvailable,
  });

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: PLANNER_LEAD_TOOLS,
      messages,
    });

    // Handle tool use in a loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[planner-lead] Executing tool: ${toolUse.name}`);

        let result: ToolResult;
        if (storage) {
          result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            storage,
            channelId
          );
        } else {
          result = getMockToolResult(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Continue the conversation with tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: PLANNER_LEAD_TOOLS,
        messages,
      });
    }

    // Extract text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    return textBlocks.map((block) => block.text).join('\n') || 'I understand. How can I help with your planning?';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[planner-lead] Error generating response: ${message}`);
    return `I encountered an error processing your request. Please try again.`;
  }
}

/**
 * Generate a mock response when Anthropic API is not available.
 */
function generateMockResponse(userMessage: string, planId: string | null): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('status') || lowerMessage.includes('state')) {
    return planId
      ? `[Mock Mode] Plan ${planId} status: I would check the plan details here. Set ANTHROPIC_API_KEY for real responses.`
      : '[Mock Mode] I would list plan statuses here. Set ANTHROPIC_API_KEY for real responses.';
  }

  if (lowerMessage.includes('add') && lowerMessage.includes('step')) {
    return '[Mock Mode] I would help you add a step. Set ANTHROPIC_API_KEY for real responses.';
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('?')) {
    return `[Mock Mode] I'm PlannerLead, your planning assistant. I can help you:
- Read and understand plans
- Add or edit steps
- Suggest improvements

Set ANTHROPIC_API_KEY for real AI-powered responses.`;
  }

  return '[Mock Mode] PlannerLead received your message. Set ANTHROPIC_API_KEY for real responses.';
}

/**
 * Handle an incoming message.
 */
async function handleMessage(
  from: string,
  body: string,
  threadId?: string,
  data?: Record<string, unknown>
): Promise<void> {
  // Extract channel from data or thread
  let channelId = (data?.channel as string) || threadId;

  if (!shouldHandleMessage(from, body, channelId, data)) {
    return;
  }

  // Handle Interviewer domain answers and escalations (before normal flow)
  if (data?.fromAgent === 'ideation-interviewer' && channelId?.startsWith('#plan-')) {
    const messageType = data?.type as string | undefined;

    if (messageType === 'domain_answer') {
      console.log(`[planner-lead] Received domain answer from Interviewer in ${channelId}`);
      // Feed the answer back into the conversation and continue refining
      addMessage(channelId, 'user', `[Domain Expert Response]: ${body}`);
      const planId = extractPlanIdFromChannel(channelId);
      const response = await generateResponse(
        channelId,
        `The domain expert has answered your question: "${body}". Continue refining the plan with this information.`,
        planId,
        { domainExpertAvailable: true }
      );
      addMessage(channelId, 'assistant', response);
      sendChannelMessage(channelId, response);
      return;
    }

    if (messageType === 'escalation') {
      console.log(`[planner-lead] Received escalation from Interviewer in ${channelId}`);
      // Interviewer couldn't answer — escalate to user via QA queue
      const questionText = body.replace('[ESCALATE_TO_USER]', '').trim();
      const planId = extractPlanIdFromChannel(channelId);
      if (planId && storage) {
        const { executeAskUserQuestion } = await import('./planner-lead-tools/question-tools.js');
        await executeAskUserQuestion({
          agent_id: agentId || 'planner-lead',
          agent_role: 'planner-lead',
          plan_id: planId,
          text: questionText,
          blocking_level: 'soft_block',
        }, storage);
        console.log(`[planner-lead] Escalated to user QA queue: ${questionText.slice(0, 80)}`);
      }
      return;
    }

    if (messageType === 'interviewer_joined') {
      console.log(`[planner-lead] Interviewer joined plan channel ${channelId}`);
      // Note in conversation history — domain expert is now available
      addMessage(channelId, 'user', '[System] Domain expert (Interviewer) has joined this plan channel and can answer domain questions.');
      return;
    }
  }

  // For DMs from spawned agents, resolve their plan channel context
  // so the conversation has proper plan context for tool use
  if (!channelId && isAgentSpawned(from)) {
    const agentChannel = getSpawnedAgentChannel(from);
    if (agentChannel) {
      channelId = agentChannel;
      console.log(`[planner-lead] Resolved agent ${from} DM to channel ${channelId}`);
    }
  }

  console.log(`[planner-lead] Handling message from ${from} in ${channelId || 'DM'}`);

  // Update activity timestamp
  lastActivityTimestamp = new Date().toISOString();
  messagesProcessed++;

  // Emit working state when processing starts
  if (agentId) {
    emitAgentStatusUpdate(agentId, 'working', {
      activity: `Processing message from ${from}`,
      thought: body.slice(0, 100) + (body.length > 100 ? '...' : ''),
      // Include step with channel context when working on plan channels
      ...(channelId?.startsWith('#plan-') && { step: channelId }),
    });
  }

  // Extract plan ID if in a plan channel
  const planId = channelId ? extractPlanIdFromChannel(channelId) : null;

  // Add user message to history
  if (channelId) {
    addMessage(channelId, 'user', body);
  }

  try {
    // Check if domain expert is available for this channel
    const hasDomainExpert = channelId?.startsWith('#plan-') ? !!getSessionForPlanChannel(channelId) : false;

    // Generate response
    const response = await generateResponse(channelId || 'default', body, planId, { domainExpertAvailable: hasDomainExpert });

    // Add assistant response to history
    if (channelId) {
      addMessage(channelId, 'assistant', response);
    }

    // Send response - DM back to spawned agents, channel message for channels
    let sent: boolean;
    if (isAgentSpawned(from)) {
      // Agent DMs get a DM reply (even though channelId was resolved for context)
      sent = sendMessage(from, response, 'message');
    } else if (channelId?.startsWith('#')) {
      sent = sendChannelMessage(channelId, response);
    } else {
      sent = sendMessage(from, response, 'message', undefined, threadId);
    }

    if (!sent) {
      console.warn(`[planner-lead] Failed to send response to ${isAgentSpawned(from) ? from : (channelId || from)}`);
    }

    // Return to idle state after processing
    if (agentId) {
      emitAgentStatusUpdate(agentId, 'idle', {
        activity: 'Waiting for messages',
      });
    }
  } catch (error) {
    // Track error
    errorCount++;

    // Emit error state on failure
    if (agentId) {
      const message = error instanceof Error ? error.message : String(error);
      emitAgentStatusUpdate(agentId, 'error', {
        activity: `Error: ${message}`,
      });
    }
    throw error;
  }
}

/**
 * Send startup announcement to #planner channel.
 */
function announceStartup(): void {
  if (!isConnected()) {
    return;
  }

  const announcement = hasApiKey()
    ? 'PlannerLead online. Ready to help with your plans!'
    : 'PlannerLead online (mock mode). Set ANTHROPIC_API_KEY for AI-powered responses.';

  const sent = sendChannelMessage(PLANNER_CHANNEL, announcement);
  if (sent) {
    console.log('[planner-lead] Startup announcement sent');
  }
}

/**
 * Initialize PlannerLead service.
 * Call this on server startup with the storage instance.
 */
export function initPlannerLead(storageInstance: PlanStorage): void {
  if (initialized) {
    console.log('[planner-lead] Already initialized');
    return;
  }

  // Use the same name as the relay client for proper matching
  // This must match the agentName in client.ts ('Relay')
  agentId = 'Relay';

  storage = storageInstance;

  // Register message handler
  unsubscribeMessage = onMessage(handleMessage);

  // Announce when relay is ready
  if (getRelayMode() === 'connected') {
    announceStartup();
    // Emit agent_joined when already connected
    emitAgentJoined(agentId, PLANNER_LEAD_CONFIG.role, PLANNER_LEAD_CONFIG.displayName);
  }

  // Also announce on reconnection
  onStateChange((state: ClientState) => {
    if (state === 'READY') {
      announceStartup();
      // Emit agent_joined on reconnection
      if (agentId) {
        emitAgentJoined(agentId, PLANNER_LEAD_CONFIG.role, PLANNER_LEAD_CONFIG.displayName);
      }
    }
  });

  initialized = true;
  console.log('[planner-lead] PlannerLead service initialized');
}

/**
 * Stop PlannerLead service.
 */
export function stopPlannerLead(): void {
  if (!initialized) {
    return;
  }

  // Emit agent_left before cleanup
  if (agentId) {
    emitAgentLeft(agentId, 'shutdown');
  }

  if (unsubscribeMessage) {
    unsubscribeMessage();
    unsubscribeMessage = null;
  }

  storage = null;
  agentId = null;
  initialized = false;

  console.log('[planner-lead] PlannerLead service stopped');
}

/**
 * Check if PlannerLead is active.
 */
export function isPlannerLeadActive(): boolean {
  return initialized;
}

/**
 * Set whether @mention is required to respond.
 */
export function setRequireMention(require: boolean): void {
  PLANNER_LEAD_CONFIG.requireMention = require;
  console.log(`[planner-lead] Require mention: ${require}`);
}

/**
 * Get PlannerLead configuration.
 */
export function getPlannerLeadConfig(): typeof PLANNER_LEAD_CONFIG {
  return { ...PLANNER_LEAD_CONFIG };
}

// ============================================================================
// Question Handling Helpers
// ============================================================================

/**
 * Emit needs_input state when PlannerLead is waiting for user input.
 * This transitions the agent to the "needs_input" state, which shows a red ring
 * indicator in the status bar and signals that the agent is blocked on user response.
 *
 * @param questionText - The question being asked to the user
 *
 * @example
 * ```typescript
 * emitPendingQuestion("What scope should this plan target? (api-service, frontend, or both)");
 * ```
 */
export function emitPendingQuestion(questionText: string): void {
  if (agentId) {
    emitAgentStatusUpdate(agentId, 'needs_input', {
      activity: 'Waiting for user input',
      thought: questionText,
    });
  }
}

/**
 * Clear pending question state and return to idle.
 * Call this when the user has answered the question or when the question
 * is no longer relevant.
 *
 * @example
 * ```typescript
 * // After user responds to question
 * clearPendingQuestion();
 * ```
 */
export function clearPendingQuestion(): void {
  if (agentId) {
    emitAgentStatusUpdate(agentId, 'idle', {
      activity: 'Waiting for messages',
    });
  }
}

// ============================================================================
// Question Queue Integration
// ============================================================================

/**
 * Question priority levels for the question queue system.
 *
 * - `blocking`: Prevents plan progress until answered (e.g., critical design decision)
 * - `preference`: Important for quality but plan can proceed with defaults
 * - `confirmation`: Low-priority check-in, can be skipped if user is confident
 */
export type QuestionPriority = 'blocking' | 'preference' | 'confirmation';

/**
 * Event emitted when a question is added to the queue.
 */
interface QuestionAddedEvent {
  type: 'question_added';
  agentId: string;
  questionId: string;
  text: string;
  priority: QuestionPriority;
  timestamp: string;
}

/**
 * Event emitted when a question is answered.
 */
interface QuestionAnsweredEvent {
  type: 'question_answered';
  agentId: string;
  questionId: string;
  answer: string;
  timestamp: string;
}

/**
 * Emit a question to the relay question queue system.
 * This creates a structured question that can be displayed in the UI question queue,
 * tracked, and answered systematically.
 *
 * Automatically transitions the agent to 'needs_input' state via emitPendingQuestion().
 *
 * @param questionText - The question being asked
 * @param priority - Priority level ('blocking', 'preference', or 'confirmation')
 * @param planId - Optional plan ID to associate the question with (for trajectory tracking)
 * @returns The generated questionId for tracking
 *
 * @example
 * ```typescript
 * const qId = emitQuestion(
 *   "Should we add authentication to the API endpoints?",
 *   'preference',
 *   'plan-abc123'
 * );
 * // Later, when answered:
 * answerQuestion(qId, "Yes, add OAuth2");
 * ```
 */
export function emitQuestion(
  questionText: string,
  priority: QuestionPriority,
  planId?: string
): string {
  if (!agentId) {
    console.warn('[planner-lead] Cannot emit question: agent not initialized');
    return '';
  }

  // Generate unique question ID (timestamp-based for simplicity)
  const questionId = `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Store question metadata for trajectory tracking
  pendingQuestions.set(questionId, {
    questionText,
    priority,
    planId,
  });

  // Emit question_added event via relay broadcast
  const event: QuestionAddedEvent = {
    type: 'question_added',
    agentId,
    questionId,
    text: questionText,
    priority,
    timestamp: new Date().toISOString(),
  };

  sendMessage('*', event.type, 'question', event as unknown as Record<string, unknown>);

  // Transition agent to needs_input state
  emitPendingQuestion(questionText);

  console.log(`[planner-lead] Question emitted: ${questionId} (${priority})`);

  return questionId;
}

/**
 * Ask a question, but check trajectory first to avoid duplicates.
 * This function queries the user trajectory to see if a similar question
 * was already answered. If found, it returns the existing answer instead
 * of bothering the user again.
 *
 * This is the primary function to use for asking questions in PlannerLead.
 * It ensures intelligent question management by:
 * 1. Checking if the question was already answered
 * 2. Returning the previous answer if found
 * 3. Only emitting a new question if necessary
 *
 * @param planId - The plan ID to search for similar questions
 * @param questionText - The question text to ask
 * @param priority - Priority level for the question if it needs to be asked
 * @returns Either the existing TrajectoryEntry with the answer, or the new questionId
 *
 * @example
 * ```typescript
 * const result = askQuestion('plan-abc123', 'Should we add OAuth2?', 'blocking');
 *
 * if (typeof result === 'string') {
 *   // New question emitted, result is questionId
 *   console.log(`Waiting for answer to: ${result}`);
 * } else {
 *   // Found existing answer
 *   console.log(`Using previous answer: ${result.answer}`);
 * }
 * ```
 */
export function askQuestion(
  planId: string,
  questionText: string,
  priority: QuestionPriority
): string | TrajectoryEntry {
  // Check if similar question was already answered
  const existing = findSimilarQuestion(planId, questionText);
  if (existing) {
    console.log(`[planner-lead] Found existing answer for similar question: ${existing.answer}`);
    return existing; // Return the previous answer
  }

  // No existing answer, emit the question
  return emitQuestion(questionText, priority, planId);
}

/**
 * Record an answer to a previously asked question.
 * Emits a 'question_answered' event, stores the answer in the user trajectory,
 * and transitions the agent back to idle state.
 *
 * @param questionId - The ID of the question being answered
 * @param answer - The user's answer
 *
 * @example
 * ```typescript
 * answerQuestion('q-1234567890-abc123', 'Yes, proceed with OAuth2');
 * ```
 */
export function answerQuestion(
  questionId: string,
  answer: string
): void {
  if (!agentId) {
    console.warn('[planner-lead] Cannot answer question: agent not initialized');
    return;
  }

  // Retrieve question metadata from pending questions
  const questionMetadata = pendingQuestions.get(questionId);
  if (questionMetadata) {
    // Store in user trajectory if planId is available
    if (questionMetadata.planId) {
      addToTrajectory(questionMetadata.planId, {
        questionId,
        questionText: questionMetadata.questionText,
        answer,
        priority: questionMetadata.priority,
        agentId,
      });
    }

    // Remove from pending questions map
    pendingQuestions.delete(questionId);
  } else {
    console.warn(`[planner-lead] No metadata found for question: ${questionId}`);
  }

  // Emit question_answered event
  const event: QuestionAnsweredEvent = {
    type: 'question_answered',
    agentId,
    questionId,
    answer,
    timestamp: new Date().toISOString(),
  };

  sendMessage('*', event.type, 'question', event as unknown as Record<string, unknown>);

  // Clear needs_input state and return to idle
  clearPendingQuestion();

  console.log(`[planner-lead] Question answered: ${questionId}`);
}

// ============================================================================
// Legacy Exports
// ============================================================================

// Legacy exports for backwards compatibility (no-op for spawn-based API)
export const spawnPlannerLead = (): Promise<boolean> => {
  console.warn('[planner-lead] spawnPlannerLead is deprecated. Use initPlannerLead instead.');
  return Promise.resolve(false);
};

export const terminatePlannerLead = (): Promise<void> => {
  console.warn('[planner-lead] terminatePlannerLead is deprecated. Use stopPlannerLead instead.');
  return Promise.resolve();
};

export const getPlannerLeadAgentId = (): string | null => {
  return initialized ? agentId : null;
};

export const joinPlannerLeadToChannel = (_channelId: string): void => {
  // No-op - PlannerLead now listens to all messages via onMessage
  console.log('[planner-lead] joinPlannerLeadToChannel is no longer needed');
};

/**
 * Notify PlannerLead of a plan that's ready for refinement.
 * This triggers PlannerLead to review and improve the plan structure.
 */
export async function notifyPlanReady(
  channelId: string,
  planId: string,
  goal: string,
  options?: { context?: string; stepCount?: number; source?: string }
): Promise<void> {
  if (!initialized || !storage) {
    console.log('[planner-lead] Cannot notify: not initialized');
    return;
  }

  if (!isConnected()) {
    console.log('[planner-lead] Cannot notify: relay not connected');
    return;
  }

  console.log(`[planner-lead] Plan ready notification for ${planId} in ${channelId}`);

  const stepCount = options?.stepCount ?? 0;
  const context = options?.context;

  let prompt: string;

  if (stepCount === 0) {
    prompt = context
      ? `A new plan has been created with goal: "${goal}". Context: ${context}. Please read the plan, then add 3-4 initial steps to achieve this goal using the add_step tool. For each step, provide a clear title and description.`
      : `A new plan has been created with goal: "${goal}". Please read the plan, then add 3-4 initial steps to achieve this goal using the add_step tool. For each step, provide a clear title and description.`;
  } else {
    prompt = `New input has arrived for this plan (goal: "${goal}"). The plan now contains ${stepCount} steps.

Your job:

1. READ the plan. Understand what the user is trying to accomplish — the nature of the work (bug fix, new feature, greenfield project, refactor, infrastructure, research, etc.) and its likely scale and complexity.

2. ASSESS the steps as-given. Consider:
   - Are these well-formed actionable steps, or loose ideas that need decomposition?
   - Are there obvious gaps? (e.g., frontend changes with no API step, a deployment step with no testing step, database changes with no migration step)
   - Are dependencies between steps implicit but unstated?
   - Is the scope appropriate? A one-file bug fix needs 2-3 steps, not 15. A new application needs proper coverage across concerns.
   - Do steps have the right granularity? A step like "build the backend" is too coarse. A step like "add semicolon to line 4" is too fine.

3. ACT proportionally. Match your refinement to the complexity:
   - For small fixes: minimal structure. Don't over-plan what takes an hour. Maybe just add a verification step.
   - For moderate features: ensure dependencies are set, scopes are assigned, and nothing critical is missing.
   - For large projects: ensure proper phasing, identify risks, add acceptance criteria to key steps, and flag anything that needs human decision before proceeding.

4. INFER what you can. Set dependencies based on logical ordering. Add missing steps only where the gap is clear — don't invent work the user didn't ask for. For SCOPES: read the plan goal and step descriptions to understand what kind of project this is, then derive scopes from that domain. A macOS app has scopes like "ui", "networking", "persistence" — not "backend" and "frontend". A web app has "frontend", "api", "database". Always match the project's actual technology and domain.

5. When uncertain about intent, USE ask_domain_expert first if a domain expert is available — they have deep context from the brainstorming session. Only use ask_user_question for decisions that genuinely need human judgment.

Do not explain what you're about to do. Read the plan and start refining.`;
  }

  // Check if a domain expert (Interviewer) is available for this plan channel
  const domainExpertAvailable = !!getSessionForPlanChannel(channelId);
  if (domainExpertAvailable) {
    console.log(`[planner-lead] Domain expert available for ${channelId}`);
  }

  // Generate response using the AI
  const planIdPrefix = planId.slice(0, 8);
  const response = await generateResponse(channelId, prompt, planIdPrefix, { domainExpertAvailable });

  // Send response to the channel
  const sent = sendChannelMessage(channelId, response);
  if (sent) {
    console.log(`[planner-lead] Refinement message sent to ${channelId}`);
  } else {
    console.warn(`[planner-lead] Failed to send refinement message to ${channelId}`);
  }
}

// ============================================================================
// Health Check Exports
// ============================================================================

/**
 * Health status interface for PlannerLead.
 */
export interface PlannerLeadHealth {
  active: boolean;
  relay_connected: boolean;
  ai_available: boolean;
  last_activity: string | null;
  messages_processed: number;
  error_count: number;
  pending_questions_count: number;
}

/**
 * Get PlannerLead health status.
 */
export function getPlannerLeadHealth(): PlannerLeadHealth {
  return {
    active: initialized,
    relay_connected: isConnected(),
    ai_available: hasApiKey(),
    last_activity: lastActivityTimestamp,
    messages_processed: messagesProcessed,
    error_count: errorCount,
    pending_questions_count: pendingQuestions.size,
  };
}
