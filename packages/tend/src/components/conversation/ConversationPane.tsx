import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { AgentTabBar } from './AgentTabBar';
import { LoadingSpinner } from '@/components/ui';
import { MessageSquare, X } from 'lucide-react';
import { ReplyBar, PendingItem } from '../status/ReplyBar';
import { ChannelView } from './ChannelView';
import { ForgeLogView } from './ForgeLogView';
import { usePlanChannel } from '@/hooks/usePlanChannel';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import type { BuildEvent, RunStatus, RunMetrics, StepState, GateState, QuestionState } from '@/hooks/useBuildMonitor';

interface ConversationPaneProps {
  sessionId: string;
  /** Optional block ID for contextual chat mode */
  focusedBlockId?: string;
  /** Optional block data for display in context banner */
  focusedBlock?: {
    id: string;
    emoji: string;
    keyword: string;
  };
  /** Active agents (for tab bar) */
  agents?: Array<{
    id: string;
    name: string;
    role: string;
    status: 'active' | 'completed' | 'blocked';
    unreadCount?: number;
  }>;
  /** Pending items requiring user attention */
  pendingItems?: PendingItem[];
  /** Handler for replying to a pending item */
  onReplyItem?: (itemId: string) => void;
  /** Handler for dismissing a pending item */
  onDismissItem?: (itemId: string) => void;
  /** Plan ID for plan channel integration */
  planId?: string;
  /** Reply context to pre-fill input */
  replyContext?: string | null;
  /** Forge run ID (truthy when build exists) */
  forgeRunId?: string | null;
  /** Build event log for Forge tab */
  buildEventLog?: BuildEvent[];
  /** Build run status */
  buildRunStatus?: RunStatus | null;
  /** Build run metrics */
  buildRunMetrics?: RunMetrics | null;
  /** Build step states */
  buildSteps?: Map<string, StepState>;
  /** Build gates */
  buildGates?: GateState[];
  /** Build questions */
  buildQuestions?: QuestionState[];
  /** Step name to highlight and scroll to in ForgeLogView */
  focusedStepName?: string | null;
  /** Called when a step is clicked in ForgeLogView — source is always 'forge' */
  onStepFocus?: (stepName: string, source: 'forge') => void;
}

