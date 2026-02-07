/**
 * Unified interviewer service for Tend
 * Handles AI-powered conversation across ideation, planning, and execution phases
 */

import { allTools, type ToolDefinition } from './tools';
import { buildSystemPrompt } from './system-prompt';
import { ConversationHistory, type HistoryMessage } from './ConversationHistory';
import { ContextEnrichment, type ProjectContext, type Focus } from './ContextEnrichment';

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface InterviewerResponse {
  content: string;
  metadata?: Record<string, unknown>;
  tool_calls?: ToolCall[];
}

export interface TendInterviewerConfig {
  anthropicApiKey?: string;
  modelId?: string;
}

export class TendInterviewerService {
  private config: TendInterviewerConfig;
  private conversationHistory: ConversationHistory;
  private contextEnrichment: ContextEnrichment;

  constructor(config: TendInterviewerConfig) {
    this.config = {
      modelId: 'claude-3-5-sonnet-20241022',
      ...config,
    };
    this.conversationHistory = new ConversationHistory();
    this.contextEnrichment = new ContextEnrichment();

    // Config will be used when Anthropic SDK is integrated
    // For now, stored for future use
  }

  /**
   * Process a user message and return AI response
   */
  async processMessage(
    _sessionId: string,
    message: string,
    context?: {
      project?: ProjectContext;
      focus?: Focus;
      phase?: 'ideation' | 'planning' | 'execution';
    }
  ): Promise<InterviewerResponse> {
    // Add user message to history
    this.conversationHistory.addMessage({
      role: 'user',
      content: message,
      phase: context?.phase,
      timestamp: new Date().toISOString(),
    });

    // For now, return mock response
    // Real implementation will use Anthropic SDK
    const mockResponse = this.generateMockResponse(message, context);

    // Add assistant response to history
    this.conversationHistory.addMessage({
      role: 'assistant',
      content: mockResponse.content,
      phase: context?.phase,
      tool_calls: mockResponse.tool_calls,
      timestamp: new Date().toISOString(),
    });

    return mockResponse;
  }

  /**
   * Get available tools for the interviewer
   */
  getTools(): ToolDefinition[] {
    return allTools;
  }

  /**
   * Get system prompt for the interviewer
   */
  getSystemPrompt(project: ProjectContext, focus?: Focus): string {
    const enrichedContext = this.contextEnrichment.enrichContext(project, focus);
    return buildSystemPrompt(project, this.getTools(), enrichedContext);
  }

  /**
   * Get conversation history
   */
  getHistory(limit?: number): HistoryMessage[] {
    return this.conversationHistory.getHistory(limit);
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory.clear();
  }

  /**
   * Mock response generator (temporary until Anthropic integration)
   */
  private generateMockResponse(
    message: string,
    context?: {
      project?: ProjectContext;
      focus?: Focus;
      phase?: 'ideation' | 'planning' | 'execution';
    }
  ): InterviewerResponse {
    const lowerMessage = message.toLowerCase();

    // Phase-specific mock responses
    if (context?.phase === 'ideation') {
      if (lowerMessage.includes('idea') || lowerMessage.includes('requirement')) {
        return {
          content: 'That sounds like an interesting idea. Can you tell me more about the problem this would solve?',
          metadata: { phase: 'ideation' },
          tool_calls: [
            {
              name: 'create_block',
              arguments: {
                content: message,
                type: 'idea',
              },
            },
          ],
        };
      }
    }

    if (context?.phase === 'planning') {
      if (lowerMessage.includes('step') || lowerMessage.includes('task')) {
        return {
          content: 'I will add that as a step to the plan. What would be the acceptance criteria for this step?',
          metadata: { phase: 'planning' },
          tool_calls: [
            {
              name: 'add_step',
              arguments: {
                planId: context.project?.activePlan?.id || 'mock-plan-id',
                title: message,
              },
            },
          ],
        };
      }
    }

    if (context?.phase === 'execution') {
      if (lowerMessage.includes('status') || lowerMessage.includes('progress')) {
        return {
          content: 'The execution is currently in progress. Let me check the latest status for you.',
          metadata: { phase: 'execution' },
        };
      }
    }

    // Default fallback response
    return {
      content: 'I understand. Could you provide more details about what you would like to accomplish?',
      metadata: {
        phase: context?.phase,
        focus: context?.focus,
      },
    };
  }
}
