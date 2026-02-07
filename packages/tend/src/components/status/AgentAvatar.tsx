/**
 * AgentAvatar Component
 *
 * Visual indicator for an agent showing their current state.
 * Displays role-based emoji icon with state indicators (working dot, needs input ring, etc).
 *
 * Adapted from planner-ui with tend's earth-tone color palette.
 */

import type { ReactNode } from 'react';
import { getRoleConfig } from '../../config/agentRoles';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/Tooltip';
import type { AgentRole, AgentState } from '../../hooks/useAgentOrchestration';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AgentAvatarProps {
  role: AgentRole;
  state: AgentState;
  size?: AvatarSize;
  onClick?: () => void;
  currentActivity?: string;
  currentStep?: string;
  currentThought?: string;
  displayName?: string;
  /** Duration in seconds agent has been waiting for input (for escalation animation) */
  waitingDuration?: number;
  /** Whether to show tooltip on hover (default: true) */
  showTooltip?: boolean;
  className?: string;
  /** Custom notification content to display in forced-open tooltip */
  notificationContent?: ReactNode;
  /** Whether to show the notification bubble (forces tooltip open) */
  showNotification?: boolean;
  /** Callback when notification bubble is clicked */
  onNotificationClick?: () => void;
}

// Human-readable state labels for tooltip
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

// State-based container styles (earth-tone adapted)
const STATE_CONTAINER_STYLES: Record<AgentState, string> = {
  normal: 'opacity-100',
  working: 'opacity-100',
  needs_input: 'opacity-100 ring-2 ring-[var(--color-brick)] ring-offset-1 ring-offset-[var(--canvas-bg)]',
  idle: 'opacity-50',
  error: 'opacity-100',
};

/**
 * Renders the state indicator (dot, ring, or warning icon).
 * Uses earth-tone colors: moss green for working, brick red for needs_input.
 */
function StateIndicator({
  state,
  size,
  waitingDuration = 0,
}: {
  state: AgentState;
  size: AvatarSize;
  waitingDuration?: number;
}) {
  const config = SIZE_CONFIG[size];
  // Escalate animation after 2 minutes of waiting
  const isEscalated = waitingDuration >= 120;

  switch (state) {
    case 'working':
      return (
        <div
          className={`absolute ${config.indicatorPosition} ${config.indicator} rounded-full bg-[var(--color-moss)] animate-pulse`}
        />
      );
    case 'needs_input':
      return (
        <div
          className={`absolute ${config.indicatorPosition} ${config.indicator} rounded-full border-2 border-[var(--color-brick)] bg-transparent ${
            isEscalated ? 'animate-ring-escalate' : ''
          }`}
        />
      );
    case 'error':
      return (
        <div
          className={`absolute ${config.indicatorPosition} ${config.indicator} flex items-center justify-center text-[var(--color-clay)] text-[10px]`}
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
  waitingDuration = 0,
  showTooltip = true,
  className = '',
  notificationContent,
  showNotification = false,
  onNotificationClick,
}: AgentAvatarProps) {
  const roleConfig = getRoleConfig(role);
  const sizeConfig = SIZE_CONFIG[size];
  const containerStateStyle = STATE_CONTAINER_STYLES[state];

  const isClickable = onClick !== undefined || (showNotification && onNotificationClick !== undefined);

  // Build tooltip content - richer for working agents
  const agentLabel = displayName || roleConfig.label;

  // For working agents with detailed info, show structured content
  const hasDetailedInfo = state === 'working' && (currentActivity || currentStep || currentThought);

  const tooltipContent = hasDetailedInfo ? (
    <div className="space-y-1 max-w-xs">
      <div className="font-medium">{agentLabel}</div>
      {currentActivity && (
        <div className="text-xs opacity-90">
          <span className="opacity-70">Activity:</span> {currentActivity}
        </div>
      )}
      {currentStep && (
        <div className="text-xs opacity-90">
          <span className="opacity-70">Step:</span> {currentStep}
        </div>
      )}
      {currentThought && (
        <div className="text-xs opacity-80 italic">
          "{currentThought.length > 100 ? currentThought.slice(0, 100) + '...' : currentThought}"
        </div>
      )}
    </div>
  ) : (
    currentActivity
      ? `${agentLabel}: ${currentActivity}`
      : `${agentLabel} - ${STATE_LABELS[state]}`
  );

  const avatarElement = (
    <div
      className={`
        relative inline-flex items-center justify-center
        rounded-full bg-[var(--canvas-card-bg)]
        ${sizeConfig.container}
        ${containerStateStyle}
        ${isClickable ? 'cursor-pointer hover:bg-[var(--canvas-card-bg-hover)]' : ''}
        transition-colors
        ${className}
      `}
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
    >
      {/* Role icon */}
      <span className={`text-center select-none ${sizeConfig.icon}`}>
        {roleConfig.icon}
      </span>

      {/* State indicator */}
      <StateIndicator state={state} size={size} waitingDuration={waitingDuration} />
    </div>
  );

  if (!showTooltip && !showNotification) {
    return avatarElement;
  }

  // Notification mode: force tooltip open with custom content
  if (showNotification && notificationContent) {
    const handleClick = () => {
      if (onNotificationClick) {
        onNotificationClick();
      } else if (onClick) {
        onClick();
      }
    };

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip open={true}>
          <TooltipTrigger asChild>
            <div onClick={handleClick} className="cursor-pointer">
              {avatarElement}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={8}
            className="p-0 bg-transparent border-0 shadow-none animate-notification-enter"
            onClick={handleClick}
          >
            {notificationContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Normal tooltip mode
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-[var(--canvas-card-bg)] text-[var(--text-primary)] border-[var(--block-draft-border)]"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
