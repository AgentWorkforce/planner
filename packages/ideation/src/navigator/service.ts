/**
 * Navigator Service
 *
 * Main service for the Navigator agent - a workflow guide that helps users
 * decide what to work on next. Simpler than Interviewer: just chat interface,
 * no relay integration, no specialist spawning.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { IdeationStorage } from '../storage/index.js';
import { getNavigatorPrompt } from './prompt.js';
import { NAVIGATOR_TOOLS } from './tools.js';
import type {
  NavigatorToolResult,
  ListSessionsInput,
  ListSessionsResult,
  RecommendActionInput,
  RecommendActionResult,
  StartNewSessionInput,
  StartNewSessionResult,
} from './tools.js';

// =============================================================================
// Configuration
// =============================================================================

const LLM_CONFIG = {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
} as const;

// =============================================================================
// Types
// =============================================================================

export interface NavigatorDeps {
  storage: IdeationStorage;
}

export interface NavigatorState {
  isActive: boolean;
  anthropic: Anthropic;
}

/**
 * Message in conversation history.
 * Follows Anthropic's message format.
 */
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// =============================================================================
// Conversation History
// =============================================================================

/**
 * Simple in-memory conversation history.
 * Navigator has a single conversation with the user (no multiple sessions/channels).
 */
class ConversationHistory {
  private messages: Message[] = [];

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content });
  }

  getMessages(): Anthropic.MessageParam[] {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  clear(): void {
    this.messages = [];
  }

  size(): number {
    return this.messages.length;
  }
}

const conversationHistory = new ConversationHistory();

// =============================================================================
// Navigator Service
// =============================================================================

class NavigatorService {
  private state: NavigatorState | null = null;
  private deps: NavigatorDeps | null = null;

