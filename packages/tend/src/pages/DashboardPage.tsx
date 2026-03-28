import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useNavigate, Link } from 'react-router-dom';
import { TendLayout } from '@/components/layout/TendLayout';
import { StatusBar } from '@/components/status/StatusBar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NewConversationModal } from '@/components/sessions/NewSessionModal';
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary';
import { SuggestionCard } from '@/components/dashboard/SuggestionCard';
import { SuggestionsList } from '@/components/dashboard/SuggestionsList';
import { InitiativeTree } from '@/components/dashboard/InitiativeTree';
import { usePortfolioOverview } from '@/hooks/usePortfolioOverview';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useInitiativeHealth } from '@/hooks/useInitiativeHealth';
import { useInitiatives } from '@/hooks/useInitiatives';
import { ClusterDetailDrawer } from '@/components/cultivate/ClusterDetailDrawer';
import { ReportDialog } from '@/components/cultivate/ReportDialog';
import { OnboardingPrompt } from '@/components/cultivate/OnboardingPrompt';
import { OnboardingWizard } from '@/components/cultivate/OnboardingWizard';
import { useCultivateGreenhouses } from '@/hooks/useCultivateGreenhouses';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/hooks/useSuggestions';

interface SessionSummary {
  id: string;
  status: 'active' | 'abandoned';
  initiative_id?: string;
  source: { type: string; initial_intent: string };
  blocks: Array<{ id: string; status: string }>;
  planner_sends: Array<{ result?: { plan_id: string } }>;
  created_at: string;
  updated_at: string;
}

interface PlanSummary {
  plan_id: string;
  goal: string;
  status: string;
  initiative_id: string | null;
}

