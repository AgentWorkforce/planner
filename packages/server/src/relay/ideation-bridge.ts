/**
 * Ideation Relay Bridge
 *
 * Bridges the server's relay connection to the ideation package.
 * Routes messages between the real relay daemon and the ideation stub client.
 */

import {
  isConnected as isServerRelayConnected,
  onStateChange as onServerStateChange,
  onMessage as onServerMessage,
  sendChannelMessage as serverSendChannelMessage,
} from './client.js';
import { getPlanChannelId } from './channels.js';
import { onUserChannelJoin } from './ws-proxy.js';
import { emitAgentJoined, emitAgentStatusUpdate, emitAgentWarming } from './agent-status.js';
import { setAgentForSession, getAgentLifecycleState } from './session-presence.js';
import type { AgentLifecycleManager } from '../agents/lifecycle.js';
import {
  setConnectionState as setIdeationState,
  dispatchMessage as dispatchToIdeation,
  setSender as setIdeationSender,
} from '../../../ideation/src/relay/index.js';
import { isIdeationChannel, sessionChannelId, INTERVIEWER_CONFIG } from '../../../ideation/src/interviewer/config.js';
import { ideationEvents } from '../../../ideation/src/api/events.js';
import { createTranscriptMessage } from '../../../ideation/src/domain/index.js';
import type { IdeationStorage } from '../../../ideation/src/storage/index.js';
import type { ConnectionState } from './client.js';

/** Track joined session channels (channelId → sessionId) */
const joinedSessionChannels = new Map<string, string>();

/** Track plan channels the Interviewer is registered for (planChannelId → sessionId) */
const planChannelToSession = new Map<string, string>();

let unsubscribeState: (() => void) | null = null;
let unsubscribeMessage: (() => void) | null = null;
let unsubscribeSessionCreated: (() => void) | null = null;
let unsubscribeBlocksGraduated: (() => void) | null = null;
let bridgeInitialized = false;
let lifecycleManager: AgentLifecycleManager | null = null;
let ideationStorage: IdeationStorage | null = null;

/** Track in-flight spawn attempts to prevent duplicate calls */
const spawningInProgress = new Set<string>();

/**
 * Ensure an Interviewer agent is spawned for a session.
 * No-op if agent is already running or spawn is in progress.
 */
function ensureInterviewerSpawned(sessionId: string): void {
  if (!lifecycleManager || spawningInProgress.has(sessionId)) return;

  spawningInProgress.add(sessionId);
  lifecycleManager.spawnInterviewer(sessionId).then(() => {
    spawningInProgress.delete(sessionId);
  }).catch((err) => {
    spawningInProgress.delete(sessionId);
    console.error(`[ideation-bridge] On-demand spawn failed for session ${sessionId}:`, err);
  });
}


/**
 * Initialize the bridge between server relay and ideation relay.
 * Call this after the server relay connects.
 */
