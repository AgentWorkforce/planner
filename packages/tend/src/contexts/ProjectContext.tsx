/**
 * ProjectContext Provider
 *
 * Manages project state, fetches linked entities, and subscribes to real-time updates.
 * Central context for project-level state in the tend app.
 */

import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useProjectEvents } from '@/hooks/useProjectEvents';

/** Project entity from planner domain */
interface Project {
  id: string;
  name: string;
  owner_id: string | null;
  initiative_id: string | null;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  config: Record<string, unknown> | null;
  current_focus: string | null;
  created_at: string;
  updated_at: string;
}

/** Ideation session entity */
interface IdeationSession {
  id: string;
  status: 'active' | 'abandoned';
  initiative_id?: string;
  source: {
    type: 'human' | 'intake';
    initial_intent: string;
    channel_ref?: string;
  };
  active_specialists: Array<{
    name: string;
    role_hint?: string;
    joined_at: string;
  }>;
  aggregate_confidence: number;
  created_at: string;
  updated_at: string;
}

/** Plan entity */
interface Plan {
  plan_id: string;
  initiative_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Forge run entity */
interface ForgeRun {
  run_id: string;
  plan_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectContextValue {
  project: Project | null;
  phase: string;
  loading: boolean;
  error: string | null;

  // Linked entities
  session: IdeationSession | null;
  plan: Plan | null;
  run: ForgeRun | null;

  // Refresh triggers (increment to force re-fetch of dependent data)
  planRefreshKey: number;
  blockRefreshKey: number;
  transcriptRefreshKey: number;

  // Actions
  graduate: (target: 'ideation' | 'planning' | 'forging', blockIds?: string[]) => Promise<void>;
  updateProject: (patch: Partial<Project>) => Promise<void>;
  refetch: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  projectId: string;
  children: ReactNode;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

export function ProjectProvider({ projectId, children }: ProjectProviderProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<IdeationSession | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [run, setRun] = useState<ForgeRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [blockRefreshKey, setBlockRefreshKey] = useState(0);
  const [transcriptRefreshKey, setTranscriptRefreshKey] = useState(0);

  // Fetch project and linked entities
  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch project
      const projectResult = await fetchJson<{ project: Project }>(`/api/projects/${projectId}`);
      setProject(projectResult.project);

      // Fetch linked session if exists
      if (projectResult.project.session_id) {
        try {
          const sessionResult = await fetchJson<IdeationSession>(
            `/api/ideation/sessions/${projectResult.project.session_id}`
          );
          setSession(sessionResult);
        } catch (err) {
          console.warn('[ProjectContext] Failed to fetch session:', err);
          setSession(null);
        }
      } else {
        setSession(null);
      }

      // Fetch linked plan if exists
      if (projectResult.project.plan_id) {
        try {
          const planResult = await fetchJson<{ plan: Plan }>(
            `/api/plans/${projectResult.project.plan_id}`
          );
          setPlan(planResult.plan);
        } catch (err) {
          console.warn('[ProjectContext] Failed to fetch plan:', err);
          setPlan(null);
        }
      } else {
        setPlan(null);
      }

      // Fetch linked run if exists
      if (projectResult.project.run_id) {
        try {
          const runResult = await fetchJson<ForgeRun>(
            `/api/forge/runs/${projectResult.project.run_id}`
          );
          setRun(runResult);
        } catch (err) {
          console.warn('[ProjectContext] Failed to fetch run:', err);
          setRun(null);
        }
      } else {
        setRun(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      setError(message);
      console.error('[ProjectContext] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Subscribe to real-time events
  useProjectEvents(project, {
    // Ideation events
    onTranscript: () => {
      console.log('[ProjectContext] Transcript updated');
      setTranscriptRefreshKey(k => k + 1);
      if (project?.session_id) {
        fetchJson<IdeationSession>(`/api/ideation/sessions/${project.session_id}`)
          .then(result => setSession(result))
          .catch(err => console.warn('[ProjectContext] Failed to refetch session:', err));
      }
    },
    onUnderstanding: () => {
      console.log('[ProjectContext] Understanding updated');
      if (project?.session_id) {
        fetchJson<IdeationSession>(`/api/ideation/sessions/${project.session_id}`)
          .then(result => setSession(result))
          .catch(err => console.warn('[ProjectContext] Failed to refetch session:', err));
      }
    },
    onBlockUpdate: () => {
      console.log('[ProjectContext] Block updated');
      setBlockRefreshKey(k => k + 1);
    },
    onBlocksGraduated: () => {
      console.log('[ProjectContext] Blocks graduated — refetching project');
      fetchProject();
      setPlanRefreshKey(k => k + 1);
      setBlockRefreshKey(k => k + 1);
    },
    onStatus: (status) => {
      console.log('[ProjectContext] Session status changed:', status);
      if (session) {
        setSession({ ...session, status });
      }
    },

    // Planner events
    onPlanChange: () => {
      console.log('[ProjectContext] Plan changed');
      setPlanRefreshKey(k => k + 1);
      // Refetch plan
      if (project?.plan_id) {
        fetchJson<{ plan: Plan }>(`/api/plans/${project.plan_id}`)
          .then(result => setPlan(result.plan))
          .catch(err => console.warn('[ProjectContext] Failed to refetch plan:', err));
      }
    },

    // Forge events
    onRunProgress: () => {
      console.log('[ProjectContext] Run progress updated');
      if (project?.run_id) {
        fetchJson<ForgeRun>(`/api/forge/runs/${project.run_id}`)
          .then(result => setRun(result))
          .catch(err => console.warn('[ProjectContext] Failed to refetch run:', err));
      }
    },
    onTaskUpdate: () => {
      console.log('[ProjectContext] Task updated');
      if (project?.run_id) {
        fetchJson<ForgeRun>(`/api/forge/runs/${project.run_id}`)
          .then(result => setRun(result))
          .catch(err => console.warn('[ProjectContext] Failed to refetch run:', err));
      }
    },
  });

  // Graduate project to next phase
  const graduate = useCallback(async (target: 'ideation' | 'planning' | 'forging', blockIds?: string[]) => {
    if (!project) {
      throw new Error('No project loaded');
    }

    try {
      const body: Record<string, unknown> = { target };
      if (blockIds && blockIds.length > 0) {
        body.options = { block_ids: blockIds };
      }

      const result = await fetchJson<{ project: Project }>(
        `/api/projects/${project.id}/graduate`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );

      setProject(result.project);

      // If graduating to forging and a run was created, fetch it immediately
      if (target === 'forging' && result.project.run_id) {
        try {
          const runResult = await fetchJson<ForgeRun>(`/api/forge/runs/${result.project.run_id}`);
          setRun(runResult);
          console.log('[ProjectContext] Fetched new forge run:', runResult.run_id);
        } catch (err) {
          console.warn('[ProjectContext] Failed to fetch new run:', err);
        }
      }

      // Refetch all linked entities to ensure consistency
      await fetchProject();
    } catch (err) {
      // Don't set context-level error — graduation failures are non-fatal.
      throw err;
    }
  }, [project, fetchProject]);

  // Update project fields
  const updateProject = useCallback(async (patch: Partial<Project>) => {
    if (!project) {
      throw new Error('No project loaded');
    }

    try {
      const result = await fetchJson<{ project: Project }>(
        `/api/projects/${project.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(patch),
        }
      );

      setProject(result.project);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project';
      setError(message);
      throw err;
    }
  }, [project]);

  // Derive phase from project state
  const phase = project
    ? project.run_id
      ? 'forging'
      : project.plan_id
      ? 'planning'
      : project.session_id
      ? 'ideation'
      : 'new'
    : 'unknown';

  const value: ProjectContextValue = {
    project,
    phase,
    loading,
    error,
    session,
    plan,
    run,
    planRefreshKey,
    blockRefreshKey,
    transcriptRefreshKey,
    graduate,
    updateProject,
    refetch: fetchProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
}
