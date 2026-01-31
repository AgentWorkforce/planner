import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import { AppSidebar } from './sidebar/AppSidebar';
import { CommandPalette } from './CommandPalette';
import { StatusBar } from './StatusBar';
import { TriagePanel } from './TriagePanel';
import { ChatBubble } from './ChatBubble';
import { QuestionNotificationContent } from './QuestionNotificationContent';
import { useCommandPalette, useRecentPlans, useAgentOrchestration, useQuestionQueue, useQuestionNotifications } from '@/hooks';
import { listPlans, getPlan } from '@/api';
import type { PlanSummary, PlanWithVersion, Question } from '@/types';
import type { Agent } from '@/hooks/useAgentOrchestration';

/**
 * Layout - Main application layout component
 *
 * Structure:
 * - SidebarProvider: Manages sidebar state (collapsed/expanded, mobile drawer)
 * - AppSidebar: Left sidebar with navigation and initiatives
 * - SidebarInset: Main content area with router outlet
 * - CommandPalette: Global command palette (Cmd+K)
 * - StatusBar: Fixed bottom bar showing agent activity and session stats
 *
 * Features:
 * - Full-height layout with responsive sidebar
 * - Command palette integration
 * - Recent plans tracking
 * - Agent orchestration status bar
 * - React Router outlet for page content
 */
