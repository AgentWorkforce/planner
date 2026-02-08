/**
 * Interviewer Service
 *
 * Main service coordinating the Interviewer's behavior.
 * Runs as a persistent service, not a spawn() agent.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { IdeationStorage } from '../storage/index.js';
import {
  INTERVIEWER_CONFIG,
  IDEATION_CHANNEL,
  sessionChannelId,
  isIdeationChannel,
  extractSessionPrefix,
  getLLMConfig,
} from './config.js';
import { getInterviewerPrompt, getWelcomeMessage } from './prompt.js';
import { INTERVIEWER_TOOLS, type ToolResult } from './tools.js';
import { executeTool, type ToolExecutorDeps } from './tool-executor.js';
import { conversationHistory } from './history.js';
import { specialistQueue, formatPendingInsights } from './specialist-queue.js';
import {
  onMessage as relayOnMessage,
  sendChannelMessage,
  isConnected as relayIsConnected,
  onStateChange as relayOnStateChange,
  getRelayMode,
  type ClientState,
} from '../relay/index.js';
import { ideationEvents } from '../api/events.js';
import { createTranscriptMessage } from '../domain/index.js';

// =============================================================================
// Types
// =============================================================================

export interface InterviewerDeps {
  storage: IdeationStorage;
  spawnAgent?: (sessionId: string, name: string, focus: string, context?: string) => Promise<string>;
  plannerClient?: import('../api/handlers.js').PlannerClient;
}

export interface InterviewerState {
  isActive: boolean;
  anthropic: Anthropic;
  relayConnected: boolean;
}

// =============================================================================
// Message Deduplication
// =============================================================================

/** TTL for message deduplication in milliseconds (30 seconds) */
const MESSAGE_DEDUP_TTL_MS = 30_000;

/** Max size of deduplication cache to prevent memory leaks */
const MESSAGE_DEDUP_MAX_SIZE = 100;

/**
 * Simple message deduplication cache.
 * Tracks message fingerprints with timestamps for TTL-based cleanup.
 */
class MessageDeduplicationCache {
  private cache = new Map<string, number>();

  /**
   * Check if message was recently processed. If not, marks it as processed.
   * @returns true if this is a duplicate, false if it's new
   */
  isDuplicate(channelId: string, body: string): boolean {
    const fingerprint = `${channelId}:${this.simpleHash(body)}`;
    const now = Date.now();

    // Clean up old entries
    this.cleanup(now);

    // Check if we've seen this recently
    if (this.cache.has(fingerprint)) {
      console.log(`[Interviewer] Duplicate message detected for ${channelId}`);
      return true;
    }

    // Mark as seen
    this.cache.set(fingerprint, now);
    return false;
  }

  private cleanup(now: number): void {
    // Remove expired entries
    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
        this.cache.delete(key);
      }
    }

    // Enforce max size (remove oldest if too large)
    if (this.cache.size > MESSAGE_DEDUP_MAX_SIZE) {
      const entries = [...this.cache.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - MESSAGE_DEDUP_MAX_SIZE);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  clear(): void {
    this.cache.clear();
  }
}

const messageDedup = new MessageDeduplicationCache();

// =============================================================================
// Interviewer Service
// =============================================================================

class InterviewerService {
  private state: InterviewerState | null = null;
  private deps: InterviewerDeps | null = null;
  private unsubscribeMessage: (() => void) | null = null;
  private unsubscribeStateChange: (() => void) | null = null;

