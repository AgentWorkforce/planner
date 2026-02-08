import { useRef, useEffect } from 'react';
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';
import { ProjectPhysicsBlock } from './ProjectPhysicsBlock';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export interface ProjectsColumnProps {
  projects: Array<{
    id: string;
    name: string;
    session_id: string | null;
    plan_id: string | null;
    run_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  loading?: boolean;
  error?: string | null;
  onProjectClick: (projectId: string) => void;
}

function getProjectSize(project: ProjectsColumnProps['projects'][0]): number {
  const baseSize = 80;
  const maxSize = 110;

  const now = Date.now();
  const updatedTime = new Date(project.updated_at).getTime();
  const daysSinceUpdate = (now - updatedTime) / (1000 * 60 * 60 * 24);

  // More recently updated = larger
  // Recency decays over 30 days
  const recencyFactor = Math.max(0, Math.min(1, 1 - daysSinceUpdate / 30));

  return baseSize + (maxSize - baseSize) * recencyFactor;
}

export function ProjectsColumn({
  projects,
  loading = false,
  error = null,
  onProjectClick,
}: ProjectsColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addBody, removeBody, bodies, isReady } = usePhysicsEngine(containerRef);

  // Sync physics bodies with projects
  useEffect(() => {
    if (!isReady) return;

    const currentIds = new Set(projects.map(p => p.id));
    const physicsIds = new Set(bodies.keys());

    // Add new projects
    projects.forEach(project => {
      if (!physicsIds.has(project.id)) {
        addBody({ id: project.id, radius: getProjectSize(project) / 2 });
      }
    });

    // Remove deleted projects
    physicsIds.forEach(id => {
      if (!currentIds.has(id)) {
        removeBody(id);
      }
    });
  }, [projects, addBody, removeBody, bodies, isReady]);

  return (
    <div className="h-full flex flex-col bg-[var(--canvas-bg)]">
      {/* Physics container */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm text-error">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm text-[var(--canvas-text-muted)]">
                No projects yet. Type below to start your first one.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <>
            {projects.map((project) => {
              const body = bodies.get(project.id);
              if (!body) return null;

              return (
                <ProjectPhysicsBlock
                  key={project.id}
                  project={project}
                  position={{ x: body.x, y: body.y }}
                  angle={body.angle}
                  size={getProjectSize(project)}
                  onClick={() => onProjectClick(project.id)}
                />
              );
            })}
          </>
        )}
      </div>

    </div>
  );
}
