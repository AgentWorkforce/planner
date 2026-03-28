/**
 * TabNavigation - Horizontal tab bar with underline active indicator.
 *
 * Used for switching between content panels while preserving state.
 * Follows WAI-ARIA tabs pattern for accessibility.
 */

interface Tab {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabNavigation({
  tabs,
  activeTabId,
  onTabChange,
  className = '',
}: TabNavigationProps) {
  return (
    <div
      className={`flex border-b border-border-subtle ${className}`.trim()}
      role="tablist"
      aria-label="Content tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'text-accent-cyan border-accent-cyan'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * TabPanel - Container for tab content with proper accessibility attributes.
 */
interface TabPanelProps {
  tabId: string;
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ tabId, isActive, children, className = '' }: TabPanelProps) {
  if (!isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className={`py-6 ${className}`.trim()}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
