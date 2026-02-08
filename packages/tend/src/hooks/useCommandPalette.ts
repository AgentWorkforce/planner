import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session } from './useIdeationApi';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  action: () => void;
  group?: string;
}

interface UseCommandPaletteProps {
  sessions?: Session[];
}

export function useCommandPalette({ sessions = [] }: UseCommandPaletteProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Build command actions
  const actions = useMemo(() => {
    const commandActions: CommandAction[] = [];

    // Navigation actions
    commandActions.push({
      id: 'nav-home',
      label: 'Go to Home',
      description: 'Return to home page',
      icon: 'home',
      keywords: ['home', 'dashboard'],
      action: () => {
        navigate('/');
        setIsOpen(false);
      },
      group: 'Navigation',
    });

    commandActions.push({
      id: 'new-project',
      label: 'New Project',
      description: 'Create a new project',
      icon: 'plus',
      keywords: ['new', 'create', 'project'],
      action: () => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('command:new-project'));
      },
      group: 'Actions',
    });

    // Settings
    commandActions.push({
      id: 'settings',
      label: 'Settings',
      description: 'Open user settings',
      icon: 'settings',
      keywords: ['settings', 'preferences', 'config'],
      action: () => {
        navigate('/settings');
        setIsOpen(false);
      },
      group: 'Actions',
    });

    // Add session navigation actions (sessions are linked to projects in tend)
    sessions.forEach((session) => {
      const label = session.source.initial_intent || 'Untitled Session';
      commandActions.push({
        id: `session-${session.id}`,
        label: label.length > 60 ? label.substring(0, 60) + '...' : label,
        description: `Go to session - ${session.status}`,
        icon: 'session',
        keywords: ['session', 'go to', label, session.status],
        action: () => {
          // In tend, sessions are accessed via project context
          navigate('/');
          setIsOpen(false);
        },
        group: 'Sessions',
      });
    });

    return commandActions;
  }, [sessions, navigate]);

  // Fuzzy search filter
  const filteredActions = useMemo(() => {
    if (!query.trim()) {
      return actions;
    }

    const searchTerms = query.toLowerCase().split(' ').filter(Boolean);

    return actions.filter((action) => {
      const searchableText = [
        action.label,
        action.description || '',
        ...(action.keywords || []),
      ].join(' ').toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, [actions, query]);

  // Group actions
  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};

    filteredActions.forEach((action) => {
      const group = action.group || 'Other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(action);
    });

    return groups;
  }, [filteredActions]);

  // Reset selection when filtered actions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredActions.length, query]);

  // Keyboard handler for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const executeAction = useCallback((action: CommandAction) => {
    action.action();
  }, []);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev < filteredActions.length - 1 ? prev + 1 : prev
    );
  }, [filteredActions.length]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const executeSelected = useCallback(() => {
    if (filteredActions[selectedIndex]) {
      executeAction(filteredActions[selectedIndex]);
    }
  }, [filteredActions, selectedIndex, executeAction]);

  return {
    isOpen,
    query,
    setQuery,
    selectedIndex,
    filteredActions,
    groupedActions,
    open,
    close,
    executeAction,
    selectNext,
    selectPrevious,
    executeSelected,
  };
}
