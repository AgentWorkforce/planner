import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { TendLayout } from '@/components/layout/TendLayout';
import { StatusBar } from '@/components/status/StatusBar';
import { FormingBlocksColumn } from '@/components/canvas/FormingBlocksColumn';
import { ProjectTree } from '@/components/tree/ProjectTree';
import { StepSheet } from '@/components/sheets/StepSheet';
import { SessionNav, type SessionInfo } from '@/components/canvas/CanvasHeader';
import { FocusMode } from '@/components/canvas/FocusMode';
import { AIUnderstandingDrawer } from '@/components/canvas/AIUnderstandingDrawer';
import { HandoffDialog } from '@/components/canvas/HandoffDialog';
import { ModifiedSinceHandoffBanner } from '@/components/canvas/ModifiedSinceHandoffBanner';
import { ConversationPane } from '@/components/conversation/ConversationPane';
import { useBlocks } from '@/hooks/useBlocks';
import { useSession } from '@/hooks/useSession';
import { useSessions } from '@/hooks/useSessions';
import { useToast } from '@/hooks/useToast';
import { LoadingSpinner } from '@/components/ui';

/**
 * CanvasPage
 *
 * Main page for the ideation canvas view with three-column layout:
 * - Left: FormingBlocksColumn (physics-based blocks)
 * - Center: ConversationPane (existing chat component)
 * - Right: ProjectTree (zoomable project tree)
 *
 * Features:
 * - Integrates existing chat UI into center column
 * - Header with session title, navigation, and actions
 * - Real-time block updates via useBlocks hook
 * - Loading and error states
 *
 * Layout:
 * ```
 * ┌─────────────────────────────────────────────────────┐
 * │ CanvasHeader (Back | Title | AI Understanding | →) │
 * ├──────────────┬─────────────────┬───────────────────┤
 * │   Forming    │      Chat       │   Project Tree    │
 * │   Blocks     │   (existing     │   (zoomable)      │
 * │  (physics)   │   component)    │                   │
 * │              │                 │                   │
 * └──────────────┴─────────────────┴───────────────────┘
 * ```
 *
 * @example
 * ```tsx
 * // Routes:
 * // /ideation/session/:id - Canvas view
 * // /ideation/session/:id?block=:blockId - Canvas view with block focused
 * <Route path="/ideation/session/:id" element={<CanvasPage />} />
 * ```
 */
