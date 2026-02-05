/**
 * Interviewer Tools
 *
 * Anthropic tool definitions for Interviewer capabilities.
 * Tools enable lazy specialist spawning and session management.
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Tool Definitions
// =============================================================================

export const INTERVIEWER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'start_session',
    description: 'Create a new brainstorming session. Returns session_id. Does NOT auto-spawn specialists - spawn them lazily as needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        initial_intent: {
          type: 'string',
          description: 'The initial idea or intent to explore',
        },
        initiative_id: {
          type: 'string',
          description: 'Optional initiative to associate with',
        },
      },
      required: ['initial_intent'],
    },
  },
  {
    name: 'read_session',
    description: 'Get the current session state including transcript and understanding from specialists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID to read',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'add_message',
    description: 'Add a message to the session transcript. Use this to record the conversation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        role: {
          type: 'string',
          enum: ['user', 'assistant'],
          description: 'Who sent the message',
        },
        content: {
          type: 'string',
          description: 'The message content',
        },
      },
      required: ['session_id', 'role', 'content'],
    },
  },
  {
    name: 'update_understanding',
    description: 'Update specialist observations. Called when specialists report insights. Structure is freeform.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        specialist_name: {
          type: 'string',
          description: 'Name of the specialist (e.g., Architect, Designer, Security)',
        },
        observations: {
          type: 'object',
          description: 'Freeform observations object - structure defined by specialist',
        },
      },
      required: ['session_id', 'specialist_name', 'observations'],
    },
  },
  {
    name: 'send_to_planner',
    description: 'Send the current understanding to the planner to create a structured plan. Use when the user is ready to move forward.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        goal: {
          type: 'string',
          description: 'Optional goal override (defaults to initial_intent)',
        },
        context: {
          type: 'string',
          description: 'Optional context to include in the plan',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'spawn_specialist',
    description: 'Spawn a specialist agent to provide expertise. Use when conversation reveals need for specific knowledge. Specialists are invisible to user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        name: {
          type: 'string',
          description: 'Specialist name (e.g., Architect, Designer, Security, QA, or custom)',
        },
        focus: {
          type: 'string',
          description: 'What this specialist should focus on',
        },
        prompt_context: {
          type: 'string',
          description: 'Optional additional context from the conversation',
        },
      },
      required: ['session_id', 'name', 'focus'],
    },
  },
  {
    name: 'update_synthesis',
    description: 'Update the AI understanding synthesis for the session. Call this when understanding has evolved significantly to update the idea summary and specialist perspectives shown in the AI Understanding panel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        idea_summary: {
          type: 'string',
          description: 'Brief synopsis of the overall idea (2-3 sentences)',
        },
        specialist_perspectives: {
          type: 'object',
          description: 'Per-specialist synthesized perspectives',
          additionalProperties: {
            type: 'object',
            properties: {
              take: { type: 'string', description: "Specialist's key take on the idea" },
              concerns: { type: 'array', items: { type: 'string' }, description: 'Key concerns identified' },
              confidence: { type: 'string', enum: ['exploring', 'forming', 'confident'], description: 'Confidence level of this specialist' },
            },
            required: ['take', 'concerns', 'confidence'],
          },
        },
      },
      required: ['session_id', 'idea_summary', 'specialist_perspectives'],
    },
  },
];

// =============================================================================
// Tool Input Types
// =============================================================================

export interface StartSessionInput {
  initial_intent: string;
  initiative_id?: string;
}

export interface ReadSessionInput {
  session_id: string;
}

export interface AddMessageInput {
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface UpdateUnderstandingInput {
  session_id: string;
  specialist_name: string;
  observations: Record<string, unknown>;
}

export interface SendToPlannerInput {
  session_id: string;
  goal?: string;
  context?: string;
}

export interface SpawnSpecialistInput {
  session_id: string;
  name: string;
  focus: string;
  prompt_context?: string;
}

export interface UpdateSynthesisInput {
  session_id: string;
  idea_summary: string;
  specialist_perspectives: Record<string, {
    take: string;
    concerns: string[];
    confidence: 'exploring' | 'forming' | 'confident';
  }>;
}

export type ToolInput =
  | { name: 'start_session'; input: StartSessionInput }
  | { name: 'read_session'; input: ReadSessionInput }
  | { name: 'add_message'; input: AddMessageInput }
  | { name: 'update_understanding'; input: UpdateUnderstandingInput }
  | { name: 'send_to_planner'; input: SendToPlannerInput }
  | { name: 'spawn_specialist'; input: SpawnSpecialistInput }
  | { name: 'update_synthesis'; input: UpdateSynthesisInput };

// =============================================================================
// Tool Result
// =============================================================================

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
