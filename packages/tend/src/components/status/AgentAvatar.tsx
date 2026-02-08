/**
 * AgentAvatar Component
 *
 * Visual indicator for an agent showing their current state.
 * Displays role-based emoji icon with state indicators (working dot, needs input ring, etc).
 */

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AgentRole, AgentState } from '@/hooks/useAgentOrchestration';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface NotificationBubble {
  text: string;
  onDismiss?: () => void;
}

interface AgentAvatarProps {
  role: AgentRole;
  state: AgentState;
  size?: AvatarSize;
  onClick?: () => void;
  currentActivity?: string;
  currentStep?: string;
  currentThought?: string;
  displayName?: string;
  notification?: NotificationBubble;
  className?: string;
  /** Agent progress (0-100), shown as a ring when agent is working */
  progress?: number;
}

// Role configuration with icons
const ROLE_CONFIG: Record<AgentRole, { icon: string; label: string }> = {
  architect: { icon: '🏛️', label: 'Architect' },
  'ui-designer': { icon: '🎨', label: 'UI Designer' },
  'data-modeler': { icon: '📊', label: 'Data Modeler' },
  coder: { icon: '💻', label: 'Coder' },
  tester: { icon: '🧪', label: 'Tester' },
  security: { icon: '🔒', label: 'Security' },
  'planner-lead': { icon: '📋', label: 'Planner' },
};

// Human-readable state labels
const STATE_LABELS: Record<AgentState, string> = {
  normal: 'Ready',
  working: 'Working',
  needs_input: 'Needs input',
  idle: 'Idle',
  error: 'Error',
};

// Size configurations
const SIZE_CONFIG = {
  sm: {
    container: 'w-5 h-5',
    icon: 'text-xs',
    indicator: 'w-2 h-2',
    indicatorPosition: '-bottom-0.5 -right-0.5',
  },
  md: {
    container: 'w-8 h-8',
    icon: 'text-base',
    indicator: 'w-2.5 h-2.5',
    indicatorPosition: '-bottom-0.5 -right-0.5',
  },
  lg: {
    container: 'w-10 h-10',
    icon: 'text-lg',
    indicator: 'w-3 h-3',
    indicatorPosition: '-bottom-1 -right-1',
  },
};

// State-based container styles
const STATE_CONTAINER_STYLES: Record<AgentState, string> = {
  normal: 'opacity-100',
  working: 'opacity-100',
  needs_input: 'opacity-100 ring-2 ring-warning/50 ring-offset-1 ring-offset-bg-secondary',
  idle: 'opacity-50',
  error: 'opacity-100',
};

/**
 * Renders a circular progress ring around the avatar.
 */
function ProgressRing({ progress, size }: { progress: number; size: AvatarSize }) {
  // SVG circle dimensions based on avatar size
  const dimensions = {
    sm: { r: 9, cx: 10, cy: 10, viewBox: 20, strokeWidth: 2 },
    md: { r: 14, cx: 16, cy: 16, viewBox: 32, strokeWidth: 2.5 },
    lg: { r: 18, cx: 20, cy: 20, viewBox: 40, strokeWidth: 3 },
  };

  const d = dimensions[size];
  const circumference = 2 * Math.PI * d.r;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <svg
      className="absolute inset-0 -rotate-90"
      viewBox={`0 0 ${d.viewBox} ${d.viewBox}`}
    >
      {/* Background track */}
      <circle
        cx={d.cx}
        cy={d.cy}
        r={d.r}
        fill="none"
        stroke="currentColor"
        strokeWidth={d.strokeWidth}
        className="text-bg-tertiary opacity-30"
      />
      {/* Progress arc */}
      <circle
        cx={d.cx}
        cy={d.cy}
        r={d.r}
        fill="none"
        stroke="currentColor"
        strokeWidth={d.strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        className="text-success transition-all duration-500"
      />
    </svg>
  );
}