export function CanvasPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state for focus mode
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  // State for AI Understanding drawer
  const [isUnderstandingDrawerOpen, setIsUnderstandingDrawerOpen] = useState(false);
  // State for Handoff dialog
  const [isHandoffDialogOpen, setIsHandoffDialogOpen] = useState(false);
  // State for selected step (sheet)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const { session, loading: sessionLoading, error: sessionError } = useSession(id);
  const { blocks, loading: blocksLoading, curateBlock, uncurateBlock, updateBlock } = useBlocks(id || '');
  const { sessions: allSessions } = useSessions();
  const { toast } = useToast();

  // Map all sessions to SessionInfo format for dropdown - MUST be before early returns
  const sessionInfoList: SessionInfo[] = useMemo(() => {
    return allSessions.map((s) => ({
      id: s.id,
      title: s.source.initial_intent || 'Untitled Session',
    }));
  }, [allSessions]);

  // Cast session to access v3-prep fields (lastHandoffAt, synthesized)
  // These fields are optional and may not exist on older sessions
  const sessionWithV3Fields = session as typeof session & {
    lastHandoffAt?: string;
    lastHandoffPlanId?: string;
    lastHandoffVersionId?: number;
    synthesized?: {
      idea_summary?: string;
      specialist_perspectives?: Record<string, {
        take: string;
        concerns: string[];
        confidence: 'exploring' | 'forming' | 'confident';
      }>;
    };
  };

  // Sync focus mode state with URL on mount and when URL changes
  useEffect(() => {
    const blockId = searchParams.get('block');
    if (blockId !== focusedBlockId) {
      setFocusedBlockId(blockId);
    }
  }, [searchParams, focusedBlockId]);

  // Loading state - show before rendering canvas
  if (sessionLoading || blocksLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted mt-4">Loading canvas...</p>
      </div>
    );
  }

  // Error state
  if (sessionError) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <p className="text-error mb-4">Failed to load session</p>
        <p className="text-text-muted text-sm">{sessionError.message}</p>
      </div>
    );
  }

  // Invalid session ID
  if (!id || !session) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <p className="text-text-primary text-lg mb-2">Session not found</p>
        <p className="text-text-muted text-sm">
          The session you're looking for doesn't exist or has been deleted.
        </p>
      </div>
    );
  }

  // Handler for block clicks - opens focus mode
  const handleBlockClick = (blockId: string) => {
    console.log('[CanvasPage] Block clicked:', blockId);
    setFocusedBlockId(blockId);
    setSearchParams({ block: blockId });
  };

  // Handler for closing focus mode
  const handleCloseFocus = () => {
    setFocusedBlockId(null);
    setSearchParams({});
  };

  // Handler for curating the focused block
  const handleCurateFocusedBlock = async () => {
    if (!focusedBlockId) return;
    try {
      await curateBlock(focusedBlockId);
      toast({
        title: 'Block curated',
        description: 'The block has been added to your curated collection',
        variant: 'success',
      });
      // Close focus mode after successful curation
      handleCloseFocus();
    } catch (err) {
      console.error('[CanvasPage] Failed to curate block:', err);
      toast({
        title: 'Failed to curate block',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'error',
      });
    }
  };

  // Handler for content changes in focused block
  const handleContentChange = async (content: string, userEdited: boolean, editedField?: string) => {
    if (!focusedBlockId) return;
    try {
      // Get the current block to access existing userEditedFields
      const currentBlock = blocks.find((b) => b.id === focusedBlockId);
      const existingEditedFields = currentBlock?.userEditedFields || [];

      // Build new userEditedFields array if a field was edited
      const userEditedFields = userEdited && editedField
        ? [...new Set([...existingEditedFields, editedField])] // Add field if not already present
        : existingEditedFields;

      await updateBlock(focusedBlockId, {
        content,
        userEdited,
        ...(userEdited && { userEditedFields }),
      });
    } catch (err) {
      console.error('[CanvasPage] Failed to update block content:', err);
      toast({
        title: 'Failed to update block',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'error',
      });
    }
  };

  // Handler for session title changes
  const handleTitleChange = async (newTitle: string) => {
    console.log('[CanvasPage] Title change requested:', newTitle);

    try {
      const res = await fetch(`/api/ideation/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update session title: HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log('[CanvasPage] Successfully updated session title:', result);

      toast({
        title: 'Title updated',
        variant: 'success',
      });
    } catch (err) {
      console.error('[CanvasPage] Title update error:', err);
      toast({
        title: 'Failed to update title',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'error',
      });
    }
  };

  // Handler for session switching
  const handleSessionSwitch = (sessionId: string) => {
    navigate(`/ideation/session/${sessionId}`);
  };

  // Handler for opening understanding drawer
  const handleOpenUnderstanding = () => {
    setIsUnderstandingDrawerOpen(true);
  };

  // Handler for handoff to planner
  const handleHandoff = () => {
    setIsHandoffDialogOpen(true);
  };

  // Handler for handoff confirmation
  const handleHandoffConfirm = async (options: import('@/components/canvas/HandoffDialog').HandoffOptions) => {
    console.log('[CanvasPage] Handoff confirmed with options:', options);

    try {
      const res = await fetch(`/api/ideation/sessions/${id}/send-to-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        throw new Error(`Failed to send to planner: HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log('[CanvasPage] Successfully sent to planner:', result);

      toast({
        title: 'Session sent to planner',
        description: 'Your ideation session has been successfully handed off',
        variant: 'success',
      });
      setIsHandoffDialogOpen(false);
    } catch (err) {
      console.error('[CanvasPage] Handoff error:', err);
      toast({
        title: 'Failed to send to planner',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'error',
      });
      // Keep dialog open so user can retry
    }
  };

  // Find the focused block if in focus mode
  const focusedBlock = focusedBlockId ? blocks.find((b) => b.id === focusedBlockId) : null;

  // Session data for banner
  const sessionForBanner = session ? {
    updated_at: session.updated_at,
    lastHandoffAt: sessionWithV3Fields?.lastHandoffAt,
    lastHandoffPlanId: sessionWithV3Fields?.lastHandoffPlanId,
    lastHandoffVersionId: sessionWithV3Fields?.lastHandoffVersionId,
  } : null;

  // Build the center content — focus mode wraps chat in FocusMode
  const centerContent = focusedBlock ? (
    <FocusMode
      block={focusedBlock}
      onClose={handleCloseFocus}
      onCurate={handleCurateFocusedBlock}
      onContentChange={handleContentChange}
    >
      <ConversationPane
        sessionId={id}
        focusedBlockId={focusedBlock.id}
        focusedBlock={{
          id: focusedBlock.id,
          emoji: focusedBlock.emoji,
          keyword: focusedBlock.keyword,
        }}
      />
    </FocusMode>
  ) : (
    <ConversationPane sessionId={id} />
  );

  // Nav component with optional banner
  const navContent = (
    <>
      <SessionNav
        sessionId={id}
        sessionTitle={session.source?.initial_intent || 'Untitled Session'}
        sessions={sessionInfoList}
        onTitleChange={handleTitleChange}
        onSessionSwitch={handleSessionSwitch}
        onOpenUnderstanding={handleOpenUnderstanding}
        onHandoff={handleHandoff}
      />
      {sessionForBanner && (
        <ModifiedSinceHandoffBanner
          session={sessionForBanner}
          onDismiss={() => {}}
        />
      )}
    </>
  );

  return (
    <div className="h-screen">
      <TendLayout
        nav={navContent}
        leftPanel={
          <FormingBlocksColumn
            blocks={blocks}
            onBlockClick={handleBlockClick}
          />
        }
        center={centerContent}
        rightPanel={
          <ProjectTree
            planId={sessionWithV3Fields?.lastHandoffPlanId}
            onStepSelect={setSelectedStepId}
          />
        }
        statusBar={<StatusBar />}
        focusMode={!!focusedBlock}
      />

      {/* Overlay components (drawers/dialogs) */}
      <AIUnderstandingDrawer
        isOpen={isUnderstandingDrawerOpen}
        onClose={() => setIsUnderstandingDrawerOpen(false)}
        sessionId={id}
        synthesized={sessionWithV3Fields?.synthesized}
      />
      <HandoffDialog
        isOpen={isHandoffDialogOpen}
        onClose={() => setIsHandoffDialogOpen(false)}
        onConfirm={handleHandoffConfirm}
        blocks={blocks}
      />

      {/* Step detail sheet */}
      {sessionWithV3Fields?.lastHandoffPlanId && (
        <StepSheet
          stepId={selectedStepId}
          planId={sessionWithV3Fields.lastHandoffPlanId}
          onClose={() => setSelectedStepId(null)}
        />
      )}
    </div>
  );
}
