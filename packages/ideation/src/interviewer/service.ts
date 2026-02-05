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
      const wasConnected = this.state.relayConnected;
      this.state.relayConnected = state === 'connected';

      if (!wasConnected && this.state.relayConnected) {
        console.log('[Interviewer] Relay connected');
        this.announceStartup();
      }
    });

    // Check initial relay state
    this.state.relayConnected = relayIsConnected();

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

    // Add user message to history
    conversationHistory.addMessage(channelId, 'user', content);

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

    // Build prompt context (pendingInsights text is appended later)
    const promptContext = {
      sessionId,
      channelId,
      initialIntent: session?.source.initial_intent,
      understanding: session?.understanding,
      activeSpecialists,
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
      const llmConfig = getLLMConfig();
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

      // Handle tool use in a loop
      let result = response;
      let loopCount = 0;
      let alreadyActiveCount = 0;
      const maxLoops = 10; // Safety limit
      const maxAlreadyActive = 2; // Break if we keep trying to spawn already-active specialists

      while (result.stop_reason === 'tool_use' && loopCount < maxLoops) {
        loopCount++;
        console.log(`[Interviewer] Tool use loop iteration ${loopCount}, content types: ${result.content.map(b => b.type).join(', ')}`);

        const toolUseBlock = result.content.find(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (!toolUseBlock) {
          console.log('[Interviewer] No tool_use block found despite stop_reason=tool_use, breaking loop');
          console.log(`[Interviewer] Full content: ${JSON.stringify(result.content).substring(0, 500)}`);
          break;
        }

        console.log(`[Interviewer] Tool use requested: ${toolUseBlock.name}, id=${toolUseBlock.id}`);
        console.log(`[Interviewer] Tool input: ${JSON.stringify(toolUseBlock.input).substring(0, 200)}`);

        // Skip add_message tool execution if in API context (shouldn't happen since filtered)
        if (skipMessageStorage && toolUseBlock.name === 'add_message') {
          console.log('[Interviewer] Skipping add_message tool in API context');
          break;
        }

        try {
          const toolResult = await this.executeToolSafe(toolUseBlock.name, toolUseBlock.input);
          console.log(`[Interviewer] Tool ${toolUseBlock.name} result: ${JSON.stringify(toolResult).substring(0, 100)}`);

          // Track already_active responses and break if stuck in a loop
          if (toolUseBlock.name === 'spawn_specialist' && toolResult?.data?.already_active) {
            alreadyActiveCount++;
            console.log(`[Interviewer] Specialist already active (count: ${alreadyActiveCount}/${maxAlreadyActive})`);
            if (alreadyActiveCount >= maxAlreadyActive) {
              console.log('[Interviewer] Breaking tool loop - too many already_active responses');
              break;
            }
          } else {
            alreadyActiveCount = 0; // Reset on successful tool use
          }

          // Continue conversation with tool result
          console.log('[Interviewer] Calling Anthropic API for tool result continuation');
          const continueStartTime = Date.now();
          result = await this.state.anthropic.messages.create({
            model: llmConfig.model,
            max_tokens: llmConfig.maxTokens,
            system: fullSystemPrompt,
            tools,
            messages: [
              ...messages,
              { role: 'assistant', content: result.content },
              {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUseBlock.id,
                    content: JSON.stringify(toolResult),
                  },
                ],
              },
            ],
          });
          console.log(`[Interviewer] Continuation responded in ${Date.now() - continueStartTime}ms, stop_reason=${result.stop_reason}`);
          console.log(`[Interviewer] Continuation content types: ${result.content.map(b => b.type).join(', ')}`);
        } catch (toolError) {
          const toolErrorMsg = toolError instanceof Error ? toolError.message : String(toolError);
          console.error(`[Interviewer] Error in tool loop: ${toolErrorMsg}`);
          if (toolError instanceof Error && toolError.stack) {
            console.error(`[Interviewer] Tool loop stack: ${toolError.stack.split('\n').slice(0, 5).join('\n')}`);
          }
          // Break the loop on error rather than crashing
          break;
        }
      }

      // Extract text response
      let textBlock = result.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      // Check if text is actually an XML-style tool invocation (model quirk)
      const isXmlToolInvocation = (text: string | undefined) =>
        text && (text.includes('<invoke name=') || text.includes('<function_call>'));

      // If no text response OR text is an XML tool invocation, retry without tools
      if (!textBlock?.text || isXmlToolInvocation(textBlock.text)) {
        const reason = !textBlock?.text ? 'No text in response' : 'Text contains XML tool invocation';
        console.log(`[Interviewer] ${reason}, making final call without tools`);
        // Use original messages WITHOUT the tool_use response (avoid tool_use/tool_result mismatch)
        const finalResult = await this.state.anthropic.messages.create({
          model: llmConfig.model,
          max_tokens: llmConfig.maxTokens,
          system: fullSystemPrompt + '\n\nIMPORTANT: You have already used tools to spawn specialists and update understanding. Now respond CONVERSATIONALLY to the user. Do NOT output XML, tool invocations, or function calls. Just speak naturally.',
          messages, // Original messages without the tool-heavy response
        });

        textBlock = finalResult.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
      }

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
