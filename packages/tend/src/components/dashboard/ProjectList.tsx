import { useState } from 'react';
import { type Project } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  onProjectClick: (projectId: string) => void;
  onCreateProject: (name: string, description?: string) => void;
}

/**
 * ProjectList - Text-based project list for dashboard right panel
 *
 * Shows projects with phase badges and attention indicators:
 * - Phase badges: ideation=moss, planning=clay, execution=brick
 * - Attention symbols: ⟳ needs attention, • running, ✓ done, ✗ failed
 * - Progress: e.g., "7/10 · 3 running"
 */
export function ProjectList({
  projects,
  isLoading,
  error,
  onProjectClick,
  onCreateProject,
}: ProjectListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  // Determine project phase based on linked IDs
  const getPhase = (project: Project): 'ideation' | 'planning' | 'execution' => {
    if (project.run_id) return 'execution';
    if (project.plan_id) return 'planning';
    return 'ideation';
  };

  // Phase badge colors (earth tones)
  const phaseColors = {
    ideation: 'bg-moss text-moss-foreground',
    planning: 'bg-clay text-clay-foreground',
    execution: 'bg-brick text-brick-foreground',
  };

  // Format last updated timestamp
  const formatUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-text-error text-sm mb-2">Failed to load projects</p>
        <p className="text-text-muted text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with New Project button */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Projects</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-bg-tertiary"
          >
            [+ new]
          </button>
        </div>

        {/* Quick create form */}
        {isCreating && (
          <div className="mt-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewProjectName('');
                }
              }}
              placeholder="Project name..."
              className="w-full px-2 py-1 text-xs bg-bg-secondary border border-border-default rounded focus:outline-none focus:ring-1 focus:ring-border-focus text-text-primary"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreate}
                disabled={!newProjectName.trim()}
                className="text-xs px-2 py-1 bg-moss text-moss-foreground rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewProjectName('');
                }}
                className="text-xs px-2 py-1 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-text-muted text-sm">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm mb-2">No projects yet</p>
            <p className="text-text-muted text-xs">Create one to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const phase = getPhase(project);
              const phaseColor = phaseColors[phase];

              return (
                <button
                  key={project.id}
                  onClick={() => onProjectClick(project.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg',
                    'hover:bg-bg-tertiary transition-colors',
                    'border border-transparent hover:border-border-subtle',
                  )}
                >
                  {/* Project name */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">
                      {project.name}
                    </span>
                    {/* Phase badge */}
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        phaseColor,
                      )}
                    >
                      {phase}
                    </span>
                  </div>

                  {/* Activity indicator and last updated */}
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="text-moss">•</span>
                    <span>active</span>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-muted">
                      {formatUpdated(project.updated_at)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