  /**
   * Initialize the Navigator service.
   * Requires ANTHROPIC_API_KEY environment variable - NO mock mode.
   */
  init(deps: NavigatorDeps): void {
    this.deps = deps;

    // Require API key - no mock mode
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[Navigator] ANTHROPIC_API_KEY is required. ' +
        'Set it in your .env file to enable AI-powered workflow guidance.'
      );
    }

    this.state = {
      isActive: true,
      anthropic: new Anthropic({
        apiKey,
        timeout: 60000, // 60 second timeout
      }),
    };

    console.log(`[Navigator] Initialized with API key (${apiKey.substring(0, 10)}...)`);
  }

  /**
   * Stop the Navigator service.
   */
  stop(): void {
    if (this.state) {
      this.state.isActive = false;
    }
    conversationHistory.clear();
    console.log('[Navigator] Stopped');
  }

  /**
   * Check if the Navigator is active.
   */
  isActive(): boolean {
    return this.state?.isActive ?? false;
  }

  /**
   * Generate a response to a user message.
   * @param userMessage - The user's message
   * @returns The assistant's response
   */
  async generateResponse(userMessage: string): Promise<string> {
    if (!this.deps) {
      throw new Error('[Navigator] Not initialized - call init() first');
    }
    if (!this.state) {
      throw new Error('[Navigator] State not initialized');
    }

    // Add user message to history
    conversationHistory.addMessage('user', userMessage);

    // Build context for system prompt
    const sessions = await this.deps.storage.listSessions({});
    const sessionSummaries = sessions.map(s => ({
      id: s.id,
      status: s.status,
      initialIntent: s.source.initial_intent,
      messageCount: s.transcript.length,
      blockCount: s.understanding?.blocks?.length ?? 0,
      lastActivity: s.updated_at,
      hasHandoff: s.planner_sends.length > 0,
      initiativeId: s.initiative_id,
    }));

    const systemPrompt = getNavigatorPrompt({ sessionSummaries });
    const messages = conversationHistory.getMessages();

    try {
      console.log(`[Navigator] Calling Anthropic API: model=${LLM_CONFIG.model}, messages=${messages.length}, tools=${NAVIGATOR_TOOLS.length}`);
      const startTime = Date.now();

      const response = await this.state.anthropic.messages.create({
        model: LLM_CONFIG.model,
        max_tokens: LLM_CONFIG.maxTokens,
        system: systemPrompt,
        tools: NAVIGATOR_TOOLS,
        messages,
      });

      console.log(`[Navigator] Anthropic responded in ${Date.now() - startTime}ms, stop_reason=${response.stop_reason}`);

      // Handle tool use in a loop
      let result = response;
      let loopCount = 0;
      const maxLoops = 10; // Safety limit

      while (result.stop_reason === 'tool_use' && loopCount < maxLoops) {
        loopCount++;
        console.log(`[Navigator] Tool use loop iteration ${loopCount}`);

        const toolUseBlock = result.content.find(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (!toolUseBlock) {
          console.log('[Navigator] No tool_use block found despite stop_reason=tool_use, breaking loop');
          break;
        }

        console.log(`[Navigator] Tool use requested: ${toolUseBlock.name}, id=${toolUseBlock.id}`);

        try {
          const toolResult = await this.executeTool(toolUseBlock.name, toolUseBlock.input);
          console.log(`[Navigator] Tool ${toolUseBlock.name} result: ${JSON.stringify(toolResult).substring(0, 100)}`);

          // Continue conversation with tool result
          const continueStartTime = Date.now();
          result = await this.state.anthropic.messages.create({
            model: LLM_CONFIG.model,
            max_tokens: LLM_CONFIG.maxTokens,
            system: systemPrompt,
            tools: NAVIGATOR_TOOLS,
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

          console.log(`[Navigator] Continuation responded in ${Date.now() - continueStartTime}ms, stop_reason=${result.stop_reason}`);
        } catch (toolError) {
          const toolErrorMsg = toolError instanceof Error ? toolError.message : String(toolError);
          console.error(`[Navigator] Error in tool loop: ${toolErrorMsg}`);
          break;
        }
      }

      // Extract text response
      const textBlock = result.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      if (!textBlock?.text) {
        throw new Error('[Navigator] LLM returned no text response');
      }
      const responseText = textBlock.text;

      // Add assistant response to history
      conversationHistory.addMessage('assistant', responseText);

      return responseText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
      console.error(`[Navigator] LLM error (${errorName}): ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[Navigator] Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }

      // FAIL LOUDLY - report the actual error
      throw new Error(`Navigator LLM error: ${errorMessage}`);
    }
  }

  /**
   * Execute a tool and return the result.
   */
  private async executeTool(name: string, input: unknown): Promise<NavigatorToolResult> {
    if (!this.deps) {
      return { success: false, error: 'Navigator not initialized' };
    }

    try {
      switch (name) {
        case 'list_sessions':
          return await this.executeListSessions(input as ListSessionsInput);

        case 'recommend_action':
          return await this.executeRecommendAction(input as RecommendActionInput);

        case 'start_new_session':
          return await this.executeStartNewSession(input as StartNewSessionInput);

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Navigator] Error executing tool '${name}':`, error);
      return { success: false, error: message };
    }
  }

  /**
   * Execute list_sessions tool.
   */
  private async executeListSessions(input: ListSessionsInput): Promise<NavigatorToolResult> {
    const { filter = 'all', include_details = true } = input;

    // Get sessions from storage
    const allSessions = await this.deps!.storage.listSessions({});

    // Apply filter
    let filteredSessions = allSessions;
    if (filter === 'active') {
      filteredSessions = allSessions.filter(s => s.status === 'active');
    } else if (filter === 'abandoned') {
      filteredSessions = allSessions.filter(s => s.status === 'abandoned');
    }

    // Build result
    const sessions = filteredSessions.map(s => ({
      id: s.id,
      status: s.status,
      initial_intent: s.source.initial_intent,
      message_count: s.transcript.length,
      block_count: s.understanding?.blocks?.length ?? 0,
      last_activity: s.updated_at,
      has_handoff: s.planner_sends.length > 0,
      initiative_id: s.initiative_id,
    }));

    const result: ListSessionsResult = {
      sessions: include_details ? sessions : sessions.map(s => ({
        id: s.id,
        status: s.status,
        initial_intent: s.initial_intent,
        message_count: s.message_count,
        block_count: s.block_count,
        last_activity: s.last_activity,
        has_handoff: s.has_handoff,
        initiative_id: s.initiative_id,
      })),
      summary: {
        total: allSessions.length,
        active: allSessions.filter(s => s.status === 'active').length,
        abandoned: allSessions.filter(s => s.status === 'abandoned').length,
      },
    };

    return { success: true, data: result };
  }

  /**
   * Execute recommend_action tool.
   */
  private async executeRecommendAction(input: RecommendActionInput): Promise<NavigatorToolResult> {
    const { user_context, prioritize = 'momentum' } = input;

    // Get all sessions
    const sessions = await this.deps!.storage.listSessions({});
    const activeSessions = sessions.filter(s => s.status === 'active');

    // No sessions - recommend starting fresh
    if (sessions.length === 0) {
      const result: RecommendActionResult = {
        recommendation: {
          type: 'start_new',
          reason: "You don't have any sessions yet. Let's start exploring an idea!",
          confidence: 'high',
        },
      };
      return { success: true, data: result };
    }

    // No active sessions - recommend reviewing or starting new
    if (activeSessions.length === 0) {
      const result: RecommendActionResult = {
        recommendation: {
          type: 'review_sessions',
          reason: 'All your sessions are abandoned. You might want to review them or start fresh.',
          confidence: 'medium',
        },
        alternatives: [
          {
            type: 'start_new',
            reason: 'Start a new session to explore a fresh idea.',
          },
        ],
      };
      return { success: true, data: result };
    }

    // Find best session based on priority
    let bestSession;
    let reason = '';

    if (prioritize === 'momentum') {
      // Most recently active session
      bestSession = activeSessions.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
      reason = 'You were recently working on this. Continuing while it\'s fresh might help maintain momentum.';
    } else if (prioritize === 'completion') {
      // Session with most blocks (closest to done)
      bestSession = activeSessions.sort((a, b) =>
        (b.understanding?.blocks?.length ?? 0) - (a.understanding?.blocks?.length ?? 0)
      )[0];
      reason = 'This session has the most developed ideas. It might be ready to send to the planner soon.';
    } else {
      // freshness - least recently updated
      bestSession = activeSessions.sort((a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      )[0];
      reason = 'This session hasn\'t been touched in a while. A fresh look might reveal new insights.';
    }

    // Check if session looks ready for handoff
    const blockCount = bestSession.understanding?.blocks?.length ?? 0;
    const hasHandoff = bestSession.planner_sends.length > 0;

    if (blockCount >= 3 && !hasHandoff) {
      const result: RecommendActionResult = {
        recommendation: {
          type: 'handoff_ready',
          reason: 'You have several well-formed ideas. This might be ready to send to the planner for structured planning.',
          session_id: bestSession.id,
          intent: bestSession.source.initial_intent,
          confidence: 'high',
        },
      };
      return { success: true, data: result };
    }

    // Standard recommendation
    const result: RecommendActionResult = {
      recommendation: {
        type: 'continue_session',
        reason,
        session_id: bestSession.id,
        intent: bestSession.source.initial_intent,
        confidence: 'medium',
      },
    };

    return { success: true, data: result };
  }

  /**
   * Execute start_new_session tool.
   */
  private async executeStartNewSession(input: StartNewSessionInput): Promise<NavigatorToolResult> {
    const { initial_intent, initiative_id } = input;

    const session = await this.deps!.storage.createSession(
      { type: 'human', initial_intent },
      initiative_id
    );

    const result: StartNewSessionResult = {
      session_id: session.id,
      status: 'created',
      initial_intent: session.source.initial_intent,
    };

    return { success: true, data: result };
  }
}

// Singleton instance
export const navigatorService = new NavigatorService();

// =============================================================================
// Convenience Functions
// =============================================================================

export function initNavigator(deps: NavigatorDeps): void {
  navigatorService.init(deps);
}

export function stopNavigator(): void {
  navigatorService.stop();
}

export function isNavigatorActive(): boolean {
  return navigatorService.isActive();
}
