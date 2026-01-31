/**
 * DecisionLogPage
 *
 * Decision Log view that integrates all trajectory components.
 * Displays user decisions, preferences, and provides filtering/detail view.
 *
 * Features:
 * - Filter decisions by agent role
 * - Click decision to see detail sheet
 * - Show derived preferences summary
 * - Empty state when no decisions
 * - Real-time updates via SSE
 *
 * Layout:
 * - container: flex flex-col h-full bg-bg-primary
 * - Full width with padding (matches PlanEditorPage)
 */

import { useState, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useUserTrajectory } from '@/hooks/useUserTrajectory';
import { DecisionLogHeader } from '@/components/trajectory/DecisionLogHeader';
import { DecisionList } from '@/components/trajectory/DecisionList';
import { DecisionEmptyState } from '@/components/trajectory/DecisionEmptyState';
import { DecisionDetailSheet } from '@/components/trajectory/DecisionDetailSheet';
import { PreferencesSummary } from '@/components/trajectory/PreferencesSummary';
import { DocumentIcon, DecisionsIcon } from '@/components/icons';

export function DecisionLogPage() {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();

  // State for filtering and selection
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Fetch trajectory data
  const { decisions, preferences, isLoading, error } = useUserTrajectory(planId || null);

  // Extract unique agent roles from decisions
  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    decisions.forEach((decision) => {
      if (decision.asking_agent) {
        agents.add(decision.asking_agent);
      }
    });
    return Array.from(agents).sort();
  }, [decisions]);

  // Filter decisions by agent
  const filteredDecisions = useMemo(() => {
    if (agentFilter === 'all') {
      return decisions;
    }
    return decisions.filter((decision) => decision.asking_agent === agentFilter);
  }, [decisions, agentFilter]);

  // Get selected decision object
  const selectedDecision = useMemo(() => {
    if (!selectedDecisionId) return null;
    return decisions.find((d) => d.event_id === selectedDecisionId) || null;
  }, [decisions, selectedDecisionId]);

  // Handle decision row click
  const handleDecisionSelect = (eventId: string) => {
    setSelectedDecisionId(eventId);
    setSheetOpen(true);
  };

  // Handle sheet close
  const handleSheetClose = () => {
    setSheetOpen(false);
    // Keep selectedDecisionId to preserve selection when reopening
  };

  // Handle agent filter change
  const handleAgentChange = (agent: string) => {
    setAgentFilter(agent);
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="w-full py-12 px-6">
          <div className="text-center">
            <p className="text-text-error text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && decisions.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="w-full py-12 px-6">
          <div className="text-center">
            <p className="text-text-muted text-sm">Loading decisions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <div className="w-full flex flex-col h-full">
        {/* Tab navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 border-b border-border-subtle bg-bg-card">
          <Link
            to={`/plans/${planId}`}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location.pathname === `/plans/${planId}`
                ? 'bg-bg-tertiary text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            <DocumentIcon size="sm" />
            <span>Plan</span>
          </Link>
          <Link
            to={`/plans/${planId}/decisions`}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location.pathname === `/plans/${planId}/decisions`
                ? 'bg-bg-tertiary text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            <DecisionsIcon size="sm" />
            <span>Decisions</span>
          </Link>
        </div>

        {/* Header with title and agent filter */}
        <DecisionLogHeader
          count={filteredDecisions.length}
          agents={uniqueAgents}
          selectedAgent={agentFilter}
          onAgentChange={handleAgentChange}
        />

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Preferences summary (if preferences exist) */}
          {preferences.length > 0 && (
            <div className="px-6 pt-4">
              <PreferencesSummary preferences={preferences} />
            </div>
          )}

          {/* Decision list or empty state */}
          {filteredDecisions.length > 0 ? (
            <DecisionList
              decisions={filteredDecisions}
              selectedId={selectedDecisionId}
              onSelect={handleDecisionSelect}
            />
          ) : (
            <DecisionEmptyState />
          )}
        </div>

        {/* Decision detail sheet */}
        <DecisionDetailSheet
          decision={selectedDecision}
          open={sheetOpen}
          onClose={handleSheetClose}
        />
      </div>
    </div>
  );
}
