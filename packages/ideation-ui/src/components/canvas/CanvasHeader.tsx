import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronIcon } from '@/components/icons/ChevronIcon';
import { MenuIcon } from '@/components/icons/MenuIcon';

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
export interface CanvasHeaderProps {
  sessionId: string;
  sessionTitle: string;
  sessions: SessionInfo[];
  specialists?: SpecialistPresence[];
  onTitleChange?: (newTitle: string) => void;
  onSessionSwitch?: (sessionId: string) => void;
  onOpenUnderstanding?: () => void;
  onHandoff?: () => void;
  onSpecialistClick?: (specialistName: string) => void;
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
 * SpecialistAvatars
 *
 * Displays presence indicators for active AI specialists.
 * Shows specialist avatars with status-based styling:
 * - idle: faded opacity
 * - thinking: pulsing animation
 * - observing: normal opacity
 * - contributing: ring highlight
 *
 * Clicking an avatar triggers onSpecialistClick callback,
 * which should open AI Understanding focused on that specialist.
 */
interface SpecialistAvatarsProps {
  specialists?: SpecialistPresence[];
  onSpecialistClick?: (name: string) => void;
}

function SpecialistAvatars({ specialists, onSpecialistClick }: SpecialistAvatarsProps) {
  if (!specialists || specialists.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 border-l border-r mx-2">
      {specialists.map((specialist) => (
        <button
          key={specialist.name}
          onClick={() => onSpecialistClick?.(specialist.name)}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all',
            'hover:scale-110 hover:shadow-md',
            specialist.status === 'idle' && 'opacity-40',
            specialist.status === 'thinking' && 'animate-pulse',
            specialist.status === 'contributing' && 'ring-2 ring-primary',
          )}
          title={`${specialist.name}: ${specialist.status}`}
          aria-label={`${specialist.name} specialist - ${specialist.status}`}
        >
          {specialist.avatar}
        </button>
      ))}
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
 * CanvasHeader
 *
 * Header bar for the ideation canvas view.
 *
 * Features:
 * - Back button to navigate to /ideation dashboard
 * - Session title with inline editing (double-click to edit)
 * - Session dropdown to switch between sessions
 * - Specialist presence indicators (shows active AI specialists)
 * - AI Understanding button to open understanding drawer
 * - Planner button to initiate handoff to planner
 * - Mobile: Hamburger menu consolidates actions
 *
 * Layout:
 * - Desktop: `[← Back] [Session Title ▼] | [🏗️ 🎨 ⚙️] | [AI Understanding] [→ Planner]`
 * - Mobile: `[← Back] [Session Title] [☰]`
 *
 * @example
 * ```tsx
 * <CanvasHeader
 *   sessionId="123"
 *   sessionTitle="My Session"
 *   sessions={allSessions}
 *   specialists={[
 *     { name: 'Architect', avatar: '🏗️', status: 'thinking' },
 *     { name: 'Designer', avatar: '🎨', status: 'idle' }
 *   ]}
 *   onTitleChange={(title) => updateSession({ title })}
 *   onSessionSwitch={(id) => navigate(`/ideation/session/${id}/canvas`)}
 *   onOpenUnderstanding={() => setDrawerOpen(true)}
 *   onHandoff={() => setHandoffDialogOpen(true)}
 *   onSpecialistClick={(name) => openUnderstanding({ focusSpecialist: name })}
 * />
 * ```
 */
export function CanvasHeader({
  sessionId,
  sessionTitle,
  sessions,
  specialists,
  onTitleChange,
  onSessionSwitch,
  onOpenUnderstanding,
  onHandoff,
  onSpecialistClick,
  className,
}: CanvasHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'h-14 flex items-center justify-between px-2 md:px-4 bg-[var(--canvas-bg)]',
        className
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-1 md:gap-3 flex-1 min-w-0">
        <button
          onClick={() => navigate('/ideation')}
          className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
          aria-label="Back to dashboard"
        >
          ← <span className="hidden sm:inline">Back</span>
        </button>

        <SessionTitleDropdown
          currentSession={{ id: sessionId, title: sessionTitle }}
          sessions={sessions}
          onSwitch={onSessionSwitch}
          onTitleChange={onTitleChange}
        />
      </div>

      {/* Center section - Specialist presence indicators (hidden on mobile) */}
      <div className="hidden md:flex">
        <SpecialistAvatars specialists={specialists} onSpecialistClick={onSpecialistClick} />
      </div>

      {/* Right section */}
      {/* Desktop: Show both buttons */}
      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={onOpenUnderstanding}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
        >
          AI Understanding
        </button>
        <button
          onClick={onHandoff}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          → Planner
        </button>
      </div>

      {/* Mobile: Show hamburger menu */}
      <div className="md:hidden">
        <MobileActionsMenu onOpenUnderstanding={onOpenUnderstanding} onHandoff={onHandoff} />
      </div>
    </header>
  );
}
