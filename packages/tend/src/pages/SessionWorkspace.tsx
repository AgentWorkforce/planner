import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SessionProvider, useSession } from '@/contexts/SessionContext';
import { TendLayout } from '@/components/layout/TendLayout';
import { CanvasHeader } from '@/components/canvas/CanvasHeader';
import { FormingBlocksColumn } from '@/components/canvas/FormingBlocksColumn';
import { CuratedBlocksColumn } from '@/components/canvas/CuratedBlocksColumn';
import { ConversationPane } from '@/components/conversation/ConversationPane';
import { TreePanel } from '@/components/tree/TreePanel';
import { StatusBar } from '@/components/status/StatusBar';
import { FocusMode } from '@/components/canvas/FocusMode';
import { useBlocks } from '@/hooks/useBlocks';
import { usePlanSteps } from '@/hooks/usePlanSteps';
import { useAgentOrchestration } from '@/hooks/useAgentOrchestration';
import { useQuestionNotifications } from '@/hooks/useQuestionNotifications';
import { useStatusLine } from '@/hooks/useStatusLine';

import type { PendingItem } from '@/components/status/ReplyBar';

/**
 * SessionWorkspaceContent — inner component that consumes SessionContext.
 *
 * Layout is always the same: left = blocks, center = conversation, right = tree.
 * No phase branching. The session is the primary entity; plans are derived.
 */
