import type { ChatMessage, ChatSuggestion, PlanVersion, Step } from '@/types';

const AI_API_BASE = import.meta.env.VITE_AI_API_URL || '/api/ai';
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Context sent to AI with each message
 */
interface ChatContext {
  plan_id: string;
  version: number;
  goal: string;
  context?: string;
  steps: {
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    dependencies: string[];
    acceptance_criteria_count: number;
    has_gate: boolean;
  }[];
}

/**
 * API response for chat message
 */
export interface ChatResponse {
  message: string;
  suggestion?: {
    type: ChatSuggestion['type'];
    description: string;
    preview: string;
    data: Record<string, unknown>;
  };
  /** Session status: 'active' when connected to agent, 'none' when in demo mode */
  session_status?: 'active' | 'none';
}

/**
 * Session status from the backend
 */
export interface SessionStatus {
  active: boolean;
  session_id: string | null;
  agent_id: string | null;
  created_at: string | null;
}

/**
 * Response from POST /plans/:id/session (create session)
 */
export interface CreateSessionResponse {
  session_id: string;
  status: 'active';
  agent_id: string;
  started_at: string;
}

/**
 * Response when session already exists (409)
 */
export interface AlreadyConnectedResponse {
  alreadyConnected: true;
  session: SessionStatus;
}

/**
 * Fetch session status for a plan.
 */
export async function getSessionStatus(planId: string): Promise<SessionStatus> {
  try {
    const response = await fetch(`${API_BASE}/plans/${planId}/session`);
    if (!response.ok) {
      return { active: false, session_id: null, agent_id: null, created_at: null };
    }
    const data = await response.json();
    // Backend returns { status: 'none' } when no session, or session data directly
    const isActive = data.status === 'active';
    return {
      active: isActive,
      session_id: isActive ? data.session_id : null,
      agent_id: isActive ? data.agent_id : null,
      created_at: isActive ? data.started_at : null,
    };
  } catch {
    return { active: false, session_id: null, agent_id: null, created_at: null };
  }
}

/**
 * Create a new AI session for an existing plan.
 * Spawns a planning agent and establishes a connection.
 *
 * @param planId - The plan ID to create a session for
 * @returns Session info on success, or alreadyConnected response on 409
 * @throws Error with specific messages for 400, 404, 503 status codes
 */
export async function createSession(
  planId: string
): Promise<CreateSessionResponse | AlreadyConnectedResponse> {
  const response = await fetch(`${API_BASE}/plans/${planId}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 409) {
    // Session already exists - treat as success
    const data = await response.json();
    return {
      alreadyConnected: true,
      session: {
        active: true,
        session_id: data.session_id,
        agent_id: data.agent_id,
        created_at: data.started_at,
      },
    };
  }

  if (response.status === 400) {
    throw new Error('Only draft plans can have AI sessions');
  }

  if (response.status === 404) {
    throw new Error('Plan not found');
  }

  if (response.status === 503) {
    throw new Error('AI service unavailable');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to create session: ${response.status}`);
  }

  const data = await response.json();
  return data as CreateSessionResponse;
}

/**
 * Build context object from PlanVersion for AI
 */
function buildContext(version: PlanVersion): ChatContext {
  return {
    plan_id: version.plan_id,
    version: version.version,
    goal: version.summary.goal,
    context: version.summary.context,
    steps: version.steps.map((step) => ({
      step_id: step.step_id,
      title: step.title,
      description: step.description,
      scope: step.scope,
      dependencies: step.dependencies,
      acceptance_criteria_count: step.acceptance_criteria?.length ?? 0,
      has_gate: !!step.gate,
    })),
  };
}

/**
 * Send a chat message to the AI backend.
 *
 * @param message - User's message
 * @param version - Current plan version for context
 * @param conversationHistory - Previous messages for context
 * @returns AI response message
 */
