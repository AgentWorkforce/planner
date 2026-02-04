/**
 * TimelineEvent - Individual event display in the timeline
 *
 * Shows:
 * - Timestamp relative to run start in HH:MM:SS format
 * - Event type icon with color coding
 * - Event description with context (task title, agent name)
 * - Expandable details section for complex events
 * - Artifact links if event has associated artifacts
 *
 * Fixed heights for virtualization:
 * - Collapsed: 56px
 * - Expanded: 120px
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TimelineEvent as TimelineEventType, ArtifactLink } from '@/types';

interface TimelineEventProps {
  event: TimelineEventType;
  runStartTime?: string;
  className?: string;
  onHeightChange?: (expanded: boolean) => void;
}

/**
 * Format timestamp relative to run start time
 */
function formatRelativeTime(timestamp: string, runStartTime?: string): string {
  const eventTime = new Date(timestamp).getTime();
  const startTime = runStartTime ? new Date(runStartTime).getTime() : eventTime;
  const diffMs = eventTime - startTime;

  if (diffMs < 0) return '00:00:00';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get event type configuration (icon, color, label)
 */
function getEventConfig(eventType: string): {
  icon: JSX.Element;
  colorClass: string;
  bgClass: string;
  label: string;
} {
  const iconClass = 'h-4 w-4';

  switch (eventType) {
    case 'run_started':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        ),
        colorClass: 'text-accent-cyan',
        bgClass: 'bg-accent-cyan/10',
        label: 'Run Started',
      };
    case 'run_completed':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        colorClass: 'text-accent-cyan',
        bgClass: 'bg-accent-cyan/10',
        label: 'Run Completed',
      };
    case 'run_failed':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
        colorClass: 'text-accent-cyan',
        bgClass: 'bg-accent-cyan/10',
        label: 'Run Failed',
      };
    case 'task_started':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        colorClass: 'text-success',
        bgClass: 'bg-success/10',
        label: 'Task Started',
      };
    case 'task_completed':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        colorClass: 'text-success',
        bgClass: 'bg-success/10',
        label: 'Task Completed',
      };
    case 'task_failed':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
        colorClass: 'text-error',
        bgClass: 'bg-error/10',
        label: 'Task Failed',
      };
    case 'agent_spawned':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        colorClass: 'text-accent-purple',
        bgClass: 'bg-accent-purple/10',
        label: 'Agent Spawned',
      };
    case 'agent_exited':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        ),
        colorClass: 'text-accent-purple',
        bgClass: 'bg-accent-purple/10',
        label: 'Agent Exited',
      };
    case 'gate_reached':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
        colorClass: 'text-warning',
        bgClass: 'bg-warning/10',
        label: 'Gate Reached',
      };
    case 'gate_approved':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            <polyline points="9 17 12 20 22 10" />
          </svg>
        ),
        colorClass: 'text-warning',
        bgClass: 'bg-warning/10',
        label: 'Gate Approved',
      };
    case 'gate_rejected':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <line x1="9" y1="15" x2="15" y2="21" />
            <line x1="15" y1="15" x2="9" y2="21" />
          </svg>
        ),
        colorClass: 'text-warning',
        bgClass: 'bg-warning/10',
        label: 'Gate Rejected',
      };
    case 'question_asked':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        colorClass: 'text-info',
        bgClass: 'bg-info/10',
        label: 'Question Asked',
      };
    case 'question_answered':
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <polyline points="9 11 12 14 22 4" />
          </svg>
        ),
        colorClass: 'text-info',
        bgClass: 'bg-info/10',
        label: 'Question Answered',
      };
    default:
      return {
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        ),
        colorClass: 'text-text-muted',
        bgClass: 'bg-bg-tertiary',
        label: eventType,
      };
  }
}

/**
 * Build description from event data
 */
