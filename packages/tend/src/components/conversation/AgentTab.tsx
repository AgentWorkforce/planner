/**
 * AgentTab
 *
 * Individual tab button for an agent in the tab bar.
 * Shows role emoji, agent name, activity indicator, and unread badge.
 */

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'completed' | 'blocked';
  unreadCount?: number;
}

interface AgentTabProps {
  agent: Agent;
  isActive: boolean;
  onClick: () => void;
}

/**
 * Get emoji for agent role
 */
function getRoleEmoji(role: string): string {
  const roleMap: Record<string, string> = {
    coder: '⚙️',
    architect: '📐',
    designer: '🎨',
    tester: '🧪',
    security: '🔒',
    database: '🗄️',
  };

  return roleMap[role.toLowerCase()] || '🤖';
}

/**
 * Get status indicator styling
 */
function getStatusIndicator(status: Agent['status']) {
  switch (status) {
    case 'completed':
      return {
        color: 'bg-success',
        title: 'Completed',
      };
    case 'blocked':
      return {
        color: 'bg-error',
        title: 'Blocked',
      };
    case 'active':
    default:
      return {
        color: 'bg-accent-primary',
        title: 'Active',
        pulse: true,
      };
  }
}

export function AgentTab({ agent, isActive, onClick }: AgentTabProps) {
  const statusIndicator = getStatusIndicator(agent.status);
  const roleEmoji = getRoleEmoji(agent.role);

  return (
    <button
      onClick={onClick}
      className={`
        relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
        ${isActive
          ? 'text-accent-primary border-b-2 border-accent-primary'
          : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
        }
      `}
    >
      <div className="flex items-center gap-2">
        {/* Role emoji */}
        <span className="text-base" aria-hidden="true">
          {roleEmoji}
        </span>

        {/* Agent name */}
        <span>{agent.name}</span>

        {/* Status indicator */}
        <div className="relative">
          <div
            className={`w-2 h-2 rounded-full ${statusIndicator.color} ${
              statusIndicator.pulse ? 'animate-pulse' : ''
            }`}
            title={statusIndicator.title}
          />
        </div>

        {/* Unread badge */}
        {agent.unreadCount && agent.unreadCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent-primary/20 text-accent-primary">
            {agent.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}