export function ConversationPane({
  sessionId,
  focusedBlockId,
  focusedBlock,
  agents = [],
  pendingItems,
  onReplyItem,
  onDismissItem,
  planId,
  replyContext,
  forgeRunId,
  buildEventLog,
  buildRunStatus,
  buildRunMetrics,
  buildSteps,
  buildGates,
  buildQuestions,
  focusedStepName,
  onStepFocus,
}: ConversationPaneProps) {
  const { session, loading, error, refetch } = useSession(sessionId);
  const [, setSearchParams] = useSearchParams();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasDisconnectedRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  // Tab management
  const [activeChannelId, setActiveChannelId] = useState<string>('main');

  // Auto-switch to forge tab when a build starts
  const prevForgeRunIdRef = useRef(forgeRunId);
  useEffect(() => {
    if (forgeRunId && !prevForgeRunIdRef.current) {
      setActiveChannelId('forge');
    }
    prevForgeRunIdRef.current = forgeRunId;
  }, [forgeRunId]);

  // Auto-switch to forge tab when a step focus arrives from the tree
  const prevFocusedStepNameRef = useRef(focusedStepName);
  useEffect(() => {
    if (focusedStepName && focusedStepName !== prevFocusedStepNameRef.current && forgeRunId) {
      setActiveChannelId('forge');
    }
    prevFocusedStepNameRef.current = focusedStepName;
  }, [focusedStepName, forgeRunId]);

  // Forge unread tracking: count events arriving while not on forge tab
  const [forgeUnreadCount, setForgeUnreadCount] = useState(0);
  const forgeEventCountRef = useRef(buildEventLog?.length ?? 0);

  useEffect(() => {
    const currentLen = buildEventLog?.length ?? 0;
    if (activeChannelId === 'forge') {
      // User is viewing forge tab — mark as read
      setForgeUnreadCount(0);
      forgeEventCountRef.current = currentLen;
    } else if (currentLen > forgeEventCountRef.current) {
      // New events arrived while on a different tab
      setForgeUnreadCount(prev => prev + (currentLen - forgeEventCountRef.current));
      forgeEventCountRef.current = currentLen;
    }
  }, [activeChannelId, buildEventLog?.length]);

  // Channel hooks for unread tracking
  const sessionChannel = useSessionChannel(sessionId);
  const planChannel = usePlanChannel(planId);

  // Channel IDs
  const sessionChannelId = `#ideation-${sessionId.slice(0, 8)}`;
  const planChannelId = planId ? `#plan-${planId.slice(0, 8)}` : undefined;

  // Handler for clearing focus
  const handleClearFocus = useCallback(() => {
    setSearchParams(params => {
      params.delete('focus');
      params.set('zoom', 'overview');
      return params;
    });
  }, [setSearchParams]);

  // Sync channel active states for unread tracking
  const sessionChannelSetActiveRef = useRef(sessionChannel.setActive);
  sessionChannelSetActiveRef.current = sessionChannel.setActive;
  const planChannelSetActiveRef = useRef(planChannel.setActive);
  planChannelSetActiveRef.current = planChannel.setActive;

  useEffect(() => {
    sessionChannelSetActiveRef.current(activeChannelId === 'main');
    planChannelSetActiveRef.current(activeChannelId === 'planning');
  }, [activeChannelId]);

  // Track disconnection and show "Welcome back" banner on reconnection
  // Skip the initial load — only show on actual reconnections
  useEffect(() => {
    if (loading) {
      if (hasLoadedOnceRef.current) {
        wasDisconnectedRef.current = true;
      }
    } else if (session) {
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
      } else if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        setShowReconnected(true);
        const timer = setTimeout(() => setShowReconnected(false), 3000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [loading, session]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted mt-4">Opening conversation...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-error mb-4">Lost connection to session</p>
        <p className="text-text-muted text-sm">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // 404 state
  if (!session) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-text-primary text-lg mb-2">Session not found</p>
        <p className="text-text-muted text-sm">
          Could not load this session. It may not exist yet, or the server may be unavailable.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Determine placeholder based on session state
  const getPlaceholder = () => {
    if (session.status === 'abandoned') {
      return 'This session was released';
    }
    if (focusedBlockId && focusedBlock) {
      return `Ask about "${focusedBlock.keyword}"...`;
    }
    return 'Type your message...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Reconnection Banner */}
      {showReconnected && (
        <div className="px-4 py-2 bg-success/10 border-b border-success/20 text-center animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-xs text-success">Reconnected — you're back in the conversation</p>
        </div>
      )}

      {/* Context Banner for Focus Mode */}
      {focusedBlockId && focusedBlock && (
        <div className="flex items-center justify-between px-4 py-3 bg-accent-primary/10 border-b border-accent-primary/20">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-primary" />
            <span className="text-sm text-text-primary font-medium">
              Focused on step
            </span>
            <span className="text-xs text-text-muted">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base" aria-hidden="true">
                {focusedBlock.emoji}
              </span>
              <span className="text-sm text-text-muted">
                {focusedBlock.keyword}
              </span>
            </div>
          </div>
          <button
            onClick={handleClearFocus}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
            aria-label="Clear focus"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Channel Content — tab bar is sticky inside the scroll area */}
      <div className="flex-1 min-h-0">
        {activeChannelId === 'forge' && forgeRunId ? (
          <div className="flex flex-col h-full">
            {(agents.length > 0 || forgeRunId) && (
              <AgentTabBar
                activeChannelId={activeChannelId}
                onSelectChannel={setActiveChannelId}
                agents={agents}
                mainUnreadCount={sessionChannel.unreadCount}
                planChannelId={planChannelId}
                planUnreadCount={planChannel.unreadCount}
                forgeRunId={forgeRunId}
                forgeUnreadCount={forgeUnreadCount}
              />
            )}
            <div className="flex-1 min-h-0">
              <ForgeLogView
                eventLog={buildEventLog ?? []}
                runStatus={buildRunStatus ?? null}
                runMetrics={buildRunMetrics ?? null}
                steps={buildSteps ?? new Map()}
                gates={buildGates ?? []}
                questions={buildQuestions ?? []}
                focusedStepName={focusedStepName}
                onStepClick={(stepName) => onStepFocus?.(stepName, 'forge')}
              />
            </div>
          </div>
        ) : activeChannelId === 'planning' && planChannelId ? (
          <ChannelView
            channelId={planChannelId}
            placeholder="Message PlannerLead..."
            emptyMessage="Planning hasn't started yet"
            emptyDescription="Messages from PlannerLead and agents will appear here"
            replyContext={replyContext}
            stickyHeader={agents.length > 0 || forgeRunId ? (
              <AgentTabBar
                activeChannelId={activeChannelId}
                onSelectChannel={setActiveChannelId}
                agents={agents}
                mainUnreadCount={sessionChannel.unreadCount}
                planChannelId={planChannelId}
                planUnreadCount={planChannel.unreadCount}
                forgeRunId={forgeRunId}
                forgeUnreadCount={forgeUnreadCount}
              />
            ) : undefined}
          />
        ) : (
          <ChannelView
            channelId={sessionChannelId}
            channel={sessionChannel}
            sessionId={sessionId}
            placeholder={getPlaceholder()}
            emptyMessage="No messages yet"
            emptyDescription="The Interviewer agent will join this session shortly"
            replyContext={replyContext}
            stickyHeader={agents.length > 0 || forgeRunId ? (
              <AgentTabBar
                activeChannelId={activeChannelId}
                onSelectChannel={setActiveChannelId}
                agents={agents}
                mainUnreadCount={sessionChannel.unreadCount}
                planChannelId={planChannelId}
                planUnreadCount={planChannel.unreadCount}
                forgeRunId={forgeRunId}
                forgeUnreadCount={forgeUnreadCount}
              />
            ) : undefined}
          />
        )}
      </div>

      {/* Reply Bar - shows when there are pending items */}
      {pendingItems && pendingItems.length > 0 && (
        <div className="flex-shrink-0">
          <ReplyBar
            items={pendingItems}
            onReply={(itemId) => {
              onReplyItem?.(itemId);
            }}
            onDismiss={(itemId) => {
              onDismissItem?.(itemId);
            }}
            onNavigate={(itemId) => {
              console.log('[ConversationPane] Navigate to item:', itemId);
            }}
          />
        </div>
      )}
    </div>
  );
}