function buildDescription(event: TimelineEventType): string {
  if (event.description) {
    return event.description;
  }

  const { event_type, task_title, agent_name, data } = event;

  switch (event_type) {
    case 'run_started':
      return 'Execution started';
    case 'run_completed':
      return 'Execution completed successfully';
    case 'run_failed':
      return data?.error ? `Execution failed: ${data.error}` : 'Execution failed';
    case 'task_started':
      return task_title ? `Started: ${task_title}` : 'Task started';
    case 'task_completed':
      return task_title ? `Completed: ${task_title}` : 'Task completed';
    case 'task_failed':
      return task_title ? `Failed: ${task_title}` : 'Task failed';
    case 'agent_spawned':
      return agent_name ? `Agent spawned: ${agent_name}` : 'Agent spawned';
    case 'agent_exited':
      return agent_name ? `Agent exited: ${agent_name}` : 'Agent exited';
    case 'gate_reached':
      return data?.gate_title ? `Gate reached: ${data.gate_title}` : 'Gate reached, awaiting approval';
    case 'gate_approved':
      return data?.gate_title ? `Gate approved: ${data.gate_title}` : 'Gate approved';
    case 'gate_rejected':
      return data?.gate_title ? `Gate rejected: ${data.gate_title}` : 'Gate rejected';
    case 'question_asked':
      return data?.question_text ? `Question: ${data.question_text}` : 'Question asked';
    case 'question_answered':
      return data?.answer ? `Answer provided` : 'Question answered';
    default:
      return event_type;
  }
}

/**
 * Artifact link icon based on type
 */
function ArtifactLinkIcon({ type }: { type: ArtifactLink['type'] }) {
  const iconClass = 'h-3 w-3';

  if (type === 'github_pr' || type === 'github_commit') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    );
  }

  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function TimelineEvent({
  event,
  runStartTime,
  className,
  onHeightChange,
}: TimelineEventProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getEventConfig(event.event_type);
  const description = buildDescription(event);
  const hasExpandableContent =
    (event.data && Object.keys(event.data).length > 0) ||
    (event.artifacts && event.artifacts.length > 0);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onHeightChange?.(newExpanded);
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 transition-colors',
        hasExpandableContent && 'cursor-pointer hover:bg-bg-hover',
        isExpanded ? 'py-3' : 'py-2',
        className
      )}
      style={{ minHeight: isExpanded ? '120px' : '56px' }}
      onClick={hasExpandableContent ? handleToggle : undefined}
    >
      {/* Timestamp */}
      <span className="text-xs font-mono text-text-muted w-16 flex-shrink-0 pt-0.5">
        {formatRelativeTime(event.timestamp, runStartTime)}
      </span>

      {/* Event icon */}
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0',
          config.bgClass,
          config.colorClass
        )}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Event type label */}
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium uppercase tracking-wide', config.colorClass)}>
            {config.label}
          </span>
          {event.task_title && (
            <span className="text-xs text-text-muted truncate">
              {event.task_title}
            </span>
          )}
          {event.agent_name && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-purple/20 text-accent-purple">
              {event.agent_name}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
          {description}
        </p>

        {/* Expanded content */}
        {isExpanded && hasExpandableContent && (
          <div className="mt-2 space-y-2">
            {/* Artifacts */}
            {event.artifacts && event.artifacts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.artifacts.map((artifact, index) => (
                  <a
                    key={index}
                    href={artifact.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors group"
                  >
                    <ArtifactLinkIcon type={artifact.type} />
                    <span>{artifact.label}</span>
                    <svg
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ))}
              </div>
            )}

            {/* Event data (if complex) */}
            {event.data && Object.keys(event.data).length > 0 && (
              <div className="text-xs text-text-muted bg-bg-tertiary rounded p-2 font-mono overflow-x-auto">
                {JSON.stringify(event.data, null, 2).slice(0, 200)}
                {JSON.stringify(event.data).length > 200 && '...'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand indicator */}
      {hasExpandableContent && (
        <svg
          className={cn(
            'h-4 w-4 text-text-muted transition-transform flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </div>
  );
}
