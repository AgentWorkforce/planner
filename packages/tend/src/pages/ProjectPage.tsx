import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ProjectProvider, useProject } from '@/contexts';
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
 * ProjectPageContent - Inner component that uses ProjectContext
 */
function ProjectPageContent() {
  const { project, phase, session, plan, run, loading, error, graduate, planRefreshKey, blockRefreshKey } = useProject();
  const [searchParams] = useSearchParams();

  // Blocks live in the left column (The Now) — always fetch when session exists
  const blocksResult = useBlocks(session?.id, blockRefreshKey);
  const blocks = session ? blocksResult.blocks : [];

  // Block focus state for detail panel
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  // Block click → open focus/detail panel
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
      console.error('[ProjectPage] Failed to curate block:', err);
    }
  };

  const handleContentChange = async (content: string, userEdited: boolean, editedField?: string) => {
    if (!focusedBlockId) return;
    try {
      const currentBlock = blocks.find((b) => b.id === focusedBlockId);
      const existingEditedFields = currentBlock?.userEditedFields || [];
      const userEditedFields = userEdited && editedField
        ? [...new Set([...existingEditedFields, editedField])]
        : existingEditedFields;
      await blocksResult.updateBlock(focusedBlockId, {
        content,
        userEdited,
        ...(userEdited && { userEditedFields }),
      });
    } catch (err) {
      console.error('[ProjectPage] Failed to update block content:', err);
    }
  };

  // Find the focused block for FocusMode rendering
  const focusedBlock = focusedBlockId ? blocks.find((b) => b.id === focusedBlockId) : null;

  // Check if any blocks are curated (to conditionally show curated section)
  const hasCuratedBlocks = blocks.some((b) => b.status === 'curated');

  // Fetch plan steps for the tree (right column)
  const { steps } = usePlanSteps(plan?.plan_id, planRefreshKey);

  // Extract focus state from URL params (set by ProjectTree)
  const focusParam = searchParams.get('focus'); // e.g., "api-service.add-auth"
  const focusedStepId = focusParam?.includes('.') ? focusParam.split('.').pop() : undefined;

  // Get step info for conversation context banner
  const getFocusedStepInfo = (stepId: string) => {
    const step = steps.find(s => s.step_id === stepId);
    if (!step) return undefined;
    return {
      id: stepId,
      emoji: '📌', // generic pin for steps
      keyword: step.title,
    };
  };

  const focusedStep = focusedStepId ? getFocusedStepInfo(focusedStepId) : undefined;

  // Wire agent orchestration for StatusBar
  const { agents: relayAgents, questions, sessionDuration, isConnected } = useAgentOrchestration(project?.id);

  // Agents come directly from relay orchestration (server-authoritative).
  // No placeholders — if an agent hasn't connected yet, the status bar is empty.
  const agents = relayAgents;

  // Wire question notifications for ReplyBar
  const { dismiss, queue, addToQueue } = useQuestionNotifications();

  // Status line for the status bar content slot
  const statusLine = useStatusLine();

  // Feed questions from orchestration to notification queue + status line
  const pushMessageRef = useRef(statusLine.pushMessage);
  pushMessageRef.current = statusLine.pushMessage;
  const pushAlertRef = useRef(statusLine.pushAlert);
  pushAlertRef.current = statusLine.pushAlert;

  useEffect(() => {
    questions.forEach((question) => {
      addToQueue(question);
      // Blocking questions become alerts; others become messages
      if (question.priority === 'blocking') {
        pushAlertRef.current(question.text);
      } else {
        pushMessageRef.current(question.text, 'info');
      }
    });
  }, [questions, addToQueue]);

  // Map relay connection state to StatusBar connection status
  const connectionStatus = isConnected ? 'connected' : 'disconnected';

  // Convert question queue to ReplyBar PendingItem format
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

  // Reply context state
  const [replyContext, setReplyContext] = useState<string | null>(null);

  // Handle replying to a pending item
  const handleReplyItem = (itemId: string) => {
    const item = pendingItems.find((p) => p.id === itemId);
    if (item) {
      setReplyContext(`Re: ${item.source} — "${item.content}"\n\n`);
    }
  };

  // Handle dismissing a pending item
  const handleDismissItem = (itemId: string) => {
    // Find the notification in queue and dismiss it
    const notification = queue.find((n) => n.question.question_id === itemId);
    if (notification) {
      dismiss();
    }
  };

  // Map agent state to ConversationPane format
  const mapAgentState = (state: string): 'active' | 'completed' | 'blocked' => {
    if (state === 'working' || state === 'needs_input') return 'active';
    if (state === 'idle') return 'active'; // idle = available/ready, not done
    if (state === 'error') return 'blocked';
    return 'active'; // default to active
  };

  const mappedAgents = agents.map(agent => ({
    id: agent.id,
    name: agent.displayName || agent.role,
    role: agent.role,
    status: mapAgentState(agent.state),
    unreadCount: 0,
  }));

  // Trigger phase wipe on phase transitions
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase !== 'new') {
        statusLine.triggerWipe('phase');
      }
    }
  }, [phase, statusLine.triggerWipe]);

  // Auto-graduate new projects to ideation
  useEffect(() => {
    if (phase === 'new' && project && !loading) {
      graduate('ideation').catch(err => {
        console.error('[ProjectPage] Failed to auto-start ideation:', err);
      });
    }
  }, [phase, project, loading, graduate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-text-secondary">Preparing your garden...</p>
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

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-text-secondary">Project not found</p>
      </div>
    );
  }

  // New project - auto-graduating to ideation
  if (phase === 'new') {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <div className="text-center space-y-4">
          <h1 className="text-text-primary text-2xl font-semibold">{project.name}</h1>
          <p className="text-text-secondary">Setting up your project...</p>
        </div>
      </div>
    );
  }

  // Ideation phase layout — Left: forming blocks, Center: conversation, Right: the tree
  if (phase === 'ideation' && session) {
    return (
      <TendLayout
        leftCollapsed={false}
        focusMode={!!focusedBlock}
        nav={
          <CanvasHeader
            sessionId={session.id}
            sessionTitle={project.name}
            sessions={[{ id: session.id, title: project.name }]}
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
                planId={plan?.plan_id}
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
              planId={plan?.plan_id}
              replyContext={replyContext}
            />
          )
        }
        rightPanel={
          <TreePanel
            steps={steps}
            projectName={project.name}
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

  // Planning phase layout — Left: forming blocks, Center: conversation, Right: the tree
  if (phase === 'planning' && plan) {
    return (
      <TendLayout
        leftCollapsed={false}
        focusMode={!!focusedBlock}
        nav={
          <CanvasHeader
            sessionId={session?.id || ''}
            sessionTitle={project.name}
            sessions={[]}
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
                sessionId={session?.id || ''}
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
                planId={plan?.plan_id}
                replyContext={replyContext}
              />
            </FocusMode>
          ) : (
            <ConversationPane
              sessionId={session?.id || ''}
              agents={mappedAgents}
              pendingItems={pendingItems}
              onReplyItem={handleReplyItem}
              onDismissItem={handleDismissItem}
              focusedBlockId={focusedStepId}
              focusedBlock={focusedStep}
              planId={plan?.plan_id}
              replyContext={replyContext}
            />
          )
        }
        rightPanel={
          <TreePanel
            steps={steps}
            projectName={project.name}
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

  // Forging phase layout — Left: forming blocks, Center: conversation, Right: the tree
  if (phase === 'forging' && run) {
    return (
      <TendLayout
        leftCollapsed={false}
        focusMode={!!focusedBlock}
        nav={
          <CanvasHeader
            sessionId={session?.id || ''}
            sessionTitle={project.name}
            sessions={[]}
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
                sessionId={session?.id || ''}
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
                planId={plan?.plan_id}
                replyContext={replyContext}
              />
            </FocusMode>
          ) : (
            <ConversationPane
              sessionId={session?.id || ''}
              agents={mappedAgents}
              pendingItems={pendingItems}
              onReplyItem={handleReplyItem}
              onDismissItem={handleDismissItem}
              focusedBlockId={focusedStepId}
              focusedBlock={focusedStep}
              planId={plan?.plan_id}
              replyContext={replyContext}
            />
          )
        }
        rightPanel={
          <TreePanel
            steps={steps}
            projectName={project.name}
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

  // Fallback
  return (
    <div className="flex items-center justify-center h-screen bg-bg-deep">
      <p className="text-text-secondary">Uncharted territory: {phase}</p>
    </div>
  );
}

/**
 * ProjectPage - Project detail view with context provider
 */
export function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <p className="text-error">No project ID provided</p>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={id}>
      <ProjectPageContent />
    </ProjectProvider>
  );
}
