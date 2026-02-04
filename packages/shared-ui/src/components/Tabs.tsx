import { useState } from "react";
import { cn } from "../utils/cn";

export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  /** Array of tab definitions */
  tabs: Tab[];
  /** Currently active tab ID (controlled mode) */
  activeTab?: string;
  /** Default active tab ID (uncontrolled mode) */
  defaultTab?: string;
  /** Callback when tab changes */
  onChange?: (tabId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tab navigation component with controlled and uncontrolled modes.
 */
export function Tabs({
  tabs,
  activeTab: controlledActiveTab,
  defaultTab,
  onChange,
  className,
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab ?? tabs[0]?.id
  );

  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }
    onChange?.(tabId);
  };

  return (
    <div className={cn("flex border-b border-border", className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            disabled={tab.disabled}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
