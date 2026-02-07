import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChevronIcon } from '@/components/icons/ChevronIcon';
import { MenuIcon } from '@/components/icons/MenuIcon';
import { ConfidenceBar } from '@/components/conversation/ConfidenceBar';
import { useConfidence } from '@/hooks/useConfidence';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * Session info for the dropdown
 */
export interface SessionInfo {
  id: string;
  title: string;
}

/**
 * Specialist status and presence information
 */
export interface SpecialistPresence {
  name: string;
  avatar: string; // emoji
  status: 'idle' | 'thinking' | 'observing' | 'contributing';
  confidence?: number;
}

/**
 * Props for CanvasHeader component
 */
export interface SessionNavProps {
  sessionId: string;
  sessionTitle: string;
  sessions: SessionInfo[];
  onTitleChange?: (newTitle: string) => void;
  onSessionSwitch?: (sessionId: string) => void;
  onOpenUnderstanding?: () => void;
  onHandoff?: () => void;
  className?: string;
}

/**
 * SessionTitleDropdown
 *
 * Internal component that shows the current session title
 * with inline editing and a dropdown to switch between sessions.
 */
interface SessionTitleDropdownProps {
  currentSession: SessionInfo;
  sessions: SessionInfo[];
  onSwitch?: (sessionId: string) => void;
  onTitleChange?: (newTitle: string) => void;
}

function SessionTitleDropdown({
  currentSession,
  sessions,
  onSwitch,
  onTitleChange,
}: SessionTitleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentSession.title);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleDoubleClick = () => {
    setIsEditing(true);
    setIsOpen(false);
  };

  const handleTitleChange = () => {
    if (editValue.trim() && editValue !== currentSession.title) {
      onTitleChange?.(editValue.trim());
    } else {
      setEditValue(currentSession.title);
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleChange();
    } else if (e.key === 'Escape') {
      setEditValue(currentSession.title);
      setIsEditing(false);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    if (sessionId !== currentSession.id) {
      onSwitch?.(sessionId);
    }
    setIsOpen(false);
  };

  // Filter out current session from dropdown list
  const otherSessions = sessions.filter((s) => s.id !== currentSession.id);

  return (
    <div ref={dropdownRef} className="relative">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          className="px-2 py-1 text-sm font-medium bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          onDoubleClick={handleTitleDoubleClick}
          className="flex items-center gap-2 px-2 py-1 text-sm font-medium rounded-md hover:bg-muted transition-colors"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{currentSession.title}</span>
          {otherSessions.length > 0 && (
            <ChevronIcon
              size="sm"
              direction={isOpen ? 'up' : 'down'}
              className="text-muted-foreground"
            />
          )}
        </button>
      )}

      {/* Dropdown menu */}
      {isOpen && otherSessions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 py-1 min-w-[200px] bg-popover border border-border rounded-md shadow-md z-50 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {otherSessions.map((session) => (
            <button
              key={session.id}
              role="option"
              onClick={() => handleSessionSelect(session.id)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted focus:bg-muted focus:outline-none"
            >
              {session.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MobileActionsMenu
 *
 * Dropdown menu for mobile header actions
 * Consolidates AI Understanding and Planner buttons into a menu
 */
interface MobileActionsMenuProps {
  onOpenUnderstanding?: () => void;
  onHandoff?: () => void;
}

function MobileActionsMenu({ onOpenUnderstanding, onHandoff }: MobileActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <MenuIcon size="md" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 py-1 min-w-[180px] bg-popover border border-border rounded-md shadow-md z-50 animate-in fade-in-0 zoom-in-95 duration-100">
          <button
            onClick={() => {
              onOpenUnderstanding?.();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-sm text-left hover:bg-muted focus:bg-muted focus:outline-none min-h-[44px]"
          >
            AI Understanding
          </button>
          <button
            onClick={() => {
              onHandoff?.();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-sm text-left hover:bg-muted focus:bg-muted focus:outline-none min-h-[44px] font-medium"
          >
            → Planner
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * SessionNav
 *
 * Navigation bar for the ideation canvas (fits in the N grid area).
 *
 * Features:
 * - Circle back button (ArrowLeft icon)
 * - Session title with inline editing (double-click to edit)
 * - Session dropdown to switch between sessions
 * - ConfidenceBar
 * - AI Understanding button
 * - Planner button (color coded by confidence)
 * - Mobile: Hamburger menu consolidates actions
 *
 * Layout:
 * - Desktop: `[←] [Session Title ▼] [Confidence] | [AI Understanding] [→ Planner]`
 * - Mobile: `[←] [Session Title] [☰]`
 */
export function SessionNav({
  sessionId,
  sessionTitle,
  sessions,
  onTitleChange,
  onSessionSwitch,
  onOpenUnderstanding,
  onHandoff,
  className,
}: SessionNavProps) {
  const navigate = useNavigate();
  const { score, breakdown } = useConfidence(sessionId);

  return (
    <header
      className={cn(
        'flex items-center justify-between px-2 md:px-4 py-2',
        className,
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-1 md:gap-3 flex-1 min-w-0">
        <button
          onClick={() => navigate('/ideation')}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--canvas-bg-subtle)] transition-colors shrink-0"
          aria-label="Go back to dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--canvas-text-primary)]" />
        </button>

        <SessionTitleDropdown
          currentSession={{ id: sessionId, title: sessionTitle }}
          sessions={sessions}
          onSwitch={onSessionSwitch}
          onTitleChange={onTitleChange}
        />

        <ConfidenceBar score={score} breakdown={breakdown} />
      </div>

      {/* Right section — desktop */}
      <div className="hidden md:flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={onOpenUnderstanding}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--canvas-bg-subtle)] transition-colors text-[var(--canvas-text-primary)]"
        >
          AI Understanding
        </button>
        <button
          onClick={onHandoff}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md text-white font-medium transition-colors',
            score <= 40 && 'bg-error hover:bg-error/90',
            score > 40 && score <= 60 && 'bg-warning hover:bg-warning/90',
            score > 60 && 'bg-success hover:bg-success/90',
          )}
        >
          → Planner
        </button>
      </div>

      {/* Mobile: theme toggle + hamburger menu */}
      <div className="md:hidden flex items-center gap-1">
        <ThemeToggle />
        <MobileActionsMenu onOpenUnderstanding={onOpenUnderstanding} onHandoff={onHandoff} />
      </div>
    </header>
  );
}

// Backwards compatibility aliases
export { SessionNav as CanvasHeader };
export type { SessionNavProps as CanvasHeaderProps };
