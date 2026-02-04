/**
 * ActiveAgentsSection - Section displaying active agents for a run
 *
 * Features:
 * - Header: 'Active Agents (N)' with count
 * - Grid of AgentCards (2 columns)
 * - Opens AgentDetailPanel on 'View Details' click
 * - Empty state: 'No agents currently working'
 * - Loading state: skeleton cards
 */

import { useState, useCallback } from 'react';
import { useActiveAgents } from '@/hooks/useActiveAgents';
import { AgentCard, AgentCardSkeleton } from './AgentCard';
import { AgentDetailPanel } from './AgentDetailPanel';
import type { ActiveAgent } from '@/types';

interface ActiveAgentsSectionProps {
  runId: string | null | undefined;
  className?: string;
}

export function ActiveAgentsSection({ runId, className }: ActiveAgentsSectionProps) {
  const { agents, isLoading, error } = useActiveAgents(runId);
  const [selectedAgent, setSelectedAgent] = useState<ActiveAgent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleViewDetails = useCallback((agent: ActiveAgent) => {
    setSelectedAgent(agent);
    setIsPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback((open: boolean) => {
    setIsPanelOpen(open);
    if (!open) {
      // Clear selection after animation completes
      setTimeout(() => setSelectedAgent(null), 300);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
            Active Agents
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
            Active Agents
          </h2>
        </div>
        <div className="text-sm text-red-500 text-center py-4">
          Failed to load agents: {error.message}
        </div>
      </div>
    );
  }

  // Empty state
  if (agents.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
            Active Agents (0)
          </h2>
        </div>
        <div className="text-sm text-text-muted text-center py-8 bg-bg-surface border border-border rounded-lg">
          No agents currently working
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
          Active Agents ({agents.length})
        </h2>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.agent_id}
            agent={agent}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {/* Detail panel (renders as portal, outside sidebar) */}
      <AgentDetailPanel
        agent={selectedAgent}
        open={isPanelOpen}
        onOpenChange={handlePanelClose}
      />
    </div>
  );
}
