import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TendLayout } from '@/components/layout';
import { ProjectList } from '@/components/dashboard/ProjectList';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { StatusBar } from '@/components/status/StatusBar';
import { type Project } from '@/contexts/ProjectContext';

/**
 * DashboardPage
 *
 * The main dashboard view showing all projects.
 * Uses the same three-column TendLayout as the project workspace.
 *
 * Layout:
 * - Left: Project drafts (forming projects) - collapses when empty
 * - Center: AI conversation for meta-discussion (priorities, next actions)
 * - Right: Project list with WORK/ARTIFACTS sections
 *
 * @route /
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) {
          throw new Error(`Failed to fetch projects: ${res.statusText}`);
        }
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setError(errorMessage);
        console.error('Error fetching projects:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create project: ${res.statusText}`);
      }
      const data = await res.json();
      const newProject = data.project;
      setProjects((prev) => [newProject, ...prev]);
      navigate(`/projects/${newProject.id}`);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error('Error creating project:', e);
      setError(errorMessage);
    }
  };

  // Left panel: project drafts (future: forming projects before graduation)
  // For now, collapses when empty
  const leftPanel = (
    <div className="h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)]">
      {/* Empty for now - will show forming projects in future */}
    </div>
  );

  // Center: Welcome message / dashboard conversation (simplified for now)
  const center = (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[var(--canvas-bg)]">
      {projects.length === 0 && !isLoading ? (
        <>
          <h2 className="text-2xl font-semibold text-text-primary mb-3">
            Welcome to Tend
          </h2>
          <p className="text-text-secondary max-w-md">
            What would you like to work on? Create a new project to explore an idea, plan a feature, or jump into building.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            Dashboard Overview
          </h2>
          <p className="text-text-secondary max-w-md">
            Select a project from the right panel to continue working, or create a new one to get started.
          </p>
        </>
      )}
    </div>
  );

  // Right panel: project list
  const rightPanel = (
    <div className="h-full bg-[var(--sidebar-bg)] border-l border-[var(--border-subtle)] flex flex-col">
      <ProjectList
        projects={projects}
        isLoading={isLoading}
        error={error}
        onProjectClick={handleProjectClick}
        onCreateProject={handleCreateProject}
      />
    </div>
  );

  return (
    <TendLayout
      nav={<DashboardNav />}
      leftPanel={leftPanel}
      center={center}
      rightPanel={rightPanel}
      statusBar={<StatusBar />}
    />
  );
}
