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
  getClient,
  spawnAgent as serverSpawnAgent,
} from './client.js';
import { getPlanChannelId } from './channels.js';
import { emitAgentJoined, emitAgentLeft } from './agent-status.js';
import { createSpecialistSpawner } from '../../../ideation/src/relay/spawner.js';
import {
  setConnectionState as setIdeationState,
  dispatchMessage as dispatchToIdeation,
  setSender as setIdeationSender,
} from '../../../ideation/src/relay/index.js';
import { isIdeationChannel, sessionChannelId, IDEATION_CHANNEL, INTERVIEWER_CONFIG } from '../../../ideation/src/interviewer/config.js';
import { interviewer } from '../../../ideation/src/interviewer/service.js';
import { ideationEvents } from '../../../ideation/src/api/events.js';
import type { IdeationStorage } from '../../../ideation/src/storage/index.js';
import type { ClientState } from '@agent-relay/sdk';

/** Track joined session channels for reconnection */
const joinedSessionChannels = new Set<string>();

/** Track plan channels the Interviewer has joined (planChannelId → sessionId) */
const planChannelToSession = new Map<string, string>();

/** Track joined plan channels for reconnection */
const joinedPlanChannels = new Set<string>();

let unsubscribeState: (() => void) | null = null;
let unsubscribeMessage: (() => void) | null = null;
let unsubscribeSessionCreated: (() => void) | null = null;
let unsubscribeBlocksGraduated: (() => void) | null = null;
let bridgeInitialized = false;

/**
 * Map SDK client state to ideation client state.
 */
function mapState(sdkState: ClientState): 'connecting' | 'connected' | 'disconnected' | 'error' {
  switch (sdkState) {
    case 'CONNECTING':
      return 'connecting';
    case 'READY':
      return 'connected';
    case 'DISCONNECTED':
      return 'disconnected';
    default:
      return 'disconnected';
  }
}

/**
 * Initialize the bridge between server relay and ideation relay.
 * Call this after the server relay connects.
 */
export function initIdeationBridge(): void {
  if (bridgeInitialized) {
    console.log('[ideation-bridge] Already initialized');
    return;
  }

  // Set initial state based on current server relay state
  const connected = isServerRelayConnected();
  setIdeationState(connected ? 'connected' : 'disconnected');
  console.log(`[ideation-bridge] Initial state: ${connected ? 'connected' : 'disconnected'}`);

  // Subscribe to server relay state changes
  unsubscribeState = onServerStateChange((state: ClientState) => {
    const mappedState = mapState(state);
    setIdeationState(mappedState);
    console.log(`[ideation-bridge] State changed: ${mappedState}`);

    // Rejoin channels on reconnection
    if (state === 'READY') {
      const client = getClient();
      if (client) {
        // Rejoin main ideation channel
        client.joinChannel(IDEATION_CHANNEL);
        console.log(`[ideation-bridge] Rejoined ${IDEATION_CHANNEL}`);

        // Rejoin session channels
        for (const channelId of joinedSessionChannels) {
          client.joinChannel(channelId);
          console.log(`[ideation-bridge] Rejoined session channel ${channelId}`);
        }

        // Rejoin plan channels
        for (const channelId of joinedPlanChannels) {
          client.joinChannel(channelId);
          console.log(`[ideation-bridge] Rejoined plan channel ${channelId}`);
        }
      }
    }
  });

  // Subscribe to server relay messages and route ideation ones + plan channel ones
  unsubscribeMessage = onServerMessage((from, body, threadId, data) => {
    const channel = data?.channel as string | undefined;

    // Route ideation channel messages
    if (channel && isIdeationChannel(channel)) {
      console.log(`[ideation-bridge] Routing message from ${from} on ${channel}`);
      dispatchToIdeation(from, body, threadId, { ...data, channel });
      return;
    }

    // Route plan channel messages to Interviewer when registered
    if (channel && planChannelToSession.has(channel)) {
      // Don't route Interviewer's own messages back (prevent loops)
      if (data?.fromAgent === INTERVIEWER_CONFIG.agentId) return;

      const sessionId = planChannelToSession.get(channel)!;
      console.log(`[ideation-bridge] Routing plan channel message from ${from} on ${channel} (session: ${sessionId})`);
      dispatchToIdeation(from, body, threadId, {
        ...data,
        channel,
        planContext: true,
        sessionId,
      });
    }
  });

  // Join the main ideation channel
  const client = getClient();
  if (client) {
    const joined = client.joinChannel('#ideation');
    if (joined) {
      console.log('[ideation-bridge] Joined #ideation channel');
    }
  }

  // Inject sender so ideation can send through server relay
  console.log('[ideation-bridge] Injecting sender function');
  setIdeationSender(sendIdeationChannelMessage);

  // Subscribe to session:created events to notify Interviewer
  const handleSessionCreated = (event: { data: { id: string; source?: { initial_intent?: string } } }) => {
    if (!isServerRelayConnected()) return;

    const session = event.data;
    const channelId = sessionChannelId(session.id);
    const initialIntent = session.source?.initial_intent || 'New brainstorming session';

    // Join the session channel first
    const client = getClient();
    if (client) {
      client.joinChannel(channelId);
      joinedSessionChannels.add(channelId);
      console.log(`[ideation-bridge] Joined session channel ${channelId}`);
    }

    // Notify Interviewer to send welcome message
    interviewer.notifyNewSession(session.id, initialIntent).catch((err) => {
      console.error(`[ideation-bridge] Error notifying Interviewer:`, err);
    });
  };

  ideationEvents.on('session:created', handleSessionCreated);
  unsubscribeSessionCreated = () => ideationEvents.off('session:created', handleSessionCreated);

  // Subscribe to blocks_graduated events to join Interviewer to plan channel
  const handleBlocksGraduated = (event: { data: { id: string; planner_sends: Array<{ result?: { plan_id?: string } }> } }) => {
    if (!isServerRelayConnected()) return;

    const session = event.data;
    const latestSend = session.planner_sends[session.planner_sends.length - 1];
    const planId = latestSend?.result?.plan_id;

    if (!planId) {
      console.log('[ideation-bridge] blocks_graduated: no plan_id in latest planner_send');
      return;
    }

    const planChannelId = getPlanChannelId(planId);

    // Join the plan channel
    const relayClient = getClient();
    if (relayClient) {
      relayClient.joinChannel(planChannelId);
      joinedPlanChannels.add(planChannelId);
      planChannelToSession.set(planChannelId, session.id);
      console.log(`[ideation-bridge] Joined plan channel ${planChannelId} for session ${session.id}`);
    }

    // Announce Interviewer presence in the plan channel
    serverSendChannelMessage(planChannelId,
      'Interviewer has joined this plan channel. I have context from the brainstorming session and can answer domain questions about this plan.',
      { type: 'interviewer_joined', sessionId: session.id, fromAgent: INTERVIEWER_CONFIG.agentId }
    );
    console.log(`[ideation-bridge] Interviewer announcement sent to ${planChannelId}`);

    // Register Interviewer as an active agent
    emitAgentJoined(INTERVIEWER_CONFIG.agentId, 'interviewer', INTERVIEWER_CONFIG.displayName);
  };

  ideationEvents.on('session:blocks_graduated', handleBlocksGraduated);
  unsubscribeBlocksGraduated = () => ideationEvents.off('session:blocks_graduated', handleBlocksGraduated);

  // Inject specialist spawner into Interviewer
  const specialistSpawner = createSpecialistSpawner({ spawnAgent: serverSpawnAgent });
  interviewer.setSpawnAgent(specialistSpawner);
  console.log('[ideation-bridge] Specialist spawner injected into Interviewer');

  bridgeInitialized = true;
  console.log('[ideation-bridge] Initialized');
}

