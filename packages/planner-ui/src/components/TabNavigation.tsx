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
      className={`tab-navigation ${className}`.trim()}
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
            className={`tab-navigation-item${isActive ? ' tab-navigation-item--active' : ''}`}
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
      className={`tab-panel ${className}`.trim()}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