/**
 * Renders the state indicator (dot, ring, or warning icon).
 */
function StateIndicator({
  state,
  size,
}: {
  state: AgentState;
  size: AvatarSize;
}) {
  const config = SIZE_CONFIG[size];

  switch (state) {
    case 'working':
      return (
        <div
          className={cn(
            'absolute rounded-full bg-success animate-pulse',
            config.indicatorPosition,
            config.indicator
          )}
        />
      );
    case 'needs_input':
      return (
        <div
          className={cn(
            'absolute rounded-full border-2 border-warning bg-transparent',
            config.indicatorPosition,
            config.indicator
          )}
        />
      );
    case 'error':
      return (
        <div
          className={cn(
            'absolute flex items-center justify-center text-warning text-[10px]',
            config.indicatorPosition,
            config.indicator
          )}
        >
          ⚠
        </div>
      );
    case 'normal':
    case 'idle':
    default:
      return null;
  }
}

export function AgentAvatar({
  role,
  state,
  size = 'md',
  onClick,
  currentActivity,
  currentStep,
  currentThought,
  displayName,
  notification,
  className,
  progress,
}: AgentAvatarProps) {
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.coder;
  const sizeConfig = SIZE_CONFIG[size];
  const containerStateStyle = STATE_CONTAINER_STYLES[state];

  const isClickable = onClick !== undefined;
  const agentLabel = displayName || roleConfig.label;

  // Track state transitions for completion glow
  const prevStateRef = useRef<AgentState>(state);
  const [showCompletionGlow, setShowCompletionGlow] = useState(false);

  useEffect(() => {
    if (prevStateRef.current === 'working' && (state === 'normal' || state === 'idle')) {
      setShowCompletionGlow(true);
      const timer = setTimeout(() => setShowCompletionGlow(false), 1200);
      prevStateRef.current = state;
      return () => clearTimeout(timer);
    }
    prevStateRef.current = state;
    return undefined;
  }, [state]);

  // Build tooltip title
  const hasDetailedInfo = state === 'working' && (currentActivity || currentStep || currentThought);
  const tooltipTitle = hasDetailedInfo
    ? [
        `${agentLabel} - ${STATE_LABELS[state]}`,
        progress != null && progress > 0 && `Progress: ${progress}%`,
        currentActivity && `Activity: ${currentActivity}`,
        currentStep && `Step: ${currentStep}`,
        currentThought && `"${currentThought.slice(0, 100)}${currentThought.length > 100 ? '...' : ''}"`,
      ]
        .filter(Boolean)
        .join('\n')
    : currentActivity
      ? `${agentLabel}: ${currentActivity}`
      : `${agentLabel} - ${STATE_LABELS[state]}`;

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Notification bubble */}
      {notification && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-bg-elevated border border-border-default rounded-lg shadow-lg px-3 py-2 min-w-[200px] max-w-[280px]">
            <p className="text-xs text-text-primary mb-2">{notification.text}</p>
            {notification.onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  notification.onDismiss?.();
                }}
                className="text-xs text-accent-primary hover:text-accent-hover transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
          {/* Pointer arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border-default" />
        </div>
      )}

      {/* Avatar container */}
      <div
        className={cn(
          'relative inline-flex items-center justify-center rounded-full bg-bg-tertiary transition-colors',
          sizeConfig.container,
          containerStateStyle,
          isClickable && 'cursor-pointer hover:bg-bg-elevated',
          showCompletionGlow && 'animate-completion-glow',
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
        {/* Progress ring — shows when agent is working with known progress */}
        {state === 'working' && progress != null && progress > 0 && (
          <ProgressRing progress={progress} size={size} />
        )}

        {/* Role icon */}
        <span className={cn('text-center select-none', sizeConfig.icon)}>
          {roleConfig.icon}
        </span>

        {/* State indicator */}
        <StateIndicator state={state} size={size} />
      </div>
    </div>
  );
}