export function initIdeationBridge(lifecycle?: AgentLifecycleManager, storage?: IdeationStorage): void {
  if (bridgeInitialized) {
    console.log('[ideation-bridge] Already initialized');
    return;
  }

  lifecycleManager = lifecycle || null;
  ideationStorage = storage || null;

  // Set initial state based on current server relay state
  const connected = isServerRelayConnected();
  setIdeationState(connected ? 'connected' : 'disconnected');
  console.log(`[ideation-bridge] Initial state: ${connected ? 'connected' : 'disconnected'}`);

  // Subscribe to server relay state changes
  unsubscribeState = onServerStateChange((state: ConnectionState) => {
    setIdeationState(state);
    console.log(`[ideation-bridge] State changed: ${state}`);
  });

  // Subscribe to server relay messages and route ideation ones + plan channel ones
  unsubscribeMessage = onServerMessage((from, to, body, threadId, data) => {
    // Route ideation channel messages
    if (isIdeationChannel(to)) {
      console.log(`[ideation-bridge] Routing message from ${from} on ${to}`);

      // Persist user and agent content messages to transcript (transport-layer persistence)
      const sessionId = joinedSessionChannels.get(to);
      if (sessionId && ideationStorage && body) {
        const dataType = (data as Record<string, unknown> | undefined)?.type as string | undefined;
        // Skip system messages (thinking, tool_action) — already persisted by MCP handler
        if (!dataType) {
          const role: 'user' | 'assistant' = from.startsWith('user-') ? 'user' : 'assistant';
          const message = createTranscriptMessage(role, body);
          ideationStorage.appendTranscript(sessionId, message).catch((err: unknown) => {
            console.error('[ideation-bridge] Failed to persist message:', err);
          });
        }
      }

      dispatchToIdeation(from, body, threadId, { ...data, channel: to });

      // Broadcast Interviewer status transitions based on message source
      if (from.startsWith('user-')) {
        // User sent a message → Interviewer is about to process it
        emitAgentStatusUpdate(INTERVIEWER_CONFIG.agentId, 'working', {
          activity: 'Thinking...',
        });
      } else if (from.startsWith('Interviewer-')) {
        // Interviewer responded → back to idle
        emitAgentStatusUpdate(INTERVIEWER_CONFIG.agentId, 'idle');
      }

      // On-demand agent spawning for existing sessions
      if (sessionId && lifecycleManager) {
        ensureInterviewerSpawned(sessionId);
      }
      return;
    }

    // Route plan channel messages to Interviewer when registered
    if (planChannelToSession.has(to)) {
      // Don't route Interviewer's own messages back (prevent loops)
      if (data?.fromAgent === INTERVIEWER_CONFIG.agentId) return;

      const sessionId = planChannelToSession.get(to)!;
      console.log(`[ideation-bridge] Routing plan channel message from ${from} on ${to} (session: ${sessionId})`);
      dispatchToIdeation(from, body, threadId, {
        ...data,
        channel: to,
        planContext: true,
        sessionId,
      });
    }
  });

  // Inject sender so ideation can send through server relay
  console.log('[ideation-bridge] Injecting sender function');
  setIdeationSender(sendIdeationChannelMessage);

  // On-demand Interviewer spawn: when a user joins a session channel (navigates to it),
  // spawn the Interviewer for that specific session only
  onUserChannelJoin((channel) => {
    if (!isIdeationChannel(channel)) return;
    const sessionId = joinedSessionChannels.get(channel);
    if (sessionId && lifecycleManager && ideationStorage) {
      console.log(`[ideation-bridge] User joined session channel ${channel}, ensuring Interviewer spawned`);

      const agentName = `Interviewer-${sessionId.slice(0, 8)}`;
      const lifecycleState = getAgentLifecycleState(agentName);

      if (lifecycleState === 'parked') {
        // Agent was parked, warm it up with transcript context
        console.log(`[ideation-bridge] Agent ${agentName} was parked, warming up`);
        emitAgentWarming(agentName, 'Resuming session...');

        // Get transcript summary for context (last 10 messages)
        ideationStorage.getSession(sessionId).then(async (session: { transcript?: Array<{ role: string; content: string }> } | null) => {
          let transcriptSummary: string | undefined;
          if (session?.transcript?.length) {
            const recentMessages = session.transcript.slice(-10);
            transcriptSummary = recentMessages
              .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 200)}`)
              .join('\n');
          }

          await lifecycleManager?.warmInterviewer(sessionId, { transcriptSummary });
          setAgentForSession(channel, agentName);
        }).catch((err: unknown) => {
          console.error(`[ideation-bridge] Failed to fetch transcript for warm-up:`, err);
          // Fall back to cold start
          ensureInterviewerSpawned(sessionId);
          setAgentForSession(channel, agentName);
        });
      } else {
        // Normal spawn or already active
        emitAgentJoined(INTERVIEWER_CONFIG.agentId, 'interviewer', INTERVIEWER_CONFIG.displayName);
        ensureInterviewerSpawned(sessionId);
        setAgentForSession(channel, agentName);
      }
    }
  });

  // Subscribe to session:created events to notify Interviewer
  const handleSessionCreated = (event: { data: { id: string; source?: { initial_intent?: string } } }) => {
    const session = event.data;
    const channelId = sessionChannelId(session.id);
    const initialIntent = session.source?.initial_intent || 'New brainstorming session';

    // Register the session channel mapping (agents join channels at spawn time)
    joinedSessionChannels.set(channelId, session.id);
    console.log(`[ideation-bridge] Registered session channel ${channelId}`);

    // Register Interviewer in the agent status system so the UI shows it
    emitAgentJoined(INTERVIEWER_CONFIG.agentId, 'interviewer', INTERVIEWER_CONFIG.displayName);

    // Spawn Interviewer agent via lifecycle manager
    if (lifecycleManager) {
      lifecycleManager.spawnInterviewer(session.id, { goal: initialIntent }).catch((err) => {
        console.error(`[ideation-bridge] Error spawning Interviewer agent:`, err);
      });
    }
  };

  ideationEvents.on('session:created', handleSessionCreated);
  unsubscribeSessionCreated = () => ideationEvents.off('session:created', handleSessionCreated);

  // Subscribe to blocks_graduated events to join Interviewer to plan channel
  const handleBlocksGraduated = (event: { data: { id: string; planner_sends: Array<{ result?: { plan_id?: string } }> } }) => {
    const session = event.data;
    const latestSend = session.planner_sends[session.planner_sends.length - 1];
    const planId = latestSend?.result?.plan_id;

    if (!planId) {
      console.log('[ideation-bridge] blocks_graduated: no plan_id in latest planner_send');
      return;
    }

    const planChannelId = getPlanChannelId(planId);

    // Register the plan channel mapping (agents join channels at spawn time)
    planChannelToSession.set(planChannelId, session.id);
    console.log(`[ideation-bridge] Registered plan channel ${planChannelId} for session ${session.id}`);

    // Announce Interviewer presence in the plan channel
    serverSendChannelMessage(planChannelId,
      'Interviewer has joined this plan channel. I have context from the brainstorming session and can answer domain questions about this plan.',
      { type: 'interviewer_joined', sessionId: session.id, fromAgent: INTERVIEWER_CONFIG.agentId }
    ).catch((err) => {
      console.error(`[ideation-bridge] Failed to send Interviewer announcement to ${planChannelId}:`, err);
    });
    console.log(`[ideation-bridge] Interviewer announcement sent to ${planChannelId}`);

    // Register Interviewer as an active agent
    emitAgentJoined(INTERVIEWER_CONFIG.agentId, 'interviewer', INTERVIEWER_CONFIG.displayName);

    // Spawn PlannerLead agent via lifecycle manager
    if (lifecycleManager) {
      lifecycleManager.spawnPlannerLead(planId).catch((err) => {
        console.error(`[ideation-bridge] Error spawning PlannerLead agent:`, err);
      });
    }
  };

  ideationEvents.on('session:blocks_graduated', handleBlocksGraduated);
  unsubscribeBlocksGraduated = () => ideationEvents.off('session:blocks_graduated', handleBlocksGraduated);

  bridgeInitialized = true;
  console.log('[ideation-bridge] Initialized');
}

/**
 * Send a message from ideation through the server relay.
 * This replaces the ideation stub's sendChannelMessage.
 * Fire-and-forget: returns true optimistically; errors are logged.
 */
export function sendIdeationChannelMessage(
  channel: string,
  body: string,
  data?: Record<string, unknown>
): boolean {
  console.log(`[ideation-bridge] sendIdeationChannelMessage called for ${channel}`);

  serverSendChannelMessage(channel, body, data).catch((err) => {
    console.error(`[ideation-bridge] Failed to send to ${channel}:`, err);
  });

  return true;
}

/**
 * Stop the ideation bridge.
 */
export function stopIdeationBridge(): void {
  if (unsubscribeState) {
    unsubscribeState();
    unsubscribeState = null;
  }
  if (unsubscribeMessage) {
    unsubscribeMessage();
    unsubscribeMessage = null;
  }
  if (unsubscribeSessionCreated) {
    unsubscribeSessionCreated();
    unsubscribeSessionCreated = null;
  }
  if (unsubscribeBlocksGraduated) {
    unsubscribeBlocksGraduated();
    unsubscribeBlocksGraduated = null;
  }

  setIdeationState('disconnected');
  setIdeationSender(null);
  joinedSessionChannels.clear();
  planChannelToSession.clear();
  lifecycleManager = null;
  ideationStorage = null;
  bridgeInitialized = false;
  console.log('[ideation-bridge] Stopped');
}

/**
 * Sync ideation session channels with existing sessions in storage.
 * Call this on startup to register channels for existing active sessions.
 * Channels are registered locally so message routing works when messages arrive.
 */
export async function syncIdeationSessionChannels(storage: IdeationStorage): Promise<void> {
  // Get all active sessions
  const activeSessions = await storage.listSessions({ status: 'active' });

  for (const session of activeSessions) {
    const channelId = sessionChannelId(session.id);
    if (!joinedSessionChannels.has(channelId)) {
      joinedSessionChannels.set(channelId, session.id);
      console.log(`[ideation-bridge] Registered session channel ${channelId}`);
    }
  }

  console.log(`[ideation-bridge] Registered ${activeSessions.length} session channels`);
}

/**
 * Get the session ID associated with a plan channel.
 * Returns undefined if the Interviewer hasn't joined this plan channel.
 */
export function getSessionForPlanChannel(planChannelId: string): string | undefined {
  return planChannelToSession.get(planChannelId);
}