function SessionWorkspaceContent() {
  const {
    session,
    activePlan,
    loading,
    error,
    planRefreshKey,
    blockRefreshKey,
  } = useSession();

  const [searchParams] = useSearchParams();

  // ── Blocks ────────────────────────────────────────────────────────────────

  const blocksResult = useBlocks(session?.id, blockRefreshKey);
  const blocks = session ? blocksResult.blocks : [];

  // ── Block focus state ─────────────────────────────────────────────────────

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const handleBlockClick = (blockId: string) => {
    setFocusedBlockId(blockId);
  };

  const handleCloseFocus = () => {
    setFocusedBlockId(null);
  };

  const handleCurateFocusedBlock = async () => {
    if (!focusedBlockId) return;
    try {
      await blocksResult.curateBlock(focusedBlockId);
      handleCloseFocus();
    } catch (err) {
      console.error('[SessionWorkspace] Failed to curate block:', err);
    }
  };

  const handleContentChange = async (content: string, userEdited: boolean, editedField?: string) => {
    if (!focusedBlockId) return;
    try {
      const currentBlock = blocks.find((b) => b.id === focusedBlockId);
      const existingEditedFields = currentBlock?.userEditedFields || [];
      const userEditedFields =
        userEdited && editedField
          ? [...new Set([...existingEditedFields, editedField])]
          : existingEditedFields;
      await blocksResult.updateBlock(focusedBlockId, {
        content,
        userEdited,
        ...(userEdited && { userEditedFields }),
      });
    } catch (err) {
      console.error('[SessionWorkspace] Failed to update block content:', err);
    }
  };

  const focusedBlock = focusedBlockId ? blocks.find((b) => b.id === focusedBlockId) : null;
  const hasCuratedBlocks = blocks.some((b) => b.status === 'curated');

  // ── Plan steps (for tree panel) ───────────────────────────────────────────

  const { steps } = usePlanSteps(activePlan?.plan_id, planRefreshKey);

  // ── Step focus from URL ───────────────────────────────────────────────────

  const focusParam = searchParams.get('focus');
  const focusedStepId = focusParam?.includes('.') ? focusParam.split('.').pop() : undefined;

  const getFocusedStepInfo = (stepId: string) => {
    const step = steps.find((s) => s.step_id === stepId);
    if (!step) return undefined;
    return {
      id: stepId,
      emoji: '📌',
      keyword: step.title,
    };
  };

  const focusedStep = focusedStepId ? getFocusedStepInfo(focusedStepId) : undefined;

  // ── Agent orchestration ───────────────────────────────────────────────────

  const { agents: relayAgents, questions, sessionDuration, isConnected } = useAgentOrchestration();
  const agents = relayAgents;

  // ── Question notifications ────────────────────────────────────────────────

  const { dismiss, queue, addToQueue } = useQuestionNotifications();
  const statusLine = useStatusLine();

  const pushMessageRef = useRef(statusLine.pushMessage);
  pushMessageRef.current = statusLine.pushMessage;
  const pushAlertRef = useRef(statusLine.pushAlert);
  pushAlertRef.current = statusLine.pushAlert;

  useEffect(() => {
    questions.forEach((question) => {
      addToQueue(question);
      if (question.priority === 'blocking') {
        pushAlertRef.current(question.text);
      } else {
        pushMessageRef.current(question.text, 'info');
      }
    });
  }, [questions, addToQueue]);

  // ── Connection status ─────────────────────────────────────────────────────

  const connectionStatus = isConnected ? 'connected' : 'disconnected';

  // ── Reply bar ─────────────────────────────────────────────────────────────

  const pendingItems: PendingItem[] = queue.map((notification) => {
    const agent = agents.find((a) => a.id === notification.agentId);
    return {
      id: notification.question.question_id,
      type: 'question' as const,
      content: notification.question.text,
      source: agent?.displayName || agent?.role || 'Agent',
      priority: notification.question.priority || 'normal',
      created_at: notification.question.created_at,
    };
  });

  const [replyContext, setReplyContext] = useState<string | null>(null);

  const handleReplyItem = (itemId: string) => {
    const item = pendingItems.find((p) => p.id === itemId);
    if (item) {
      setReplyContext(`Re: ${item.source} — "${item.content}"\n\n`);
    }
  };

  const handleDismissItem = (itemId: string) => {
    const notification = queue.find((n) => n.question.question_id === itemId);
    if (notification) {
      dismiss();
    }
  };

  // ── Mapped agents for ConversationPane ────────────────────────────────────

  const mapAgentState = (state: string): 'active' | 'completed' | 'blocked' => {
    if (state === 'working' || state === 'needs_input') return 'active';
    if (state === 'idle') return 'active';
    if (state === 'error') return 'blocked';
    return 'active';
  };

  const mappedAgents = agents.map((agent) => ({
    id: agent.id,
    name: agent.displayName || agent.role,
    role: agent.role,
    status: mapAgentState(agent.state),
    unreadCount: 0,
  }));

  // ── Session title from initial intent ─────────────────────────────────────

  const sessionTitle = session?.source.initial_intent
    ? session.source.initial_intent.slice(0, 60)
    : 'Session';

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-text-secondary">Loading session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-error">Error: {error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-text-secondary">Session not found</p>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <TendLayout
      leftCollapsed={false}
      focusMode={!!focusedBlock}
      nav={
        <CanvasHeader
          sessionId={session.id}
          sessionTitle={sessionTitle}
          sessions={[{ id: session.id, title: sessionTitle }]}
        />
      }
      leftPanel={
        <div className="flex flex-col h-full">
          <FormingBlocksColumn
            blocks={blocks}
            onBlockClick={handleBlockClick}
            className="flex-1 min-h-0"
          />
          {hasCuratedBlocks && (
            <CuratedBlocksColumn
              blocks={blocks}
              onBlockClick={handleBlockClick}
              onUncurate={blocksResult.uncurateBlock}
              className="shrink-0 max-h-[40%] border-t border-border/30"
            />
          )}
        </div>
      }
      center={
        focusedBlock ? (
          <FocusMode
            block={focusedBlock}
            onClose={handleCloseFocus}
            onCurate={handleCurateFocusedBlock}
            onContentChange={handleContentChange}
          >
            <ConversationPane
              sessionId={session.id}
              agents={mappedAgents}
              pendingItems={pendingItems}
              onReplyItem={handleReplyItem}
              onDismissItem={handleDismissItem}
              focusedBlockId={focusedBlock.id}
              focusedBlock={{
                id: focusedBlock.id,
                emoji: focusedBlock.emoji,
                keyword: focusedBlock.keyword,
              }}
              planId={activePlan?.plan_id}
              replyContext={replyContext}
            />
          </FocusMode>
        ) : (
          <ConversationPane
            sessionId={session.id}
            agents={mappedAgents}
            pendingItems={pendingItems}
            onReplyItem={handleReplyItem}
            onDismissItem={handleDismissItem}
            focusedBlockId={focusedStepId}
            focusedBlock={focusedStep}
            planId={activePlan?.plan_id}
            replyContext={replyContext}
          />
        )
      }
      rightPanel={
        <TreePanel
          steps={steps}
          projectName={sessionTitle}
        />
      }
      statusBar={
        <StatusBar
          content={statusLine.current}
          queueSize={statusLine.queueSize}
          agents={agents}
          sessionDuration={sessionDuration}
          connectionStatus={connectionStatus}
          onAlertDismiss={statusLine.dismissAlert}
          wipeSignal={statusLine.wipeSignal}
        />
      }
    />
  );
}

/**
 * SessionWorkspace — session-first workspace page.
 *
 * Route: /s/:id
 *
 * Wraps SessionWorkspaceContent in SessionProvider so the session ID flows
 * from the URL param into the context.
 */
export function SessionWorkspace() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-error">No session ID provided</p>
      </div>
    );
  }

  return (
    <SessionProvider sessionId={id}>
      <SessionWorkspaceContent />
    </SessionProvider>
  );
}
