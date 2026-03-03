/**
 * AgentIndicator Component
 *
 * Terminal/ASCII-style agent status indicator.
 * Renders a 7-character monospace string per agent for use in the StatusBar.
 *
 * Character Layout:
 * Position 1:    State character (spinner or icon)
 * Position 2-4:  Role abbreviation (3 chars, uppercase)
 * Position 5-7:  Status fill characters (3 block chars)
 *
 * Uses precomputed animation frames (cli-spinners pattern) played back
 * by useFramePlayer. All animation data lives in animation-frames.ts.
 */

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFramePlayer } from '@/hooks/useFramePlayer';
import { SPINNERS, FILLS, STATE_CHARS, buildScrollFrames } from './animation-frames';
import type { Animation } from './animation-frames';
import type { AgentRole, AgentState } from '@/hooks/useAgentOrchestration';

interface AgentIndicatorProps {
  role: AgentRole;
  state: AgentState;
  displayName?: string;
  currentActivity?: string;
  currentStep?: string;
  currentThought?: string;
  progress?: number;
  questionPriority?: 'blocking' | 'normal' | 'fyi';
  onClick?: () => void;
  className?: string;
}

// Role abbreviations
const ROLE_ABBREV: Record<AgentRole, string> = {
  interviewer: 'INT',
  architect: 'ARC',
  'ui-designer': 'UID',
  'data-modeler': 'DAT',
  coder: 'COD',
  tester: 'TST',
  security: 'SEC',
  'planner-lead': 'PLN',
};

// Static spinner animations for non-working states (module-level for stable refs)
const STATIC_SPINNERS: Record<string, Animation> = {
  idle: { interval: 0, frames: [STATE_CHARS.idle ?? ' '] },
  needs_input: { interval: 0, frames: [STATE_CHARS.needs_input ?? '?'] },
  error: { interval: 0, frames: [STATE_CHARS.error ?? '!'] },
};

// Human-readable state labels
const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Idle',
  working: 'Working',
  needs_input: 'Needs input',
  error: 'Error',
};

// Color class per state — only color states that require user attention.
// Animation (spinner, fill) already conveys activity; color is reserved for action-needed.
const STATE_COLORS: Record<AgentState, string> = {
  idle: 'text-text-muted opacity-50',
  working: 'text-text-secondary',
  needs_input: 'text-warning',
  error: 'text-error',
};

export function AgentIndicator({
  role,
  state,
  displayName,
  currentActivity,
  currentStep,
  currentThought,
  progress,
  questionPriority,
  onClick,
  className,
}: AgentIndicatorProps) {
  // Select spinner animation based on state
  const spinnerAnim = useMemo((): Animation => {
    if (state === 'working') return SPINNERS.dots;
    return STATIC_SPINNERS[state] ?? STATIC_SPINNERS.idle!;
  }, [state]);

  // Select fill animation based on state + progress + priority
  const fillAnim = useMemo((): Animation => {
    switch (state) {
      case 'working':
        if (progress != null) {
          if (progress === 0) return FILLS['working:0'];
          if (progress <= 33) return FILLS['working:33'];
          if (progress <= 66) return FILLS['working:66'];
          return FILLS['working:100'];
        }
        return FILLS['working:indeterminate'];
      case 'idle':
        return FILLS.idle;
      case 'needs_input': {
        const key = `needs_input:${questionPriority ?? 'blocking'}` as keyof typeof FILLS;
        return FILLS[key] ?? FILLS['needs_input:blocking'];
      }
      case 'error':
        return FILLS.error;
      default:
        return FILLS.idle;
    }
  }, [state, progress, questionPriority]);

  // Activity scroll animation — built from currentActivity text
  const activityAnim = useMemo((): Animation | null => {
    if (state !== 'working' || !currentActivity) return null;
    return buildScrollFrames(currentActivity, 7);
  }, [state, currentActivity]);

  // Phase toggle: alternate between identity and activity display
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    if (!activityAnim) {
      setShowActivity(false);
      return;
    }
    // Start showing identity, then toggle
    const id = setInterval(() => setShowActivity(prev => !prev), 3000);
    return () => clearInterval(id);
  }, [activityAnim]);

  // Play activity animation (only active when showActivity is true)
  const activityFrame = useFramePlayer(activityAnim ?? { interval: 0, frames: ['·······'] });

  // Play both animations
  const stateChar = useFramePlayer(spinnerAnim);
  const fill = useFramePlayer(fillAnim);

  const abbrev = ROLE_ABBREV[role] || 'UNK';
  const colorClass = STATE_COLORS[state] ?? 'text-text-secondary';

  // Build tooltip
  const tooltipTitle = useMemo((): string => {
    const agentLabel = displayName || ROLE_ABBREV[role];
    const stateLabel = STATE_LABELS[state];

    const hasDetails =
      state === 'working' && (currentActivity || currentStep || currentThought);

    if (!hasDetails) {
      return `${agentLabel} - ${stateLabel}`;
    }

    const lines: string[] = [`${agentLabel} - ${stateLabel}`];

    if (currentActivity) {
      lines.push(`Activity: ${currentActivity}`);
    }

    if (currentStep) {
      lines.push(`Step: ${currentStep}`);
    }

    if (currentThought) {
      const truncated =
        currentThought.length > 100
          ? currentThought.slice(0, 100) + '...'
          : currentThought;
      lines.push(`"${truncated}"`);
    }

    return lines.join('\n');
  }, [displayName, role, state, currentActivity, currentStep, currentThought]);

  const isClickable = onClick !== undefined;

  return (
    <span
      className={cn(
        'font-mono text-sm select-none tracking-tight inline-block',
        colorClass,
        isClickable && 'cursor-pointer hover:brightness-125',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      title={tooltipTitle}
    >
      {showActivity && activityAnim ? activityFrame : <>{stateChar}{abbrev}{fill}</>}
    </span>
  );
}
