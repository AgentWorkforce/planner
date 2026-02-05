import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useUserTrajectory } from '@/hooks/useUserTrajectory';
import { DecisionLogHeader } from '@/components/trajectory/DecisionLogHeader';
import { DecisionList } from '@/components/trajectory/DecisionList';
import { DecisionEmptyState } from '@/components/trajectory/DecisionEmptyState';
import { DecisionDetailSheet } from '@/components/trajectory/DecisionDetailSheet';
import { PreferencesSummary } from '@/components/trajectory/PreferencesSummary';

export function DecisionsTabContent() {
  const { planId } = useParams<{ planId: string }>();

  // Decision-related state
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [decisionSheetOpen, setDecisionSheetOpen] = useState(false);

  // Fetch trajectory data
  const { decisions, preferences, isLoading: decisionsLoading, error: decisionsError } = useUserTrajectory(planId || null);

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
    setDecisionSheetOpen(true);
  };

  // Handle decision sheet close
  const handleDecisionSheetClose = () => {
    setDecisionSheetOpen(false);
  };

  return (
    <div className="px-6 py-6 space-y-6 overflow-hidden">
      {/* Header with title and agent filter */}
      <DecisionLogHeader
        count={filteredDecisions.length}
        agents={uniqueAgents}
        selectedAgent={agentFilter}
        onAgentChange={setAgentFilter}
      />

      {/* Main content area */}
      <div>
        {/* Preferences summary (if preferences exist) */}
        {preferences.length > 0 && (
          <div className="mb-4">
            <PreferencesSummary preferences={preferences} />
          </div>
        )}

        {/* Decision list or empty state */}
        {decisionsLoading && decisions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-muted text-sm">Loading decisions...</p>
          </div>
        ) : decisionsError ? (
          <div className="py-12 text-center">
            <p className="text-error text-sm">{decisionsError}</p>
          </div>
        ) : filteredDecisions.length > 0 ? (
          <DecisionList
            decisions={filteredDecisions}
            selectedId={selectedDecisionId}
            onSelect={handleDecisionSelect}
          />
        ) : (
          <DecisionEmptyState />
        )}
      </div>

      {/* Decision detail sheet - only render when open */}
      {decisionSheetOpen && (
        <DecisionDetailSheet
          decision={selectedDecision}
          open={decisionSheetOpen}
          onClose={handleDecisionSheetClose}
        />
      )}
    </div>
  );
}
