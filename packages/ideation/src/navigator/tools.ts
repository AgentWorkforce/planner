/**
 * Navigator Agent Tools
 *
 * Tool definitions for the Navigator's workflow guidance capabilities.
 * These tools help users understand their sessions and decide what to work on.
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Tool Definitions
// =============================================================================

export const NAVIGATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_sessions',
    description: 'Get a list of all sessions with their current states. Use this to understand what the user has been working on and identify sessions that need attention.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'active', 'abandoned'],
          description: 'Filter sessions by status. Defaults to "all".',
        },
        include_details: {
          type: 'boolean',
          description: 'Include block counts and last activity timestamps. Defaults to true.',
        },
      },
      required: [],
    },
  },
  {
    name: 'recommend_action',
    description: 'Analyze the user\'s sessions and context to suggest the best next action. Returns a recommendation with reasoning.',
    input_schema: {
      type: 'object' as const,
      properties: {
        user_context: {
          type: 'string',
          description: 'Optional context from the user about what they\'re looking for (e.g., "I have 30 minutes", "want to finish something").',
        },
        prioritize: {
          type: 'string',
          enum: ['momentum', 'completion', 'freshness'],
          description: 'What to prioritize: momentum (recent activity), completion (sessions close to done), freshness (new ideas). Defaults to momentum.',
        },
      },
      required: [],
    },
  },
  {
    name: 'start_new_session',
    description: 'Create a new ideation session from the user\'s intent. Use this when the user wants to explore a new idea.',
    input_schema: {
      type: 'object' as const,
      properties: {
        initial_intent: {
          type: 'string',
          description: 'The idea or intent to explore in this session.',
        },
        initiative_id: {
          type: 'string',
          description: 'Optional initiative to associate this session with.',
        },
      },
      required: ['initial_intent'],
    },
  },
];

// =============================================================================
// Tool Input Types
// =============================================================================

export interface ListSessionsInput {
  filter?: 'all' | 'active' | 'abandoned';
  include_details?: boolean;
}

export interface RecommendActionInput {
  user_context?: string;
  prioritize?: 'momentum' | 'completion' | 'freshness';
}

export interface StartNewSessionInput {
  initial_intent: string;
  initiative_id?: string;
}

export type NavigatorToolInput =
  | { name: 'list_sessions'; input: ListSessionsInput }
  | { name: 'recommend_action'; input: RecommendActionInput }
  | { name: 'start_new_session'; input: StartNewSessionInput };

// =============================================================================
// Tool Result Types
// =============================================================================

export interface NavigatorToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ListSessionsResult {
  sessions: Array<{
    id: string;
    status: 'active' | 'abandoned';
    initial_intent: string;
    message_count: number;
    block_count: number;
    last_activity: string;
    has_handoff: boolean;
    initiative_id?: string;
  }>;
  summary: {
    total: number;
    active: number;
    abandoned: number;
  };
}

export interface RecommendActionResult {
  recommendation: {
    type: 'continue_session' | 'start_new' | 'review_sessions' | 'handoff_ready';
    reason: string;
    session_id?: string;
    intent?: string;
    confidence: 'low' | 'medium' | 'high';
  };
  alternatives?: Array<{
    type: string;
    session_id?: string;
    reason: string;
  }>;
}

export interface StartNewSessionResult {
  session_id: string;
  status: 'created';
  initial_intent: string;
}
