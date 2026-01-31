import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DecisionLogHeaderProps {
  /** Total count of decisions */
  count: number;
  /** List of agent roles for filtering */
  agents: string[];
  /** Currently selected agent role (or 'all') */
  selectedAgent: string;
  /** Callback when agent filter changes */
  onAgentChange: (agent: string) => void;
}

/**
 * Header for Decision Log with title and agent filter dropdown.
 *
 * Design spec:
 * - Layout: flex items-center justify-between px-4 py-3 border-b border-border-subtle
 * - Title: text-lg font-semibold text-text-primary
 * - Filter: Select component with agent roles + "All agents" option
 *
 * Usage:
 * ```tsx
 * <DecisionLogHeader
 *   count={42}
 *   agents={['Planner', 'Coder', 'Reviewer']}
 *   selectedAgent="all"
 *   onAgentChange={(agent) => setSelectedAgent(agent)}
 * />
 * ```
 */
export function DecisionLogHeader({
  count,
  agents,
  selectedAgent,
  onAgentChange,
}: DecisionLogHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
      {/* Title with count */}
      <h2 className="text-lg font-semibold text-text-primary">
        Decisions ({count})
      </h2>

      {/* Agent filter dropdown */}
      <Select value={selectedAgent} onValueChange={onAgentChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All agents</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent} value={agent}>
              {agent}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
