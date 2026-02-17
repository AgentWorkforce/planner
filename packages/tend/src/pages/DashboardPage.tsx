import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TendLayout } from '@/components/layout/TendLayout';
import { StatusBar } from '@/components/status/StatusBar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ProjectsColumn } from '@/components/dashboard/ProjectsColumn';
import { NewProjectModal } from '@/components/sessions/NewSessionModal';
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary';
import { SuggestionCard } from '@/components/dashboard/SuggestionCard';
import { SuggestionsList } from '@/components/dashboard/SuggestionsList';
import { InitiativeTree } from '@/components/dashboard/InitiativeTree';
import { usePortfolioOverview } from '@/hooks/usePortfolioOverview';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useInitiativeHealth } from '@/hooks/useInitiativeHealth';
import { useInitiatives } from '@/hooks/useInitiatives';
import type { Suggestion } from '@/hooks/useSuggestions';

interface Project {
  id: string;
  name: string;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
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
 * - Left: Project DRAFTS as physics blocks (early-stage projects only).
 * - Center: Portfolio intelligence — summary, top suggestion, secondary suggestions, contextual greeting.
 * - Right: Initiative tree with health indicators.
 *
 * @route /
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

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
      const [projectsRes, plansRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/plans'),
      ]);

      if (!projectsRes.ok) {
        throw new Error(`HTTP ${projectsRes.status}: ${projectsRes.statusText}`);
      }

      const projectsData = await projectsRes.json();
      setProjects(projectsData.projects);

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

  // Split projects: drafts (early-stage, session only) vs established (have plan or run)
  const drafts = projects.filter(p => p.session_id && !p.plan_id && !p.run_id);

  // Map plan_id → project_id for navigation
  const projectByPlanId = new Map(
    projects.filter(p => p.plan_id).map(p => [p.plan_id, p.id]),
  );

  const handleSuggestionOpen = (suggestion: Suggestion) => {
    if (suggestion.project_id) {
      navigate(`/projects/${suggestion.project_id}`);
    } else if (suggestion.plan_id) {
      const projectId = projectByPlanId.get(suggestion.plan_id);
      if (projectId) {
        navigate(`/projects/${projectId}`);
      }
    }
  };

  const handlePlanSelect = (planId: string) => {
    const projectId = projectByPlanId.get(planId);
    if (projectId) {
      navigate(`/projects/${projectId}`);
    }
  };

  // Build contextual greeting based on project state
  const getGreeting = (): { main: React.ReactNode; sub: React.ReactNode } => {
    if (projects.length === 0) {
      return {
        main: 'What would you like to work on?',
        sub: null,
      };
    }

    const sorted = [...projects].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const active = sorted.filter(p => p.session_id || p.plan_id || p.run_id);
    const mostRecent = active[0];

    if (mostRecent) {
      return {
        main: (
          <>
            We were working on{' '}
            <Link
              to={`/projects/${mostRecent.id}`}
              className="text-accent-primary hover:underline"
            >
              {mostRecent.name}
            </Link>
            .
          </>
        ),
        sub: active.length > 1
          ? `You also have ${active.length - 1} other active project${active.length > 2 ? 's' : ''}. Pick one from the tree, or start something new.`
          : 'Pick it from the tree to continue, or start something new.',
      };
    }

    return {
      main: `Nothing active right now.`,
      sub: 'Want to revisit a project from the tree, or start something new?',
    };
  };

  const greeting = getGreeting();

  // Primary suggestion (#1) and secondary suggestions (#2-5)
  const primarySuggestion = suggestions[0] || null;
  const secondarySuggestions = suggestions.slice(1, 5);

  // ─── Nav ───
  const nav = (
    <div className="flex items-center justify-between h-full px-4">
      <span className="text-text-primary text-sm font-medium tracking-wide">tend</span>
      <ThemeToggle />
    </div>
  );

  // ─── Left panel: project DRAFTS as physics blocks ───
  const leftPanel = (
    <ProjectsColumn
      projects={drafts}
      loading={loading}
      error={fetchError}
      onProjectClick={(id) => navigate(`/projects/${id}`)}
    />
  );

  // ─── Center: portfolio intelligence + greeting ───
  const center = (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-4 space-y-4">
      {/* Portfolio summary */}
      <PortfolioSummary
        initiativeCount={overview?.initiative_count ?? 0}
        activePlanCount={overview?.active_plan_count ?? 0}
        healthSummary={overview?.health_summary ?? { healthy: 0, warning: 0, critical: 0 }}
        opportunityCount={overview?.opportunity_count ?? 0}
        loading={overviewLoading}
      />

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

      {/* Separator before greeting */}
      {(primarySuggestion || secondarySuggestions.length > 0) && (
        <div className="border-t border-border-subtle" />
      )}

      {/* Contextual greeting */}
      <div className="max-w-lg">
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
      </div>

      {/* Loading skeleton for suggestions */}
      {suggestionsLoading && !primarySuggestion && (
        <div className="bg-bg-secondary rounded-2xl p-4 animate-pulse">
          <div className="h-4 bg-bg-tertiary rounded w-40 mb-2" />
          <div className="h-3 bg-bg-tertiary rounded w-64" />
        </div>
      )}
    </div>
  );

  // ─── Right panel: initiative tree ───
  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {initiatives.length > 0 || plans.length > 0 ? (
          <InitiativeTree
            initiatives={initiatives}
            plans={plans}
            healthMap={healthMap}
            onSelectPlan={handlePlanSelect}
            onNewPlan={() => setIsNewProjectOpen(true)}
          />
        ) : loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-bg-tertiary rounded w-32" />
            <div className="h-3 bg-bg-tertiary rounded w-48 ml-4" />
            <div className="h-3 bg-bg-tertiary rounded w-40 ml-4" />
          </div>
        ) : (
          <div className="space-y-3 px-1 py-1">
            <p className="text-text-muted text-sm font-mono">No projects yet</p>
            <button
              onClick={() => setIsNewProjectOpen(true)}
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
      <NewProjectModal open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen} />
    </>
  );
}
