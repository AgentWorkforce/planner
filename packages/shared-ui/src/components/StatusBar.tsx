import { cn } from "../utils/cn";
import { Badge } from "./Badge";

export interface AgentStatus {
  id: string;
  name: string;
  avatar: string; // emoji or icon
  status: "idle" | "thinking" | "observing" | "contributing";
  confidence?: number;
}

export interface StatusAction {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
}

export interface StatusBarProps {
  agents: AgentStatus[];
  overallConfidence?: number;
  actions?: StatusAction[];
  className?: string;
}

/**
 * StatusBar component for displaying agent presence and status.
 * Shows agent avatars with status indicators, optional confidence, and actions.
 *
 * @example
 * ```tsx
 * <StatusBar
 *   agents={[
 *     { id: '1', name: 'Coder', avatar: '🤖', status: 'thinking' },
 *     { id: '2', name: 'Designer', avatar: '🎨', status: 'contributing', confidence: 85 }
 *   ]}
 *   overallConfidence={78}
 *   actions={[
 *     { id: 'save', label: 'Save', icon: '💾', onClick: () => {} }
 *   ]}
 * />
 * ```
 */
export function StatusBar({
  agents,
  overallConfidence,
  actions,
  className,
}: StatusBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-2 border-b bg-background",
        className
      )}
    >
      {/* Agent avatars */}
      <div className="flex items-center gap-1">
        {agents.map((agent) => (
          <AgentAvatar key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Optional overall confidence */}
      {overallConfidence !== undefined && (
        <Badge variant="outline" size="sm" className="text-xs">
          {overallConfidence}% confidence
        </Badge>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className="text-sm px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Internal component for rendering individual agent avatars with status.
 */
function AgentAvatar({ agent }: { agent: AgentStatus }) {
  const statusColors = {
    idle: "bg-gray-400",
    thinking: "bg-yellow-400",
    observing: "bg-blue-400",
    contributing: "bg-green-400",
  };

  return (
    <div
      className="relative"
      title={`${agent.name}: ${agent.status}${
        agent.confidence ? ` (${agent.confidence}% confidence)` : ""
      }`}
    >
      {/* Agent avatar (emoji) */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-lg bg-muted",
          agent.status === "idle" && "opacity-50",
          agent.status === "thinking" && "animate-pulse",
          agent.status === "contributing" && "ring-2 ring-primary"
        )}
      >
        {agent.avatar}
      </div>

      {/* Status dot */}
      <div
        className={cn(
          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
          statusColors[agent.status]
        )}
      />
    </div>
  );
}