  /**
   * Initialize the Interviewer service.
   * Requires ANTHROPIC_API_KEY environment variable.
   */
  init(deps: InterviewerDeps): void {
    this.deps = deps;

    // Log dependency availability for debugging
    console.log(`[Interviewer] Dependencies: plannerClient=${deps.plannerClient ? 'configured' : 'MISSING'}, spawnAgent=${deps.spawnAgent ? 'configured' : 'MISSING'}`);

    // Require API key - no mock mode
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[Interviewer] ANTHROPIC_API_KEY is required. ' +
        'Set it in your .env file to enable AI-powered brainstorming.'
      );
    }

    this.state = {
      isActive: false,
      anthropic: new Anthropic({
        apiKey,
        timeout: 60000, // 60 second timeout
      }),
      relayConnected: false,
    };
    console.log(`[Interviewer] Anthropic client initialized with API key (${apiKey.substring(0, 10)}...)`);

    // Register relay message handler
    console.log('[Interviewer] Registering relay message handler');
    this.unsubscribeMessage = relayOnMessage(this.handleRelayMessage.bind(this));
    console.log('[Interviewer] Relay message handler registered');

    // Subscribe to relay state changes
    this.unsubscribeStateChange = relayOnStateChange((state: ClientState) => {
      const wasConnected = this.state!.relayConnected;
      this.state!.relayConnected = state === 'connected';

      if (!wasConnected && this.state!.relayConnected) {
        console.log('[Interviewer] Relay connected');
        this.announceStartup();
      }
    });

    // Check initial relay state
    this.state!.relayConnected = relayIsConnected();

    this.state.isActive = true;
    console.log(`[Interviewer] Initialized (relay=${getRelayMode()})`);

    // Announce if relay is already connected
    if (this.state.relayConnected) {
      this.announceStartup();
    }
  }

  /**
   * Stop the Interviewer service.
   */
  stop(): void {
    // Unsubscribe from relay events
    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
      this.unsubscribeMessage = null;
    }
    if (this.unsubscribeStateChange) {
      this.unsubscribeStateChange();
      this.unsubscribeStateChange = null;
    }

    if (this.state) {
      this.state.isActive = false;
      this.state.relayConnected = false;
    }
    conversationHistory.clearAll();
    specialistQueue.clearAll();
    messageDedup.clear();
    console.log('[Interviewer] Stopped');
  }

  /**
   * Check if the Interviewer is active.
   */
  isActive(): boolean {
    return this.state?.isActive ?? false;
  }

  /**
   * Set the spawnAgent function for spawning specialists.
   * Called after relay connects to inject the real spawner.
   */
  setSpawnAgent(fn: InterviewerDeps['spawnAgent']): void {
    if (this.deps) {
      this.deps.spawnAgent = fn;
      console.log('[Interviewer] spawnAgent function injected');
    } else {
      console.warn('[Interviewer] Cannot set spawnAgent: deps not initialized');
    }
  }

  /**
   * Check if we should handle a message from a channel.
   */
  shouldHandleMessage(channelId: string, fromAgent?: string): boolean {
    // Only handle ideation channels
    if (!isIdeationChannel(channelId)) return false;

    // Don't respond to our own messages
    if (fromAgent === INTERVIEWER_CONFIG.agentId) return false;

    // Don't respond to messages from the server relay (prevents loops)
    // These messages are from API handlers that already invoke us directly
    if (fromAgent === 'Relay') return false;

    return true;
  }

  /**
   * Handle incoming relay messages.
   * Routes messages from relay channels to handleMessage.
   */
  private async handleRelayMessage(
    from: string,
    body: string,
    threadId?: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    // Extract channel from data
    const channelId = (data?.channel as string) || threadId;

    console.log(`[Interviewer] handleRelayMessage: from=${from}, channelId=${channelId}, body="${body.substring(0, 50)}..."`);

    if (!channelId) {
      console.log(`[Interviewer] Skipping: no channelId`);
      return;
    }

    // Handle plan channel messages (domain questions from PlannerLead)
    if (data?.planContext === true && data?.sessionId) {
      console.log(`[Interviewer] Plan channel message in ${channelId} for session ${data.sessionId}`);
      await this.handlePlanChannelMessage(
        channelId,
        body,
        from,
        data.sessionId as string
      );
      return;
    }

    if (!this.shouldHandleMessage(channelId, from)) {
      console.log(`[Interviewer] Skipping: shouldHandleMessage returned false for ${channelId} from ${from}`);
      return;
    }

    // Check for duplicate messages (prevents relay loops)
    if (messageDedup.isDuplicate(channelId, body)) {
      console.log(`[Interviewer] Skipping duplicate message in ${channelId}`);
      return;
    }

    console.log(`[Interviewer] Processing message from ${from} in ${channelId}`);

    try {
      const response = await this.handleMessage(channelId, body, from);

      if (response) {
        // Store response in DB so frontend can see it
        const sessionPrefix = extractSessionPrefix(channelId);
        if (sessionPrefix && this.deps) {
          const sessions = await this.deps.storage.listSessions({ status: 'active' });
          const session = sessions.find(s => s.id.startsWith(sessionPrefix));
          if (session) {
            const message = createTranscriptMessage('assistant', response);
            const updatedSession = await this.deps.storage.appendTranscript(session.id, message);
            // Emit event so SSE clients get notified
            ideationEvents.emitSessionEvent('session:message', updatedSession);
          }
        }

        // Also send via relay for real-time delivery
        if (this.state?.relayConnected) {
          const sent = sendChannelMessage(channelId, response);
          if (!sent) {
            console.warn(`[Interviewer] Failed to send response to ${channelId}`);
          }
        }
      }
    } catch (error) {
      console.error('[Interviewer] Error handling relay message:', error);
    }
  }

  /**
   * Send startup announcement to #ideation channel.
   */
  private announceStartup(): void {
    if (!this.state?.relayConnected) {
      return;
    }

    const announcement = 'Interviewer online. Ready to facilitate your brainstorming sessions!';

    const sent = sendChannelMessage(IDEATION_CHANNEL, announcement);
    if (sent) {
      console.log('[Interviewer] Startup announcement sent');
    }
  }

  /**
   * Handle an incoming message.
   * @param channelId - The channel ID for this session
   * @param content - The message content
   * @param fromAgent - Who sent the message. 'api-handler' means the API handler will store messages.
   */
  async handleMessage(
    channelId: string,
    content: string,
    fromAgent?: string
  ): Promise<string | null> {
    if (!this.deps) {
      console.error('[Interviewer] Not initialized');
      return null;
    }

    // Check if this is from a specialist
    // Note: Uses explicit parentheses to ensure correct precedence
    if (fromAgent && (fromAgent.startsWith('mock-') || fromAgent.includes('specialist'))) {
      // Queue specialist input, don't respond
      this.handleSpecialistMessage(channelId, content, fromAgent);
      return null;
    }

    // Get session ID from channel
    const sessionPrefix = extractSessionPrefix(channelId);
    if (!sessionPrefix) {
      // Main ideation channel - not a session-specific message
      return null;
    }

    // Find session by prefix
    const sessions = await this.deps.storage.listSessions({ status: 'active' });
    const session = sessions.find(s => s.id.startsWith(sessionPrefix));
    if (!session) {
      return "I couldn't find an active session. Would you like to start a new brainstorming session?";
    }

    // Hydrate conversation history from DB if empty (e.g., after server restart).
    // When fromAgent='api-handler', the handler already stored this user message in DB,
    // so the transcript will include it — skip the addMessage to avoid duplicates.
    let needsAdd = true;
    if (!conversationHistory.hasHistory(channelId) && session.transcript.length > 0) {
      conversationHistory.hydrateFromTranscript(channelId, session.transcript);
      if (fromAgent === 'api-handler') {
        // Transcript already includes the current user message — hydration covered it
        needsAdd = false;
      }
    }

    // Add user message to history (unless hydration already included it)
    if (needsAdd) {
      conversationHistory.addMessage(channelId, 'user', content);
    }

    // Determine if API handler is managing message storage
    // When fromAgent === 'api-handler', the API stores user/assistant messages
    const skipMessageStorage = fromAgent === 'api-handler';

    // Generate response
    const response = await this.generateResponse(channelId, content, session.id, skipMessageStorage);

    // Add assistant response to history
    if (response) {
      conversationHistory.addMessage(channelId, 'assistant', response);
    }

    return response;
  }

  /**
   * Handle a message from a specialist agent.
   * Parse and queue for Interviewer to weave into conversation.
   */
  private handleSpecialistMessage(channelId: string, content: string, fromAgent: string): void {
    const sessionPrefix = extractSessionPrefix(channelId);
    if (!sessionPrefix) return;

    // Parse specialist name from agent ID
    const specialistName = fromAgent.replace(/^mock-/, '').split('-')[0] ?? 'Unknown';

    // Simple parsing - look for question/observation/concern markers
    let type: 'question' | 'observation' | 'concern' = 'observation';
    let priority = 5;

    if (content.toLowerCase().includes('question:') || content.includes('?')) {
      type = 'question';
      priority = 8;
    } else if (content.toLowerCase().includes('concern:') || content.toLowerCase().includes('risk:')) {
      type = 'concern';
      priority = 10;
    }

    // Queue for later weaving
    specialistQueue.queueInput(sessionPrefix, {
      specialist_name: specialistName,
      type,
      content: content.replace(/^(question|observation|concern):/i, '').trim(),
      priority,
    });
  }

  /**
   * Handle a message from a plan channel (domain question from PlannerLead).
   */
  private async handlePlanChannelMessage(
    planChannelId: string,
    question: string,
    fromAgent: string,
    sessionId: string
  ): Promise<void> {
    if (!this.deps) {
      console.error('[Interviewer] Cannot handle plan channel message: not initialized');
      return;
    }

    const session = await this.deps.storage.getSession(sessionId);
    if (!session) {
      console.warn(`[Interviewer] Session not found for plan channel: ${sessionId}`);
      this.sendPlanChannelResponse(planChannelId,
        '[ESCALATE_TO_USER] I cannot find the brainstorming session context for this plan.');
      return;
    }

    console.log(`[Interviewer] Generating domain answer for plan channel ${planChannelId}`);

    const answer = await this.generateDomainAnswer(question, session);
    this.sendPlanChannelResponse(planChannelId, answer);

    // Narrate to user in session channel
    const sessChannelId = sessionChannelId(sessionId);
    const narration = 'The planning assistant asked about your project and I was able to help based on our brainstorming conversation.';
    if (this.state?.relayConnected) {
      sendChannelMessage(sessChannelId, narration);
    }
  }

  /**
   * Generate an answer to a domain question using session context.
   */
  private async generateDomainAnswer(
    question: string,
    session: {
      source: { initial_intent: string };
      understanding?: Record<string, unknown>;
      synthesized?: {
        idea_summary?: string;
        specialist_perspectives?: Record<string, { take: string; concerns?: string[]; confidence?: number }>;
      };
      blocks?: Array<{ id: string; status: string; keyword?: string; content?: string }>;
    }
  ): Promise<string> {
    if (!this.state?.anthropic) {
      return '[ESCALATE_TO_USER] AI service unavailable — please answer this question directly.';
    }

    const understandingStr = session.understanding
      ? JSON.stringify(session.understanding, null, 2)
      : 'No understanding data available';

    const perspectivesStr = session.synthesized?.specialist_perspectives
      ? Object.entries(session.synthesized.specialist_perspectives)
          .map(([name, p]) => `- ${name}: ${p.take}${p.concerns?.length ? ` (concerns: ${p.concerns.join(', ')})` : ''}`)
          .join('\n')
      : 'No specialist perspectives available';

    const blocksStr = (session.blocks || [])
      .filter(b => b.status === 'curated' || b.status === 'graduated')
      .map(b => `- ${b.keyword || 'Untitled'}: ${b.content || ''}`)
      .join('\n') || 'No curated blocks available';

    const systemPrompt = `You are answering a domain question from the Planning Assistant about a plan created from the brainstorming session "${session.synthesized?.idea_summary || session.source.initial_intent}".

## Your Session Knowledge

### Understanding
${understandingStr}

### Specialist Perspectives
${perspectivesStr}

### Curated Blocks (key insights)
${blocksStr}

## Instructions
Answer the Planning Assistant's question using ONLY the session knowledge above.
Be concise and factual. Do not speculate beyond what the session data supports.
If you genuinely cannot answer from this context, respond with exactly:
[ESCALATE_TO_USER] followed by a rephrased version of the question suitable for the user.`;

    try {
      const llmConfig = await getLLMConfig();
      const response = await this.state.anthropic.messages.create({
        model: llmConfig.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text || '[ESCALATE_TO_USER] Unable to generate answer.';
    } catch (error) {
      console.error('[Interviewer] Error generating domain answer:', error);
      return '[ESCALATE_TO_USER] I encountered an error while trying to answer. Please answer this question directly.';
    }
  }

  /**
   * Send a response to a plan channel with proper agent identification.
   */
  private sendPlanChannelResponse(planChannelId: string, message: string): void {
    if (!this.state?.relayConnected) {
      console.warn(`[Interviewer] Cannot send plan channel response: relay not connected`);
      return;
    }

    const isEscalation = message.startsWith('[ESCALATE_TO_USER]');
    const sent = sendChannelMessage(planChannelId, message, {
      fromAgent: INTERVIEWER_CONFIG.agentId,
      type: isEscalation ? 'escalation' : 'domain_answer',
    });

    if (sent) {
      console.log(`[Interviewer] ${isEscalation ? 'Escalation' : 'Domain answer'} sent to ${planChannelId}`);
    } else {
      console.warn(`[Interviewer] Failed to send response to ${planChannelId}`);
    }
  }

  /**
   * Generate a response using the LLM.
   * @param channelId - The channel ID for this session
   * @param userMessage - The user's message
   * @param sessionId - The session ID
   * @param skipMessageStorage - If true, don't store messages (API handler does it)
   */
  async generateResponse(
    channelId: string,
    userMessage: string,
    sessionId: string,
    skipMessageStorage = false
  ): Promise<string> {
    if (!this.deps) throw new Error('Interviewer not initialized');
    if (!this.state) throw new Error('Interviewer state not initialized');

    // Get session for context
    const session = await this.deps.storage.getSession(sessionId);
    const activeSpecialists = session?.active_specialists.map(s => s.name) ?? [];

    // Compute block counts for prompt context (cheap — just counts, not full data)
    const blocks = session?.blocks || [];
    const blockCounts = blocks.length > 0
      ? {
          forming: blocks.filter((b: Record<string, unknown>) => b.status !== 'curated' && b.status !== 'graduated').length,
          curated: blocks.filter((b: Record<string, unknown>) => b.status === 'curated').length,
          graduated: blocks.filter((b: Record<string, unknown>) => b.status === 'graduated').length,
        }
      : undefined;

    // Build prompt context (pendingInsights text is appended later)
    const promptContext = {
      sessionId,
      channelId,
      initialIntent: session?.source.initial_intent,
      understanding: session?.understanding,
      activeSpecialists,
      blockCounts,
    };

    // Build system prompt
    const systemPrompt = getInterviewerPrompt(promptContext);
    const pendingInsightText = formatPendingInsights(sessionId.slice(0, 8));
    const fullSystemPrompt = pendingInsightText
      ? `${systemPrompt}${pendingInsightText}`
      : systemPrompt;

    const messages = conversationHistory.getAnthropicMessages(channelId);

    // When called from API handler, filter out add_message tool
    // The API handler stores messages, so LLM shouldn't duplicate
    const tools = skipMessageStorage
      ? INTERVIEWER_TOOLS.filter(t => t.name !== 'add_message')
      : INTERVIEWER_TOOLS;

    try {
      const llmConfig = await getLLMConfig();
      console.log(`[Interviewer] Calling Anthropic API: model=${llmConfig.model}, messages=${messages.length}, tools=${tools.length}`);
      const startTime = Date.now();
      const response = await this.state.anthropic.messages.create({
        model: llmConfig.model,
        max_tokens: llmConfig.maxTokens,
        system: fullSystemPrompt,
        tools,
        messages,
      });
      console.log(`[Interviewer] Anthropic responded in ${Date.now() - startTime}ms, stop_reason=${response.stop_reason}`);
      console.log(`[Interviewer] Response content blocks: ${response.content.length}, types: ${response.content.map(b => b.type).join(', ')}`);

      // Handle tool use in a loop.
      // The model may return multiple tool_use blocks per response — we must
      // execute ALL of them and send ALL tool_results back, or the API errors.
      let result = response;
      let loopCount = 0;
      let alreadyActiveCount = 0;
      const maxLoops = 5;
      const maxAlreadyActive = 1;
      // Accumulate messages for the full tool conversation
      const toolMessages: Anthropic.MessageParam[] = [...messages];

      while (result.stop_reason === 'tool_use' && loopCount < maxLoops) {
        loopCount++;

        // Collect ALL tool_use blocks from this response
        const toolUseBlocks = result.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          console.log('[Interviewer] No tool_use blocks found despite stop_reason=tool_use, breaking');
          break;
        }

        console.log(`[Interviewer] Tool loop iteration ${loopCount}: ${toolUseBlocks.length} tool(s): ${toolUseBlocks.map(b => b.name).join(', ')}`);

        // Execute ALL tool_use blocks and collect results
        const toolResultContents: Anthropic.ToolResultBlockParam[] = [];
        let shouldBreak = false;

        for (const toolBlock of toolUseBlocks) {
          console.log(`[Interviewer] Executing tool: ${toolBlock.name} (id=${toolBlock.id})`);

          // Skip add_message in API context
          if (skipMessageStorage && toolBlock.name === 'add_message') {
            console.log('[Interviewer] Skipping add_message in API context');
            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify({ success: true, data: { skipped: true } }),
            });
            continue;
          }

          const toolResult = await this.executeToolSafe(toolBlock.name, toolBlock.input);
          console.log(`[Interviewer] Tool ${toolBlock.name} result: ${JSON.stringify(toolResult).substring(0, 100)}`);

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(toolResult),
          });

          // Track already-active specialists
          if (toolBlock.name === 'spawn_specialist' && (toolResult?.data as { already_active?: boolean })?.already_active) {
            alreadyActiveCount++;
            if (alreadyActiveCount >= maxAlreadyActive) {
              console.log('[Interviewer] Breaking - specialist already active');
              shouldBreak = true;
            }
          }
        }

        // Add assistant response + ALL tool results to conversation
        toolMessages.push({ role: 'assistant', content: result.content });
        toolMessages.push({ role: 'user', content: toolResultContents });

        if (shouldBreak) break;

        try {
          console.log('[Interviewer] Continuing with tool results');
          const continueStartTime = Date.now();
          result = await this.state.anthropic.messages.create({
            model: llmConfig.model,
            max_tokens: llmConfig.maxTokens,
            system: fullSystemPrompt,
            tools,
            messages: toolMessages,
          });
          console.log(`[Interviewer] Continuation: ${Date.now() - continueStartTime}ms, stop_reason=${result.stop_reason}, types: ${result.content.map(b => b.type).join(', ')}`);
        } catch (toolError) {
          const toolErrorMsg = toolError instanceof Error ? toolError.message : String(toolError);
          console.error(`[Interviewer] Error in tool loop: ${toolErrorMsg}`);
          break;
        }
      }

      // Extract text response
      const textBlock = result.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      if (!textBlock?.text) {
        throw new Error('[Interviewer] LLM returned no text response');
      }
      const responseText = textBlock.text;

      // Clear used insights
      while (specialistQueue.getNextInput(sessionId.slice(0, 8))) {
        // Consume all queued inputs that were used
      }

      return responseText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
      console.error(`[Interviewer] LLM error (${errorName}): ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[Interviewer] Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }

      // FAIL LOUDLY - report the actual error
      return `⚠️ Error: ${errorMessage}`;
    }
  }

  /**
   * Execute a tool safely, handling errors.
   */
  private async executeToolSafe(name: string, input: unknown): Promise<ToolResult> {
    if (!this.deps) {
      return { success: false, error: 'Interviewer not initialized' };
    }

    const toolDeps: ToolExecutorDeps = {
      storage: this.deps.storage,
      spawnAgent: this.deps.spawnAgent,
      plannerClient: this.deps.plannerClient,
    };

    return executeTool(name, input, toolDeps);
  }

  /**
   * Send a welcome message when a new session starts.
   * Note: The welcome message is NOT added to conversation history because:
   * 1. It's a one-time greeting, not part of the conversation context
   * 2. Anthropic API requires conversations to start with a 'user' message
   * 3. Including it would cause the first user message to fail
   */
  async notifyNewSession(sessionId: string, initialIntent: string): Promise<void> {
    if (!this.state?.relayConnected) {
      console.log('[Interviewer] Cannot send welcome: relay not connected');
      return;
    }

    const channelId = sessionChannelId(sessionId);
    const welcome = getWelcomeMessage(initialIntent);

    const sent = sendChannelMessage(channelId, welcome);
    if (!sent) {
      console.warn(`[Interviewer] Failed to send welcome message to ${channelId}`);
    }
    // Note: Intentionally NOT adding to conversationHistory to maintain valid message sequence
  }
}

// Singleton instance
export const interviewer = new InterviewerService();

// =============================================================================
// Convenience Functions
// =============================================================================

export function initInterviewer(deps: InterviewerDeps): void {
  interviewer.init(deps);
}

export function stopInterviewer(): void {
  interviewer.stop();
}

export function isInterviewerActive(): boolean {
  return interviewer.isActive();
}