/**
 * Send a message from ideation through the server relay.
 * This replaces the ideation stub's sendChannelMessage.
 */
export function sendIdeationChannelMessage(
  channel: string,
  body: string,
  data?: Record<string, unknown>
): boolean {
  console.log(`[ideation-bridge] sendIdeationChannelMessage called for ${channel}`);

  if (!isServerRelayConnected()) {
    console.log(`[ideation-bridge] Cannot send to ${channel}: not connected`);
    return false;
  }

  // Join the channel if needed (relay auto-creates channels)
  const client = getClient();
  if (client) {
    const joined = client.joinChannel(channel);
    console.log(`[ideation-bridge] Joined channel ${channel}: ${joined}`);
  } else {
    console.log(`[ideation-bridge] No client available for ${channel}`);
  }

  const result = serverSendChannelMessage(channel, body, data);
  console.log(`[ideation-bridge] serverSendChannelMessage result for ${channel}: ${result}`);
  return result;
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
  joinedPlanChannels.clear();
  bridgeInitialized = false;
  console.log('[ideation-bridge] Stopped');
}

/**
 * Sync ideation session channels with existing sessions in storage.
 * Call this on startup to join channels for existing active sessions.
 */
export async function syncIdeationSessionChannels(storage: IdeationStorage): Promise<void> {
  if (!isServerRelayConnected()) {
    console.log('[ideation-bridge] Skipping session channel sync: relay not connected');
    return;
  }

  const client = getClient();
  if (!client) {
    console.log('[ideation-bridge] Skipping session channel sync: no client');
    return;
  }

  // Get all active sessions
  const activeSessions = await storage.listSessions({ status: 'active' });

  for (const session of activeSessions) {
    const channelId = sessionChannelId(session.id);
    if (!joinedSessionChannels.has(channelId)) {
      client.joinChannel(channelId);
      joinedSessionChannels.add(channelId);
      console.log(`[ideation-bridge] Synced session channel ${channelId}`);
    }
  }

  console.log(`[ideation-bridge] Synced ${activeSessions.length} session channels`);
}

/**
 * Get the session ID associated with a plan channel.
 * Returns undefined if the Interviewer hasn't joined this plan channel.
 */
export function getSessionForPlanChannel(planChannelId: string): string | undefined {
  return planChannelToSession.get(planChannelId);
}