export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, close } = useCommandPalette();
  const { recentPlanIds, addRecent } = useRecentPlans();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanWithVersion | null>(null);

  // Extract planId from URL
  const planIdMatch = location.pathname.match(/^\/plans\/([^/]+)/);
  const currentPlanId = planIdMatch?.[1] && planIdMatch[1] !== 'new' ? planIdMatch[1] : null;

  // Agent orchestration state
  const {
    agents,
    pendingQuestions,
    resolvedDecisions,
    sessionDuration,
  } = useAgentOrchestration(currentPlanId ?? undefined);

  // Question queue for triage panel
  const {
    questions,
    currentQuestion,
    answer,
    dismiss,
  } = useQuestionQueue(currentPlanId, { pollInterval: 30000 });

  // Question notification bubble state
  const handleNotificationClick = useCallback((notification: { question: Question; agentId: string }) => {
    setSelectedQuestionId(notification.question.question_id);
    setTriagePanelOpen(true);
  }, []);

  const {
    currentNotification,
    dismiss: dismissNotification,
    addToQueue: addNotification,
  } = useQuestionNotifications({
    autoAdvanceDelay: 5000,
    onNotificationClick: handleNotificationClick,
  });

  // Listen for new questions and add to notification queue
  // useQuestionQueue already listens to SSE events - we track new questions via questions array changes
  const previousQuestionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find newly added questions
    for (const question of questions) {
      if (!previousQuestionsRef.current.has(question.question_id)) {
        // New question arrived - add to notification queue
        addNotification(question);
      }
    }

    // Update the set for next comparison
    previousQuestionsRef.current = new Set(questions.map(q => q.question_id));
  }, [questions, addNotification]);

  // Triage panel state
  const [triagePanelOpen, setTriagePanelOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  // Find the currently selected question
  const selectedQuestion = useMemo(() => {
    if (!selectedQuestionId) return null;
    return questions.find(q => q.question_id === selectedQuestionId) ?? null;
  }, [selectedQuestionId, questions]);

  // Handlers for triage panel
  const handlePendingClick = useCallback(() => {
    if (questions.length > 0) {
      setTriagePanelOpen(true);
    }
  }, [questions.length]);

  const handleSelectQuestion = useCallback((question: { question_id: string }) => {
    setSelectedQuestionId(question.question_id);
  }, []);

  const handleAnswerTop = useCallback(async () => {
    if (currentQuestion) {
      // For now, just select the top question - actual answering UI will be in ChatBubble
      setSelectedQuestionId(currentQuestion.question_id);
    }
  }, [currentQuestion]);

  const handleDismissFyi = useCallback(async () => {
    // Dismiss all FYI questions
    const fyiQuestions = questions.filter(q => q.blocking_level === 'fyi');
    for (const q of fyiQuestions) {
      await dismiss(q.question_id);
    }
  }, [questions, dismiss]);

  // ChatBubble handlers
  const handleAnswer = useCallback(async (answerText: string) => {
    if (!selectedQuestionId) return;
    setIsAnswering(true);
    try {
      await answer(selectedQuestionId, answerText);
      // Move to next question or close
      const remainingQuestions = questions.filter(q => q.question_id !== selectedQuestionId);
      if (remainingQuestions.length > 0) {
        setSelectedQuestionId(remainingQuestions[0]!.question_id);
      } else {
        setSelectedQuestionId(null);
        setTriagePanelOpen(false);
      }
    } finally {
      setIsAnswering(false);
    }
  }, [selectedQuestionId, answer, questions]);

  const handleShowNext = useCallback(() => {
    // Find next question after current one
    const currentIndex = questions.findIndex(q => q.question_id === selectedQuestionId);
    if (currentIndex >= 0 && currentIndex < questions.length - 1) {
      setSelectedQuestionId(questions[currentIndex + 1]!.question_id);
    } else if (questions.length > 0) {
      setSelectedQuestionId(questions[0]!.question_id);
    }
  }, [selectedQuestionId, questions]);

  const handleLater = useCallback(() => {
    // Close ChatBubble but keep triage panel open
    setSelectedQuestionId(null);
  }, []);

  const handleCloseChatBubble = useCallback(() => {
    setSelectedQuestionId(null);
    setTriagePanelOpen(false);
  }, []);

  // Handle agent avatar click
  const handleAgentClick = useCallback((agent: Agent) => {
    // If agent needs input, find and show their pending question
    if (agent.state === 'needs_input') {
      const agentQuestion = questions.find(q => q.agent_id === agent.id);
      if (agentQuestion) {
        setSelectedQuestionId(agentQuestion.question_id);
        return;
      }
    }
    // Otherwise navigate to the plan channel for this agent
    // Channel IDs use format: #plan-{first 8 chars of UUID}
    if (currentPlanId) {
      const channelId = `#plan-${currentPlanId.slice(0, 8)}`;
      navigate(`/channels/${encodeURIComponent(channelId)}`);
    }
  }, [questions, currentPlanId, navigate]);

  // Fetch plans for command palette
  useEffect(() => {
    async function fetchPlans() {
      try {
        const result = await listPlans();
        setPlans(result.plans);
      } catch {
        // Silently fail - command palette will just have no results
      }
    }
    fetchPlans();
  }, []);

  // Fetch current plan when planId changes
  useEffect(() => {
    async function fetchCurrentPlan() {
      if (!currentPlanId) {
        setCurrentPlan(null);
        return;
      }
      try {
        const plan = await getPlan(currentPlanId);
        setCurrentPlan(plan);
      } catch {
        setCurrentPlan(null);
      }
    }
    fetchCurrentPlan();
  }, [currentPlanId]);

  // Track plan views - extract planId from URL and add to recent
  useEffect(() => {
    const match = location.pathname.match(/^\/plans\/([^/]+)$/);
    if (match && match[1] && match[1] !== 'new') {
      addRecent(match[1]);
    }
  }, [location.pathname, addRecent]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        {/* Mobile header with hamburger menu */}
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-display font-medium">Planner</span>
        </header>

        <main className="flex h-full w-full flex-1 flex-col overflow-y-auto overflow-x-hidden pb-12">
          <Outlet />
        </main>
      </SidebarInset>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isOpen}
        onClose={close}
        plans={plans}
        recentPlanIds={recentPlanIds}
      />

      {/* Triage Panel - shows question queue */}
      <TriagePanel
        questions={questions}
        isOpen={triagePanelOpen && !selectedQuestion}
        onClose={() => setTriagePanelOpen(false)}
        onSelectQuestion={handleSelectQuestion}
        onAnswerTop={handleAnswerTop}
        onDismissFyi={handleDismissFyi}
        selectedQuestionId={selectedQuestionId ?? undefined}
      />

      {/* ChatBubble - shows when a question is selected */}
      {selectedQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg mx-4">
            <ChatBubble
              question={selectedQuestion}
              hasNextQuestion={questions.length > 1}
              onAnswer={handleAnswer}
              onShowNext={handleShowNext}
              onLater={handleLater}
              onClose={handleCloseChatBubble}
              isProcessing={isAnswering}
              planId={currentPlanId ?? undefined}
            />
          </div>
        </div>
      )}

      {/* Status Bar - fixed bottom */}
      <StatusBar
        planName={currentPlan?.version?.summary?.goal?.slice(0, 50)}
        planVersion={currentPlan?.version?.version}
        planStatus={currentPlan?.version?.status}
        agents={agents}
        pendingQuestions={questions.length || pendingQuestions}
        resolvedDecisions={resolvedDecisions}
        sessionDuration={sessionDuration}
        onPendingClick={handlePendingClick}
        onAgentClick={handleAgentClick}
        currentNotification={currentNotification}
        onNotificationClick={() => {
          if (currentNotification) {
            handleNotificationClick(currentNotification);
            dismissNotification();
          }
        }}
        renderNotificationContent={(question) => (
          <QuestionNotificationContent
            question={question}
            onClick={() => {
              if (currentNotification) {
                handleNotificationClick(currentNotification);
                dismissNotification();
              }
            }}
          />
        )}
      />
    </SidebarProvider>
  );
}
