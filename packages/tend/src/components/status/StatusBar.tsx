import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Agent } from '@/hooks/useAgentOrchestration';
import type { StatusContent, WipeSignal } from '@/hooks/useStatusLine';
import { AgentIndicator } from './AgentIndicator';
import { WIPES } from './animation-frames';
import type { WipeLevel } from './animation-frames';

type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';

interface StatusBarProps {
  /** Content slot — driven by useStatusLine */
  content: StatusContent;
  /** Number of messages queued behind the current one */
  queueSize?: number;

  /** Agent data (rendered when content.type === 'agents') */
  agents?: Agent[];
  /** Callback when an agent indicator is clicked */
  onAgentClick?: (agent: Agent) => void;

  /** Session duration in seconds */
  sessionDuration?: number;
  /** Connection status */
  connectionStatus?: ConnectionStatus;
  /** Callback when an alert action is triggered */
  onAlertDismiss?: () => void;

  /** Imperative wipe signal for milestone events */
  wipeSignal?: WipeSignal | null;

  className?: string;
}

// Connection status — terminal-style bracketed indicators
const CONNECTION_DISPLAY: Record<ConnectionStatus, { label: string; color: string }> = {
  connected: { label: '[✓]', color: 'text-text-tertiary' },
  connecting: { label: '[··]', color: 'text-text-muted animate-pulse' },
  reconnecting: { label: '[··]', color: 'text-accent-primary animate-pulse' },
  disconnected: { label: '[--]', color: 'text-accent-primary' },
  error: { label: '[!!]', color: 'text-accent-secondary' },
};

// Wipe color per urgency level
const WIPE_COLORS: Record<WipeLevel, string> = {
  gentle: 'text-text-muted',
  normal: 'text-text-secondary',
  urgent: 'text-warning',
  celebrate: 'text-success',
  error: 'text-error',
  phase: 'text-accent-primary',
};

