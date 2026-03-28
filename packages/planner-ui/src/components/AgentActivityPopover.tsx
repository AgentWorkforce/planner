/**
 * AgentActivityPopover Component
 *
 * Popover that shows when clicking on a working agent's avatar.
 * Displays current activity, step being worked on, thought preview,
 * and a link to view the full trajectory.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoleConfig } from '@/config/agentRoles';
import { Button } from '@/components/ui/Button';
import type { Agent } from '@/hooks/useAgentOrchestration';

interface AgentActivityPopoverProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Content of the activity popover (can be used standalone or in a portal).
 */
export function AgentActivityPopoverContent({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const roleConfig = getRoleConfig(agent.role);

  const handleViewTrajectory = () => {
    // Navigate to trajectory view for this agent
    navigate(`/trajectories/${agent.id}`);
    onClose();
  };

  return (
    <div className="w-64 bg-bg-tertiary border border-border-subtle rounded-lg shadow-lg p-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
        <span className="text-lg">{roleConfig.icon}</span>
        <span className="text-sm font-medium text-text-primary">
          {roleConfig.label}
        </span>
      </div>

      {/* Status line */}
      {agent.currentActivity && (
        <div className="text-xs text-text-muted mt-2">
          Status: {agent.currentActivity}
        </div>
      )}

      {/* Working on */}
      {agent.currentStep && (
        <div className="text-xs text-text-secondary mt-1">
          Working on: {agent.currentStep}
        </div>
      )}

      {/* Thought preview */}
      {agent.currentThought && (
        <div className="text-xs text-text-muted mt-2 italic line-clamp-2">
          "{agent.currentThought}..."
        </div>
      )}

      {/* View trajectory button */}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full"
        onClick={handleViewTrajectory}
      >
        View Full Trajectory →
      </Button>
    </div>
  );
}

/**
 * Full popover with positioning and backdrop.
 */
export function AgentActivityPopover({
  agent,
  isOpen,
  onClose,
}: AgentActivityPopoverProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop to catch outside clicks */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover positioned above the avatar */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
        <AgentActivityPopoverContent agent={agent} onClose={onClose} />
      </div>
    </>
  );
}

/**
 * Hook for managing popover state.
 */
export function useAgentActivityPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);

  const open = (agent: Agent) => {
    setActiveAgent(agent);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setActiveAgent(null);
  };

  return {
    isOpen,
    activeAgent,
    open,
    close,
  };
}