export async function sendChatMessage(
  message: string,
  version: PlanVersion,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const context = buildContext(version);

  // Format conversation history for API
  const history = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const response = await fetch(`${AI_API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context,
        history,
      }),
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('AI service is currently unavailable. Please try again later.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const data = await response.json();
    return data as ChatResponse;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to reach AI service. Check your network connection.');
    }
    throw error;
  }
}

/**
 * Stream a chat response from the AI backend.
 * Calls onChunk for each piece of the response as it arrives.
 *
 * @param message - User's message
 * @param version - Current plan version for context
 * @param conversationHistory - Previous messages for context
 * @param onChunk - Callback for each chunk of the response
 * @param signal - AbortSignal to cancel the stream
 * @returns Final complete response
 */
export async function streamChatMessage(
  message: string,
  version: PlanVersion,
  conversationHistory: ChatMessage[] = [],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const context = buildContext(version);

  const history = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await fetch(`${AI_API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      context,
      history,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat stream request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming not supported');
  }

  const decoder = new TextDecoder();
  let fullMessage = '';
  let suggestion: ChatResponse['suggestion'] | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Parse SSE format: data: {...}\n\n
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk') {
            fullMessage += data.content;
            onChunk(data.content);
          } else if (data.type === 'suggestion') {
            suggestion = data.suggestion;
          } else if (data.type === 'done') {
            // Stream complete
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { message: fullMessage, suggestion };
}

/**
 * Apply a suggested change to the plan.
 *
 * @param planId - Plan ID
 * @param version - Version number
 * @param suggestion - The suggestion to apply
 * @returns Updated step or null on failure
 */
export async function applySuggestion(
  planId: string,
  version: number,
  suggestion: ChatSuggestion
): Promise<Step | null> {
  try {
    const response = await fetch(`${AI_API_BASE}/suggestions/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        version,
        suggestion_type: suggestion.type,
        suggestion_data: suggestion.data,
      }),
    });

    if (!response.ok) {
      console.error('Failed to apply suggestion:', response.status);
      return null;
    }

    const data = await response.json();
    return data.step as Step;
  } catch (error) {
    console.error('Failed to apply suggestion:', error);
    return null;
  }
}

/**
 * Create a mock AI response for development/testing.
 * This is used when the AI backend is not available.
 */
export function createMockChatResponse(
  message: string,
  version: PlanVersion
): ChatResponse {
  const lowerMsg = message.toLowerCase();

  // Analyze step clarity
  if (lowerMsg.includes('step') && (lowerMsg.includes('clear') || lowerMsg.includes('enough'))) {
    return {
      message: `Looking at your steps, I can see they have good structure. However, some steps could benefit from more detailed acceptance criteria to make them more actionable and verifiable.\n\nFor example, step "${version.steps[0]?.title || 'N/A'}" could specify:\n- Success metrics\n- Edge cases to handle\n- Integration requirements`,
    };
  }

  // Acceptance criteria help
  if (lowerMsg.includes('criteria') || lowerMsg.includes('acceptance')) {
    return {
      message: `For robust acceptance criteria, consider including:\n\n1. **Specific outcomes** - What exactly should happen?\n2. **Measurable results** - How will you verify success?\n3. **Edge cases** - What happens in unusual situations?\n4. **Performance** - Are there time/resource constraints?\n\nWould you like me to suggest specific criteria for a particular step?`,
    };
  }

  // Dependency analysis
  if (lowerMsg.includes('dependencies') || lowerMsg.includes('depend')) {
    const depCount = version.steps.reduce((acc, s) => acc + s.dependencies.length, 0);
    return {
      message: `I've analyzed the dependency graph of your ${version.steps.length} steps:\n\n- **Total dependencies:** ${depCount}\n- **Steps without dependencies:** ${version.steps.filter((s) => s.dependencies.length === 0).length}\n- **Most dependencies:** ${Math.max(...version.steps.map((s) => s.dependencies.length))}\n\nThe current dependencies look reasonable. Steps without explicit dependencies can be executed in parallel.`,
    };
  }

  // Add criteria suggestion
  if (lowerMsg.includes('add') && lowerMsg.includes('criteria')) {
    return {
      message: `I can help you add acceptance criteria. Here's a suggestion based on the step context:`,
      suggestion: {
        type: 'add_criteria',
        description: 'Add acceptance criterion for test coverage',
        preview: '+ All unit tests pass with >80% code coverage',
        data: {
          step_id: version.steps[0]?.step_id,
          description: 'All unit tests pass with >80% code coverage',
          type: 'test',
        },
      },
    };
  }

  // Default response
  return {
    message: `I understand you're asking about "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}".\n\nBased on your plan's goal "${version.summary.goal}", I can help with:\n- Analyzing step clarity\n- Suggesting acceptance criteria\n- Reviewing dependencies\n- Identifying scope coverage\n\nWhat specific aspect would you like to focus on?`,
  };
}
