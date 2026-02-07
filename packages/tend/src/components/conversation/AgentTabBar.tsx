import { AgentTab as AgentTabType } from '@/types/conversation';
import { AgentTab } from './AgentTab';

interface AgentTabBarProps {
  tabs: AgentTabType[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

/**
 * AgentTabBar - Horizontal tab bar showing active agent channels
 *
 * Features:
 * - Horizontal tab bar above conversation
 * - "All" tab (default) shows all messages
 * - One tab per active agent channel
 * - Active tab has bottom border in moss green
 * - Tab order: "All" first, then by most recent message
 *
 * Usage:
 * <AgentTabBar
 *   tabs={[
 *     { id: 'all', label: 'All', channel_id: 'all' },
 *     { id: '#planning', label: 'Planning', channel_id: '#planning', unread_count: 2 }
 *   ]}
 *   activeTab="all"
 *   onTabChange={(tabId) => console.log("Active tab:", tabId)}
 * />
 */
export function AgentTabBar({ tabs, activeTab, onTabChange }: AgentTabBarProps) {
  // Sort tabs: "All" first, then by last_message_at (most recent first)
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.id === 'all') return -1;
    if (b.id === 'all') return 1;

    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime; // Most recent first
  });

  return (
    <div
      className="flex items-center gap-1 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]"
      role="tablist"
      aria-label="Agent conversation tabs"
    >
      {sortedTabs.map((tab) => (
        <AgentTab
          key={tab.id}
          label={tab.label}
          isActive={activeTab === tab.id}
          unreadCount={tab.unread_count}
          agentRole={tab.agent_role}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </div>
  );
}