/**
 * DashboardPage
 *
 * Three-column layout:
 * - Left: Recent active sessions.
 * - Center: Portfolio intelligence — summary, top suggestion, secondary suggestions, contextual greeting.
 * - Right: Initiative tree with sessions and health indicators.
 *
 * @route /
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [drawerClusterId, setDrawerClusterId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Cultivate greenhouse detection
  const { greenhouses, loading: greenhousesLoading, refetch: refetchGreenhouses } = useCultivateGreenhouses();
  const hasGreenhouses = greenhouses.length > 0;

  // Portfolio hooks
  const { overview, loading: overviewLoading } = usePortfolioOverview();
  const { suggestions, loading: suggestionsLoading } = useSuggestions();
  const { healthMap } = useInitiativeHealth();
  const { initiatives } = useInitiatives();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [sessionsRes, plansRes] = await Promise.all([
        fetch('/api/ideation/sessions'),
        fetch('/api/plans'),
      ]);

      if (!sessionsRes.ok) {
        throw new Error(`HTTP ${sessionsRes.status}: ${sessionsRes.statusText}`);
      }

      // Sessions API returns array directly
      const sessionsData: SessionSummary[] = await sessionsRes.json();
      setSessions(sessionsData);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  };

  // Build plan_id → session_id lookup for navigation
  const sessionByPlanId = new Map<string, string>();
  sessions.forEach((s) => {
    s.planner_sends?.forEach((send) => {
      if (send.result?.plan_id) {
        sessionByPlanId.set(send.result.plan_id, s.id);
      }
    });
  });

  const handleSuggestionOpen = (suggestion: Suggestion) => {
    if (suggestion.type === 'opportunity' && suggestion.cluster_id) {
      setDrawerClusterId(suggestion.cluster_id);
      return;
    }
    if (suggestion.plan_id) {
      const sessionId = sessionByPlanId.get(suggestion.plan_id);
      if (sessionId) {
        navigate(`/s/${sessionId}`);
        return;
      }
    }
  };

  const handlePlanSelect = (planId: string) => {
    const sessionId = sessionByPlanId.get(planId);
    if (sessionId) {
      navigate(`/s/${sessionId}`);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    navigate(`/s/${sessionId}`);
  };

  // Recent active sessions for the left panel
  const recentSessions = sessions
    .filter((s) => s.status === 'active')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  // Build contextual greeting based on session state
  const getGreeting = (): { main: React.ReactNode; sub: React.ReactNode } => {
    if (sessions.length === 0) {
      return {
        main: 'What would you like to work on?',
        sub: null,
      };
    }

    const activeSessions = sessions
      .filter((s) => s.status === 'active')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const mostRecent = activeSessions[0];

    if (mostRecent) {
      const title = mostRecent.source.initial_intent.slice(0, 60) +
        (mostRecent.source.initial_intent.length > 60 ? '…' : '');
      return {
        main: (
          <>
            We were working on{' '}
            <Link
              to={`/s/${mostRecent.id}`}
              className="text-accent-primary hover:underline"
            >
              {title}
            </Link>
            .
          </>
        ),
        sub: activeSessions.length > 1
          ? `You also have ${activeSessions.length - 1} other active conversation${activeSessions.length > 2 ? 's' : ''}. Pick one from the tree, or start something new.`
          : 'Pick it from the tree to continue, or start something new.',
      };
    }

    return {
      main: 'Nothing active right now.',
      sub: 'Want to revisit a conversation from the tree, or start something new?',
    };
  };

  const greeting = getGreeting();

  // Primary suggestion (#1) and secondary suggestions (#2–5)
  const primarySuggestion = suggestions[0] || null;
  const secondarySuggestions = suggestions.slice(1, 5);

  // ─── Nav ───
  const nav = (
    <div className="flex items-center justify-between h-full px-4">
      <span className="text-text-primary text-sm font-medium tracking-wide">tend</span>
      <ThemeToggle />
    </div>
  );

  // ─── Left panel: recent active sessions ───
  const leftPanel = (
    <div className="flex flex-col h-full px-3 py-3 space-y-1">
      <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider px-2 pb-1">
        Recent
      </p>

      {loading && (
        <div className="space-y-2 animate-pulse px-2">
          <div className="h-4 bg-bg-tertiary rounded w-40" />
          <div className="h-4 bg-bg-tertiary rounded w-32" />
          <div className="h-4 bg-bg-tertiary rounded w-36" />
        </div>
      )}

      {fetchError && (
        <p className="text-xs text-red-400 px-2">{fetchError}</p>
      )}

      {!loading && recentSessions.length === 0 && (
        <p className="text-xs text-text-muted px-2">No active conversations</p>
      )}

      {recentSessions.map((session) => {
        const title = session.source.initial_intent.slice(0, 50) +
          (session.source.initial_intent.length > 50 ? '…' : '');
        const blockCount = session.blocks?.length ?? 0;
        const planCount = session.planner_sends?.filter((s) => s.result?.plan_id).length ?? 0;

        return (
          <button
            key={session.id}
            onClick={() => navigate(`/s/${session.id}`)}
            className={cn(
              'w-full text-left px-2 py-2 rounded-lg text-sm',
              'hover:bg-bg-secondary transition-colors'
            )}
          >
            <p className="text-text-primary leading-snug truncate">{title}</p>
            {(blockCount > 0 || planCount > 0) && (
              <p className="text-[10px] text-text-muted mt-0.5">
                {[
                  blockCount > 0 && `${blockCount} block${blockCount !== 1 ? 's' : ''}`,
                  planCount > 0 && `${planCount} plan${planCount !== 1 ? 's' : ''}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        onClick={() => setIsNewConversationOpen(true)}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-2 py-2 text-sm rounded',
          'border border-border-default border-dashed',
          'hover:bg-bg-secondary hover:border-solid transition-colors',
          'text-text-secondary hover:text-text-primary'
        )}
      >
        <span className="text-xs">+</span>
        <span>new</span>
      </button>
    </div>
  );

  // ─── Center: greeting first, then portfolio intelligence ───
  const center = (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-4 space-y-5">
      {/* Contextual greeting or onboarding */}
      <div className="max-w-lg">
        {!greenhousesLoading && !hasGreenhouses ? (
          <OnboardingPrompt onQuickStart={() => setWizardOpen(true)} />
        ) : (
          <div className="bg-bg-secondary rounded-2xl px-5 py-4 shadow-sm">
            <p className="text-text-primary text-sm leading-relaxed">
              {greeting.main}
            </p>
            {greeting.sub && (
              <p className="text-text-secondary text-sm leading-relaxed mt-1.5">
                {greeting.sub}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Portfolio summary */}
      <PortfolioSummary
        initiativeCount={overview?.initiative_count ?? 0}
        activePlanCount={overview?.active_plan_count ?? 0}
        healthSummary={overview?.health_summary ?? { healthy: 0, warning: 0, critical: 0 }}
        opportunityCount={overview?.opportunity_count ?? 0}
        loading={overviewLoading}
      />

      {/* Suggestions section */}
      {(primarySuggestion || suggestionsLoading) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
              Needs attention
            </p>
            {hasGreenhouses && (
              <Button variant="secondary" size="sm" onClick={() => setReportOpen(true)}>
                Generate Report
              </Button>
            )}
          </div>

          {/* Primary suggestion */}
          {primarySuggestion && (
            <SuggestionCard
              suggestion={primarySuggestion}
              onOpen={handleSuggestionOpen}
            />
          )}

          {/* Secondary suggestions */}
          {secondarySuggestions.length > 0 && (
            <SuggestionsList
              suggestions={secondarySuggestions}
              onSelect={handleSuggestionOpen}
            />
          )}

          {/* Loading skeleton */}
          {suggestionsLoading && !primarySuggestion && (
            <div className="bg-bg-secondary rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-bg-tertiary rounded w-40 mb-2" />
              <div className="h-3 bg-bg-tertiary rounded w-64" />
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Right panel: initiative tree ───
  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {initiatives.length > 0 || sessions.length > 0 || plans.length > 0 ? (
          <InitiativeTree
            initiatives={initiatives}
            sessions={sessions}
            plans={plans}
            healthMap={healthMap}
            onSelectSession={handleSessionSelect}
            onSelectPlan={handlePlanSelect}
            onNewSession={() => setIsNewConversationOpen(true)}
          />
        ) : loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-bg-tertiary rounded w-32" />
            <div className="h-3 bg-bg-tertiary rounded w-48 ml-4" />
            <div className="h-3 bg-bg-tertiary rounded w-40 ml-4" />
          </div>
        ) : (
          <div className="space-y-3 px-1 py-1">
            <p className="text-text-muted text-sm font-mono">No conversations yet</p>
            <button
              onClick={() => setIsNewConversationOpen(true)}
              className="text-text-muted hover:text-text-secondary text-sm font-mono transition-colors"
            >
              [+ new]
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <TendLayout
        leftCollapsed={false}
        nav={nav}
        leftPanel={leftPanel}
        center={center}
        rightPanel={rightPanel}
        statusBar={<StatusBar content={{ type: 'agents' }} connectionStatus="connected" />}
      />
      <NewConversationModal
        open={isNewConversationOpen}
        onOpenChange={setIsNewConversationOpen}
      />
      <ClusterDetailDrawer
        open={drawerClusterId !== null}
        onOpenChange={(open) => { if (!open) setDrawerClusterId(null); }}
        clusterId={drawerClusterId}
      />
      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={refetchGreenhouses}
      />
      {hasGreenhouses && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          greenhouseId={greenhouses[0].id}
          greenhouseName={greenhouses[0].name}
        />
      )}
    </>
  );
}