// Format seconds as mm:ss
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Build a text-based progress bar from block chars
function buildProgressBar(percent: number, width: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// Stable identity key for each content state
function getContentKey(content: StatusContent): string {
  if (content.type === 'message') return `msg-${content.id}`;
  if (content.type === 'alert') return `alert-${content.id}`;
  return content.type;
}

// Map content type to wipe urgency
function getWipeLevel(content: StatusContent): WipeLevel {
  if (content.type === 'alert') return 'urgent';
  if (content.type === 'progress') return 'normal';
  return 'gentle';
}

/**
 * StatusBar - Permanent bottom status bar for tend application
 *
 * Content-slot architecture: the left area shows whichever content
 * has the highest priority (alert > progress > message > agents).
 * The right area always shows session timer and connection status.
 *
 * Content transitions use character-based wipe animations from the
 * animation-frames system. Wipe intensity scales with urgency:
 * gentle (·/░) for info, normal (░/▒) for progress, urgent (▒/█) for alerts.
 */
export function StatusBar({
  content,
  queueSize = 0,
  agents = [],
  onAgentClick,
  sessionDuration = 0,
  connectionStatus = 'disconnected',
  onAlertDismiss,
  wipeSignal,
  className,
}: StatusBarProps) {
  const connectionInfo = CONNECTION_DISPLAY[connectionStatus];

  // --- Wipe transition ---
  // One-shot frame sequence that plays between content changes.
  // Each frame is a single character repeated to fill the bar width.
  const [wipe, setWipe] = useState<{ frameIndex: number; level: WipeLevel } | null>(null);
  const prevKeyRef = useRef(getContentKey(content));

  // Detect content change → start wipe
  useEffect(() => {
    const key = getContentKey(content);
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      setWipe({ frameIndex: 0, level: getWipeLevel(content) });
    }
  }, [content]);

  // Imperative wipe signal (milestone events — overrides content wipe)
  const prevWipeSeqRef = useRef(wipeSignal?.seq ?? 0);
  useEffect(() => {
    if (!wipeSignal || wipeSignal.seq === prevWipeSeqRef.current) return;
    prevWipeSeqRef.current = wipeSignal.seq;
    setWipe({ frameIndex: 0, level: wipeSignal.level });
  }, [wipeSignal]);

  // Step through wipe frames (one-shot, then null)
  useEffect(() => {
    if (!wipe) return;
    const anim = WIPES[wipe.level];
    if (wipe.frameIndex >= anim.frames.length) {
      setWipe(null);
      return;
    }
    const timer = setTimeout(() => {
      setWipe(prev => prev ? { ...prev, frameIndex: prev.frameIndex + 1 } : null);
    }, anim.interval);
    return () => clearTimeout(timer);
  }, [wipe]);

  const isWiping = wipe !== null && wipe.frameIndex < WIPES[wipe.level].frames.length;

  return (
    <div
      className={cn(
        'w-full h-9 border-t flex items-center px-4 gap-4',
        'bg-[var(--color-bg-chrome)] border-border-subtle relative',
        className,
      )}
    >
      {/* Reconnection indicator */}
      {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-primary/20 overflow-hidden">
          <div className="h-full bg-accent-primary animate-reconnect-slide" />
        </div>
      )}

      {/* Content slot */}
      <div className="flex-1 min-w-0 flex items-center overflow-hidden">
        {isWiping ? (
          <span className={cn('font-mono text-sm whitespace-nowrap', WIPE_COLORS[wipe!.level])}>
            {(WIPES[wipe!.level].frames[wipe!.frameIndex] ?? '·').repeat(60)}
          </span>
        ) : (
          <>
            {content.type === 'agents' && (
              <div className="flex items-center gap-3">
                {agents.length > 0 ? (
                  agents.map((agent) => (
                    <AgentIndicator
                      key={agent.id}
                      role={agent.role}
                      state={agent.state}
                      displayName={agent.displayName}
                      currentActivity={agent.currentActivity}
                      currentStep={agent.currentStep}
                      currentThought={agent.currentThought}
                      onClick={onAgentClick ? () => onAgentClick(agent) : undefined}
                    />
                  ))
                ) : (
                  <span className="text-text-muted text-sm font-mono">Garden is quiet</span>
                )}
              </div>
            )}

            {content.type === 'message' && (
              <div className="flex items-center gap-2 min-w-0 font-mono text-sm">
                <span className={cn(
                  content.level === 'success' && 'text-success',
                  content.level === 'warning' && 'text-warning',
                  content.level === 'info' && 'text-text-secondary',
                )}>
                  {content.level === 'success' && '✓'}
                  {content.level === 'warning' && '⚠'}
                  {content.level === 'info' && '›'}
                </span>
                <span className={cn(
                  'truncate',
                  content.level === 'success' && 'text-success',
                  content.level === 'warning' && 'text-warning',
                  content.level === 'info' && 'text-text-secondary',
                )}>
                  {content.text}
                </span>
                {queueSize > 0 && (
                  <span className="text-text-muted shrink-0">(+{queueSize})</span>
                )}
              </div>
            )}

            {content.type === 'progress' && (
              <div className="flex items-center gap-2 min-w-0 font-mono text-sm">
                <span className="text-text-secondary shrink-0">{content.label}</span>
                <span className="text-success">{buildProgressBar(content.percent, 20)}</span>
                <span className="text-text-muted shrink-0">{Math.round(content.percent)}%</span>
                {content.detail && (
                  <span className="text-text-muted shrink-0">{content.detail}</span>
                )}
              </div>
            )}

            {content.type === 'alert' && (
              <div className="flex items-center gap-2 min-w-0 font-mono text-sm">
                <span className="text-warning shrink-0">⚠</span>
                <span className="text-warning truncate">{content.text}</span>
                {content.action && (
                  <button
                    onClick={content.action.onClick}
                    className="shrink-0 text-accent-primary hover:text-accent-hover transition-colors"
                  >
                    [{content.action.label}]
                  </button>
                )}
                {onAlertDismiss && (
                  <button
                    onClick={onAlertDismiss}
                    className="shrink-0 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    [×]
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Persistent right slot */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Session timer */}
        <span className="text-xs text-text-muted font-mono">
          {formatDuration(sessionDuration)}
        </span>

        {/* Connection status */}
        <span className={cn('text-xs font-mono', connectionInfo.color)}>{connectionInfo.label}</span>
      </div>
    </div>
  );
}
