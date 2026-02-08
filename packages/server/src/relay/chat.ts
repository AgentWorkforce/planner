/**
 * Relay Chat Module
 *
 * Handles sending chat messages to planning agents via relay.
 * Uses thread IDs to correlate requests with responses.
 */

import { randomUUID } from 'crypto';
import { getRelayMode } from './service.js';
import { getClient, onMessage, sendMessage } from './client.js';

/** Default timeout for agent responses in milliseconds */
const DEFAULT_TIMEOUT_MS = 60 * 1000;

/** Pending response handler */
interface PendingResponse {
  resolve: (response: AgentResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  agentId: string;
  createdAt: number;
}

/** Map of thread IDs to pending response handlers */
const pendingResponses = new Map<string, PendingResponse>();

/**
 * Generate a unique thread ID for message correlation.
 */
function generateThreadId(): string {
  return `chat-${randomUUID()}`;
}

/**
 * Register a pending response handler.
 * Returns the thread ID to use when sending the message.
 */
export function registerPendingResponse(
  agentId: string,
  resolve: (response: AgentResponse) => void,
  reject: (error: Error) => void,
  timeoutMs: number
): string {
  const threadId = generateThreadId();

  const timeout = setTimeout(() => {
    const pending = pendingResponses.get(threadId);
    if (pending) {
      pendingResponses.delete(threadId);
      console.log(`[chat] Request ${threadId} timed out after ${timeoutMs}ms`);
      reject(new Error('TIMEOUT: Agent did not respond within time limit'));
    }
  }, timeoutMs);

  pendingResponses.set(threadId, {
    resolve,
    reject,
    timeout,
    agentId,
    createdAt: Date.now(),
  });

  console.log(`[chat] Registered pending response ${threadId} for agent ${agentId}`);
  return threadId;
}

/**
 * Handle an incoming response for a pending request.
 * Called by the relay client's onMessage handler.
 */
export function handleAgentResponse(threadId: string, from: string, body: string): boolean {
  const pending = pendingResponses.get(threadId);

  if (!pending) {
    console.log(`[chat] No pending request for thread ${threadId} (may have timed out)`);
    return false;
  }

  // Verify the response is from the expected agent
  if (pending.agentId !== from) {
    console.warn(`[chat] Response from unexpected agent: expected ${pending.agentId}, got ${from}`);
    // Still process it - agent names might have slight variations
  }

  // Clear timeout and remove from pending
  clearTimeout(pending.timeout);
  pendingResponses.delete(threadId);

  const elapsed = Date.now() - pending.createdAt;
  console.log(`[chat] Received response for ${threadId} from ${from} (${elapsed}ms)`);

  // Parse the response
  const response: AgentResponse = {
    text: body,
  };

  pending.resolve(response);
  return true;
}

/**
 * Get count of pending responses (for diagnostics).
 */
export function getPendingCount(): number {
  return pendingResponses.size;
}

/** Track if chat handler is initialized */
let chatHandlerInitialized = false;

/**
 * Initialize the chat message handler.
 * Registers with the relay client to receive agent responses.
 * Call this once during service initialization.
 */
export function initChatHandler(): void {
  if (chatHandlerInitialized) {
    console.log('[chat] Chat handler already initialized');
    return;
  }

  // Register handler for incoming messages
  onMessage((from, body, threadId, data) => {
    // Only process messages with a thread ID that matches our pattern
    if (threadId && threadId.startsWith('chat-')) {
      handleAgentResponse(threadId, from, body);
    }
  });

  chatHandlerInitialized = true;
  console.log('[chat] Chat handler initialized');
}

/** Chat context sent with messages */
export interface ChatContext {
  plan_id: string;
  context: unknown;
  history: { role: string; content: string }[];
}

/** Response from agent */
export interface AgentResponse {
  text: string;
  error?: string;
  partial?: boolean;
}

/**
 * Send a message to an agent and wait for response.
 *
 * @param agentId - The agent ID to send to
 * @param message - The user's message
 * @param context - Additional context for the agent
 * @param timeoutMs - Timeout in milliseconds (default 60s)
 * @returns The agent's response
 */
export async function sendToAgent(
  agentId: string,
  message: string,
  context: ChatContext,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<AgentResponse> {
  const mode = getRelayMode();

  if (mode === 'disconnected') {
    throw new Error('Relay is disconnected');
  }

  if (mode === 'mock') {
    // Mock mode - return simulated response
    console.log(`[chat] Mock mode - simulating response for agent ${agentId}`);
    return createMockAgentResponse(message, context);
  }

  // Real relay mode - ensure handler is initialized
  if (!chatHandlerInitialized) {
    initChatHandler();
  }

  const client = getClient();
  if (!client) {
    throw new Error('Relay client not initialized');
  }

  console.log(`[chat] Sending message to agent ${agentId} via relay`);

  // Create a promise that will be resolved when we get a response
  return new Promise<AgentResponse>((resolve, reject) => {
    // Register pending response with timeout
    const threadId = registerPendingResponse(agentId, resolve, reject, timeoutMs);

    // Send message to agent with context
    const sent = sendMessage(
      agentId,
      message,
      'chat',
      { context },
      threadId
    );

    if (!sent) {
      // Clean up pending response if send failed
      const pending = pendingResponses.get(threadId);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingResponses.delete(threadId);
      }
      reject(new Error('Failed to send message: relay not connected'));
    }
  });
}

/**
 * Create a mock agent response for development.
 */
function createMockAgentResponse(message: string, context: ChatContext): AgentResponse {
  const lowerMsg = message.toLowerCase();

  // Simulate different types of responses
  if (lowerMsg.includes('add') && lowerMsg.includes('step')) {
    return {
      text: `Based on your request, I suggest adding a new step to your plan.

[SUGGESTION type="add_step" description="Add documentation step" preview="+ Document API endpoints"]
{
  "title": "Document API endpoints and usage",
  "description": "Create comprehensive API documentation",
  "scope": "documentation",
  "dependencies": []
}
[/SUGGESTION]

Would you like me to add this step to your plan?`,
    };
  }

  if (lowerMsg.includes('criteria') || lowerMsg.includes('acceptance')) {
    return {
      text: `I can help you add acceptance criteria for better test coverage.

[SUGGESTION type="add_criteria" description="Add test coverage criterion" preview="+ Tests pass with >80% coverage"]
{
  "step_id": "${context.plan_id}-step-1",
  "description": "All unit tests pass with >80% code coverage",
  "type": "test"
}
[/SUGGESTION]

This will help ensure your implementation is well-tested.`,
    };
  }

  // Default response
  return {
    text: `I understand you're asking about "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}".

Based on your plan, I can help with:
- Adding or modifying steps
- Setting acceptance criteria
- Reviewing dependencies
- Analyzing scope coverage

What would you like to focus on?`,
  };
}

/**
 * Notify agent of a change made to the plan.
 *
 * @param agentId - The agent ID to notify
 * @param changeType - Type of change (e.g., 'step_added', 'suggestion_applied')
 * @param changeData - Data about the change
 */
export async function notifyAgent(
  agentId: string,
  changeType: string,
  changeData: unknown
): Promise<void> {
  const mode = getRelayMode();

  if (mode === 'disconnected' || mode === 'mock') {
    console.log(`[chat] Skip agent notification (mode=${mode}): ${changeType}`);
    return;
  }

  console.log(`[chat] Notifying agent ${agentId} of change: ${changeType}`);

  // Fire and forget - no response expected
  const sent = sendMessage(
    agentId,
    `Plan change: ${changeType}`,
    'action',
    { changeType, changeData }
  );

  if (!sent) {
    console.warn(`[chat] Failed to notify agent ${agentId}: relay not connected`);
  }
}
