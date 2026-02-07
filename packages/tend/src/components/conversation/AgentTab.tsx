import { cn } from '@/lib/utils';

interface AgentTabProps {
  label: string;
  isActive: boolean;
  unreadCount?: number;
  agentRole?: string;
  onClick: () => void;
}

/**
 * AgentTab - Individual tab showing agent icon, label, unread count badge
 *
 * Features:
 * - Active: bold text + moss underline
 * - Inactive: muted text, hover state
 * - Unread count badge when messages waiting
 * - Agent role indicator (optional)
 *
 * Usage:
 * <AgentTab
 *   label="Planning"
 *   isActive={true}
 *   unreadCount={3}
 *   agentRole="planner"
 *   onClick={() => console.log("Tab clicked")}
 * />
 */
export function AgentTab({
  label,
  isActive,
  unreadCount,
  agentRole,
  onClick,
}: AgentTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-4 py-2 text-sm transition-colors',
        'border-b-2 whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-moss)]',
        isActive
          ? 'border-[var(--color-moss)] text-[var(--color-text-primary)] font-semibold'
          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
      )}
      role="tab"
      aria-selected={isActive}
      aria-label={`${label}${unreadCount ? ` (${unreadCount} unread)` : ''}`}
    >
      {/* Label */}
      <span className="flex items-center gap-2">
        {label}
        {/* Agent role indicator (optional subtle icon) */}
        {agentRole && !isActive && (
          <span className="text-xs text-[var(--color-text-dim)]">
            ({agentRole})
          </span>
        )}
      </span>

      {/* Unread badge */}
      {unreadCount && unreadCount > 0 && !isActive && (
        <span
          className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-[var(--color-clay)] text-[var(--color-text-inverse)] text-xs font-medium"
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}
