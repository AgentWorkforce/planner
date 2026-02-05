/**
 * DecisionList Component
 *
 * Displays a list of decision events in the Decision Log.
 * Handles empty state gracefully.
 *
 * Props:
 * - decisions: Array of decision events to display
 * - selectedId: ID of currently selected decision (for highlighting)
 * - onSelect: Callback when a decision row is clicked
 */

import type { DecisionEvent } from '@/types/trajectory';
import { DecisionRow } from './DecisionRow';

interface DecisionListProps {
  decisions: DecisionEvent[];
  selectedId: string | null;
  onSelect: (eventId: string) => void;
}

export function DecisionList({ decisions, selectedId, onSelect }: DecisionListProps) {
  // Handle empty state - show nothing (parent component handles empty state display)
  if (decisions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {decisions.map((decision) => (
        <DecisionRow
          key={decision.event_id}
          decision={decision}
          isSelected={decision.event_id === selectedId}
          onClick={() => onSelect(decision.event_id)}
        />
      ))}
    </div>
  );
}
