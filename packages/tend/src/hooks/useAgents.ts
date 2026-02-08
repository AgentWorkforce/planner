/**
 * useAgents Hook
 *
 * Manages agent lifecycle and state for conversation tabs.
 * Tracks active agents, their status, and unread message counts.
 *
 * Agents appear when they join the relay channel.
 * Agents disappear when they leave or complete their work.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRelay } from '@/contexts/RelayContext';
import type { RelayMessage } from '@/types/relay';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'completed' | 'blocked';
  unreadCount: number;
  joinedAt: string;
}

interface UseAgentsResult {
  agents: Agent[];
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  markAsRead: (agentId: string) => void;
}

/**
 * Extract role from agent name (e.g., "Coder-123" -> "Coder")
 */
function extractRole(name: string): string {
  const match = name.match(/^([A-Z][a-z]+)/);
  return match?.[1] ?? 'Agent';
}

/**
 * Hook for managing agent tabs in conversation
 */
export function useAgents(channelId: string, activeChannelId: string): UseAgentsResult {
  const { connection } = useRelay();
  const [agents, setAgents] = useState<Agent[]>([]);

  // Track agent presence via relay
  useEffect(() => {
    if (!connection.isConnected || !channelId) return;

    // Join the channel to track presence
    connection.joinChannel(channelId);

    // Handle presence updates
    const unsubscribePresence = connection.onPresenceUpdate((channel, members) => {
      if (channel !== channelId) return;

      // Update agents list based on presence
      setAgents((prev) => {
        const agentMembers = members.filter((m) => m.entityType === 'agent');

        // Create map of existing agents
        const existingAgents = new Map(prev.map((a) => [a.id, a]));

        // Build new agents list
        const newAgents: Agent[] = agentMembers.map((member) => {
          const existing = existingAgents.get(member.userId);

          if (existing) {
            // Keep existing agent data
            return existing;
          } else {
            // New agent joined
            return {
              id: member.userId,
              name: member.name,
              role: extractRole(member.name),
              status: 'active' as const,
              unreadCount: 0,
              joinedAt: member.joinedAt,
            };
          }
        });

        return newAgents;
      });
    });

    return () => {
      unsubscribePresence();
      connection.leaveChannel(channelId);
    };
  }, [connection, channelId]);

  // Track unread messages
  useEffect(() => {
    if (!connection.isConnected) return;

    const unsubscribe = connection.onChannelMessage((message: RelayMessage) => {
      // Only count messages from agents in this channel
      if (message.channelId !== channelId || message.entityType !== 'agent' || !message.from) {
        return;
      }

      const agentId: string = message.from;

      // Increment unread count if message is from a different channel than active
      if (activeChannelId !== `agent-${agentId}`) {
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === agentId
              ? { ...agent, unreadCount: agent.unreadCount + 1 }
              : agent
          )
        );
      }
    });

    return unsubscribe;
  }, [connection, channelId, activeChannelId]);

  // Update agent status
  const updateAgentStatus = useCallback((agentId: string, status: Agent['status']) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === agentId ? { ...agent, status } : agent))
    );
  }, []);

  // Mark agent messages as read
  const markAsRead = useCallback((agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === agentId ? { ...agent, unreadCount: 0 } : agent))
    );
  }, []);

  return {
    agents,
    updateAgentStatus,
    markAsRead,
  };
}
