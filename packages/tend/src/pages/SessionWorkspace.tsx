import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SessionProvider, useSession } from '@/contexts/SessionContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { ForgeConfigPanel } from '@plannr/shared-ui';
import type { ForgeConfig } from '@plannr/shared-ui';
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
import { useGlobalEvents } from '@/hooks/useGlobalEvents';

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
    startBuild,
    buildStatus,
    buildSteps,
    isBuildMonitoring,
    cancelBuild,
    buildRunMetrics,
    buildStallWarnings,
    activeRunId,
    buildEventLog,
    buildGates,
    buildQuestions,
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

  // ── Cross-panel step focus (Forge <-> Tree linking) ───────────────────────

  const [focusedStepName, setFocusedStepName] = useState<string | null>(null);

  // Auto-clear the highlight after 3s so it's a momentary pulse, not permanent
  useEffect(() => {
    if (!focusedStepName) return;
    const timer = setTimeout(() => setFocusedStepName(null), 3000);
    return () => clearTimeout(timer);
  }, [focusedStepName]);

  const handleStepFocus = useCallback((stepName: string) => {
    setFocusedStepName(stepName);
  }, []);

  // ── Build dialog ──────────────────────────────────────────────────────────

  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);

  const handleStartBuild = useCallback(async (config: ForgeConfig) => {
    if (!activePlan) return;
    setBuildLoading(true);
    try {
      await startBuild(activePlan.plan_id, activePlan.version ?? 1, config);
      setBuildDialogOpen(false);
    } finally {
      setBuildLoading(false);
    }
  }, [activePlan, startBuild]);

  const handleCancelBuild = useCallback(async () => {
    try {
      await cancelBuild();
    } catch (err) {
      console.error('[SessionWorkspace] Failed to cancel build:', err);
    }
  }, [cancelBuild]);

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

  // ── Cross-session global notifications ────────────────────────────────────

  useGlobalEvents(session?.id ?? null, statusLine);

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
    dismiss(itemId);
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

  // ── Merge build step statuses and quality data into plan steps for display ──

  const stepsWithBuildStatus = steps.map(step => {
    // Match by step_id first, fall back to matching by title (step_name from SSE)
    const buildStep = buildSteps.get(step.step_id) ?? buildSteps.get(step.title);
    if (!buildStep) return step;
    const statusMap: Record<string, 'pending' | 'running' | 'done' | 'blocked' | 'failed'> = {
      pending: 'pending',
      running: 'running',
      completed: 'done',
      failed: 'failed',
      skipped: 'blocked',
      retrying: 'running',
    };
    return {
      ...step,
      execution_status: statusMap[buildStep.status] ?? step.execution_status,
      // Quality monitoring fields from build monitor
      error: buildStep.error,
      score: buildStep.score,
      scoreReasoning: buildStep.scoreReasoning,
      matchedCriteria: buildStep.matchedCriteria,
      failedCriteria: buildStep.failedCriteria,
      failures: buildStep.failures,
      estimatedCostUsd: buildStep.estimatedCostUsd,
      durationMs: buildStep.durationMs,
      model: buildStep.model,
      stallWarning: buildStep.stallWarning,
    };
  });

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <>
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
              forgeRunId={activeRunId}
              buildEventLog={buildEventLog}
              buildRunStatus={buildStatus}
              buildRunMetrics={buildRunMetrics}
              buildSteps={buildSteps}
              buildGates={buildGates}
              buildQuestions={buildQuestions}
              focusedStepName={focusedStepName}
              onStepFocus={(stepName) => handleStepFocus(stepName)}
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
            forgeRunId={activeRunId}
            buildEventLog={buildEventLog}
            buildRunStatus={buildStatus}
            buildRunMetrics={buildRunMetrics}
            buildSteps={buildSteps}
            buildGates={buildGates}
            buildQuestions={buildQuestions}
            focusedStepName={focusedStepName}
            onStepFocus={(stepName) => handleStepFocus(stepName)}
          />
        )
      }
      rightPanel={
        <TreePanel
          steps={stepsWithBuildStatus}
          projectName={sessionTitle}
          planStatus={activePlan?.status}
          onStartBuild={activePlan?.status === 'published' && !isBuildMonitoring ? () => setBuildDialogOpen(true) : undefined}
          buildStatus={isBuildMonitoring ? buildStatus : undefined}
          onCancelBuild={isBuildMonitoring ? handleCancelBuild : undefined}
          runMetrics={isBuildMonitoring ? buildRunMetrics : undefined}
          stallWarnings={isBuildMonitoring ? buildStallWarnings : undefined}
          focusedStepName={focusedStepName}
          onStepFocus={(stepName) => handleStepFocus(stepName)}
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
    <Dialog open={buildDialogOpen} onOpenChange={setBuildDialogOpen}>
      <DialogContent className="max-w-2xl bg-bg-secondary">
        <DialogHeader>
          <DialogTitle>Configure Build</DialogTitle>
        </DialogHeader>
        {activePlan && (
          <ForgeConfigPanel
            steps={steps.map((s) => ({
              step_id: s.step_id,
              title: s.title,
              scope: s.scope,
              owner_role: s.owner_role,
            }))}
            onStart={handleStartBuild}
            onCancel={() => setBuildDialogOpen(false)}
            loading={buildLoading}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
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
