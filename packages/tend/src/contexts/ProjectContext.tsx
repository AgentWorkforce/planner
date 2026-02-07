/**
 * ProjectContext - Provides the current project state throughout the tend app
 *
 * Wraps useProjectEvents and project API calls. The project entity links
 * ideation sessions, plans, and forge runs into a single workspace.
 *
 * Usage:
 *   // In App.tsx or ProjectPage, wrap with provider:
 *   <ProjectProvider projectId={id}>
 *     <ProjectWorkspace />
 *   </ProjectProvider>
 *
 *   // In any child component:
 *   const { project, isLoading, updateProject, updateFocus } = useProject();
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/**
 * Project entity structure matching backend schema
 * See: docs/flow/features/tend-project-entity.json
 */
export interface Project {
  id: string;
  name: string;
  owner_id: string | null;
  initiative_id: string | null;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  config: ProjectConfig | null;
  current_focus: CurrentFocus | null;
  created_at: string;
  updated_at: string;
}

/**
 * Project configuration defining scopes and execution policy
 */
export interface ProjectConfig {
  scopes?: {
    workspace_path?: string;
    remote_url?: string;
    default_branch?: string;
  };
  execution_policy?: {
    max_concurrent?: number;
    timeout?: number;
    retries?: number;
    budget?: number;
  };
}

/**
 * Current focus tracks what the user is currently viewing
 * (step_id, tree path, etc.)
 */
export interface CurrentFocus {
  type?: 'step' | 'scope' | 'tree_node' | 'conversation';
  id?: string;
  path?: string[];
  metadata?: Record<string, unknown>;
}

interface ProjectContextValue {
  /** The current project (null if not loaded) */
  project: Project | null;
  /** Whether the project is being loaded */
  isLoading: boolean;
  /** Error message if loading or updating failed */
  error: string | null;
  /** Load a project by ID */
  loadProject: (id: string) => Promise<void>;
  /** Update project fields (name, config, linked IDs) */
  updateProject: (updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  /** Update the current focus (what the user is looking at) */
  updateFocus: (focus: CurrentFocus) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  /** Project ID to load on mount (optional) */
  projectId?: string;
  children: ReactNode;
}

/**
 * ProjectProvider - Manages project state and provides it to children
 *
 * Fetches project data on mount if projectId is provided.
 * Provides methods to update project fields and current focus.
 */
export function ProjectProvider({ projectId, children }: ProjectProviderProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load project: ${res.statusText}`);
      }
      const data = await res.json();
      setProject(data.project);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading project:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProject = useCallback(
    async (updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>) => {
      if (!project) {
        console.warn('Cannot update project: no project loaded');
        return;
      }
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          throw new Error(`Failed to update project: ${res.statusText}`);
        }
        const data = await res.json();
        setProject(data.project);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setError(errorMessage);
        console.error('Error updating project:', e);
      }
    },
    [project],
  );

  const updateFocus = useCallback(
    async (focus: CurrentFocus) => {
      if (!project) {
        console.warn('Cannot update focus: no project loaded');
        return;
      }
      try {
        const res = await fetch(`/api/projects/${project.id}/focus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_focus: focus }),
        });
        if (!res.ok) {
          throw new Error(`Failed to update focus: ${res.statusText}`);
        }
        const data = await res.json();
        setProject(data.project);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setError(errorMessage);
        console.error('Error updating focus:', e);
      }
    },
    [project],
  );

  // Load project on mount if projectId provided
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  const value: ProjectContextValue = {
    project,
    isLoading,
    error,
    loadProject,
    updateProject,
    updateFocus,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * useProject - Access the project context
 *
 * @throws Error if used outside ProjectProvider
 *
 * @example
 * const { project, isLoading, updateProject } = useProject();
 * if (isLoading) return <LoadingSpinner />;
 * if (!project) return <div>No project loaded</div>;
 * return <div>{project.name}</div>;
 */
export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
