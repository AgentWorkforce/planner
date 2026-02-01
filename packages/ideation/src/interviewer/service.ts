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
  LLM_CONFIG,
} from './config.js';
import { getInterviewerPrompt, getWelcomeMessage, getMockResponse } from './prompt.js';
import { INTERVIEWER_TOOLS, type ToolResult } from './tools.js';
import { executeTool, getMockToolResult, type ToolExecutorDeps } from './tool-executor.js';
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
  anthropic: Anthropic | null;
  mockMode: boolean;
  relayConnected: boolean;
}

// =============================================================================
// Interviewer Service
// =============================================================================

class InterviewerService {
  private state: InterviewerState = {
    isActive: false,
    anthropic: null,
    mockMode: true,
    relayConnected: false,
  };
  private deps: InterviewerDeps | null = null;
  private unsubscribeMessage: (() => void) | null = null;
  private unsubscribeStateChange: (() => void) | null = null;

  /**
   * Initialize the Interviewer service.
   */
  init(deps: InterviewerDeps): void {
    this.deps = deps;

    // Try to initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.state.anthropic = new Anthropic({ apiKey });
      this.state.mockMode = false;
    } else {
      console.log('[Interviewer] No ANTHROPIC_API_KEY - running in mock mode');
      this.state.mockMode = true;
    }

    // Register relay message handler
    this.unsubscribeMessage = relayOnMessage(this.handleRelayMessage.bind(this));

    // Subscribe to relay state changes
    this.unsubscribeStateChange = relayOnStateChange((state: ClientState) => {
      const wasConnected = this.state.relayConnected;
      this.state.relayConnected = state === 'READY';

      if (!wasConnected && this.state.relayConnected) {
        console.log('[Interviewer] Relay connected');
        this.announceStartup();
      }
    });

    // Check initial relay state
    this.state.relayConnected = relayIsConnected();

    this.state.isActive = true;
    console.log(`[Interviewer] Initialized (mock=${this.state.mockMode}, relay=${getRelayMode()})`);

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

    this.state.isActive = false;
    this.state.relayConnected = false;
    conversationHistory.clearAll();
    specialistQueue.clearAll();
    console.log('[Interviewer] Stopped');
  }

  /**
   * Check if the Interviewer is active.
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Check if running in mock mode.
   */
  isMockMode(): boolean {
    return this.state.mockMode;
  }

  /**
   * Check if we should handle a message from a channel.
   */
  shouldHandleMessage(channelId: string, fromAgent?: string): boolean {
    // Only handle ideation channels
    if (!isIdeationChannel(channelId)) return false;

    // Don't respond to our own messages
    if (fromAgent === INTERVIEWER_CONFIG.agentId) return false;

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

    if (!channelId || !this.shouldHandleMessage(channelId, from)) {
      return;
    }

    console.log(`[Interviewer] Received message from ${from} in ${channelId}`);

    try {
      const response = await this.handleMessage(channelId, body, from);

      if (response && this.state.relayConnected) {
        // Send response via relay
        const sent = sendChannelMessage(channelId, response);
        if (!sent) {
          console.warn(`[Interviewer] Failed to send response to ${channelId}`);
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
    if (!this.state.relayConnected) {
      return;
    }

    const announcement = this.state.mockMode
      ? 'Interviewer online (mock mode). Set ANTHROPIC_API_KEY for AI-powered brainstorming.'
      : 'Interviewer online. Ready to facilitate your brainstorming sessions!';

    const sent = sendChannelMessage(IDEATION_CHANNEL, announcement);
    if (sent) {
      console.log('[Interviewer] Startup announcement sent');
    }
  }

  /**
   * Handle an incoming message.
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
    if (fromAgent && fromAgent.startsWith('mock-') || fromAgent?.includes('specialist')) {
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

    // Generate response
    const response = await this.generateResponse(channelId, content, session.id);

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
   * Generate a response using LLM or mock.
   */
  async generateResponse(
    channelId: string,
    userMessage: string,
    sessionId: string
  ): Promise<string> {
    if (!this.deps) throw new Error('Interviewer not initialized');

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

    // Mock mode
    if (this.state.mockMode || !this.state.anthropic) {
      // Record user message
      await this.executeToolSafe('add_message', {
        session_id: sessionId,
        role: 'user',
        content: userMessage,
      });

      const response = getMockResponse(userMessage);

      // Record assistant response
      await this.executeToolSafe('add_message', {
        session_id: sessionId,
        role: 'assistant',
        content: response,
      });

      return response;
    }

    // Real LLM mode
    const systemPrompt = getInterviewerPrompt(promptContext);
    const pendingInsightText = formatPendingInsights(sessionId.slice(0, 8));
    const fullSystemPrompt = pendingInsightText
      ? `${systemPrompt}${pendingInsightText}`
      : systemPrompt;

    const messages = conversationHistory.getAnthropicMessages(channelId);

    try {
      const response = await this.state.anthropic.messages.create({
        model: LLM_CONFIG.model,
        max_tokens: LLM_CONFIG.maxTokens,
        system: fullSystemPrompt,
        tools: INTERVIEWER_TOOLS,
        messages,
      });

      // Handle tool use in a loop
      let result = response;
      while (result.stop_reason === 'tool_use') {
        const toolUseBlock = result.content.find(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (!toolUseBlock) break;

        const toolResult = await this.executeToolSafe(toolUseBlock.name, toolUseBlock.input);

        // Continue conversation with tool result
        result = await this.state.anthropic.messages.create({
          model: LLM_CONFIG.model,
          max_tokens: LLM_CONFIG.maxTokens,
          system: fullSystemPrompt,
          tools: INTERVIEWER_TOOLS,
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
      }

      // Extract text response
      const textBlock = result.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      const responseText = textBlock?.text ?? "I'm not sure how to respond to that.";

      // Clear used insights
      while (specialistQueue.getNextInput(sessionId.slice(0, 8))) {
        // Consume all queued inputs that were used
      }

      return responseText;
    } catch (error) {
      console.error('[Interviewer] LLM error:', error);
      return getMockResponse(userMessage);
    }
  }

  /**
   * Execute a tool safely, handling errors.
   */
  private async executeToolSafe(name: string, input: unknown): Promise<ToolResult> {
    if (!this.deps) {
      return { success: false, error: 'Interviewer not initialized' };
    }

    if (this.state.mockMode) {
      return getMockToolResult(name, input);
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
   */
  async notifyNewSession(sessionId: string, initialIntent: string): Promise<void> {
    if (!this.state.relayConnected) {
      console.log('[Interviewer] Cannot send welcome: relay not connected');
      return;
    }

    const channelId = sessionChannelId(sessionId);
    const welcome = getWelcomeMessage(initialIntent);

    const sent = sendChannelMessage(channelId, welcome);
    if (sent) {
      conversationHistory.addMessage(channelId, 'assistant', welcome);
    } else {
      console.warn(`[Interviewer] Failed to send welcome message to ${channelId}`);
    }
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
