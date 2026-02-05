import { useState, useRef, useCallback } from "react";
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
  /** Orientation for keyboard navigation */
  orientation?: "horizontal" | "vertical";
  /** Whether to automatically activate tab on focus (vs manual activation with Enter/Space) */
  activateOnFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tab navigation component with keyboard navigation, controlled and uncontrolled modes.
 * Supports arrow key navigation (Left/Right for horizontal, Up/Down for vertical).
 * Home/End keys jump to first/last tab.
 */
export function Tabs({
  tabs,
  activeTab: controlledActiveTab,
  defaultTab,
  onChange,
  orientation = "horizontal",
  activateOnFocus = true,
  className,
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab ?? tabs[0]?.id
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = useCallback((tabId: string) => {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }
    onChange?.(tabId);
  }, [controlledActiveTab, onChange]);

  const focusTab = useCallback((index: number) => {
    const tab = tabs[index];
    if (tab && !tab.disabled) {
      tabRefs.current[index]?.focus();
      if (activateOnFocus) {
        handleTabClick(tab.id);
      }
    }
  }, [tabs, activateOnFocus, handleTabClick]);

  const findNextEnabledTab = useCallback((currentIndex: number, direction: 1 | -1): number => {
    let nextIndex = currentIndex;
    const tabCount = tabs.length;

    for (let i = 0; i < tabCount; i++) {
      nextIndex = (nextIndex + direction + tabCount) % tabCount;
      if (!tabs[nextIndex].disabled) {
        return nextIndex;
      }
    }
    return currentIndex;
  }, [tabs]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const isHorizontal = orientation === "horizontal";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

    switch (e.key) {
      case prevKey:
        e.preventDefault();
        focusTab(findNextEnabledTab(currentIndex, -1));
        break;
      case nextKey:
        e.preventDefault();
        focusTab(findNextEnabledTab(currentIndex, 1));
        break;
      case "Home":
        e.preventDefault();
        focusTab(findNextEnabledTab(-1, 1));
        break;
      case "End":
        e.preventDefault();
        focusTab(findNextEnabledTab(tabs.length, -1));
        break;
      case "Enter":
      case " ":
        if (!activateOnFocus) {
          e.preventDefault();
          const tab = tabs[currentIndex];
          if (tab && !tab.disabled) {
            handleTabClick(tab.id);
          }
        }
        break;
    }
  }, [orientation, focusTab, findNextEnabledTab, tabs, activateOnFocus, handleTabClick]);

  return (
    <div
      className={cn(
        "flex border-b border-border",
        orientation === "vertical" && "flex-col border-b-0 border-r",
        className
      )}
      role="tablist"
      aria-orientation={orientation}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
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
              <span
                className={cn(
                  "absolute bg-primary",
                  orientation === "horizontal"
                    ? "bottom-0 left-0 right-0 h-0.5"
                    : "top-0 bottom-0 right-0 w-0.5"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tab ID this panel belongs to */
  tabId: string;
  /** Whether this panel is active */
  isActive: boolean;
}

/**
 * Tab panel component for tab content.
 * Only renders children when active (default) or can be kept mounted with hidden attribute.
 */
export function TabPanel({
  tabId,
  isActive,
  children,
  className,
  ...props
}: TabPanelProps) {
  if (!isActive) return null;

  return (
    <div
      id={`tabpanel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`tab-${tabId}`}
      tabIndex={0}
      className={cn("focus:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
