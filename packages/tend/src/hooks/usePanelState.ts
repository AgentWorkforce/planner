import { useState, useEffect, useCallback } from 'react';

const PANEL_STATE_KEY = 'ideation-panel-collapsed';

export function usePanelState() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(PANEL_STATE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(PANEL_STATE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const togglePanel = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const expandPanel = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const collapsePanel = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  return {
    isCollapsed,
    togglePanel,
    expandPanel,
    collapsePanel,
  };
}
