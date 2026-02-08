import {
  PhysicsBlockBase,
  CONTENT_VISIBILITY_THRESHOLD,
} from '@/components/shared/PhysicsBlockBase';

export interface ProjectBlockData {
  id: string;
  name: string;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhysicsBlockProps {
  project: ProjectBlockData;
  position: { x: number; y: number };
  angle?: number;
  size: number;
  onClick?: () => void;
}

/**
 * Determines the current phase of a project based on its progression
 */
function getProjectPhase(project: ProjectBlockData): string {
  if (project.run_id) return 'forging';
  if (project.plan_id) return 'planning';
  if (project.session_id) return 'ideating';
  return 'new';
}

/**
 * Renders a single project as a physics-driven block
 */
export function ProjectPhysicsBlock({
  project,
  position,
  angle = 0,
  size,
  onClick,
}: ProjectPhysicsBlockProps) {
  const phase = getProjectPhase(project);
  const showContent = size >= CONTENT_VISIBILITY_THRESHOLD;

  // Calculate relative time (same pattern as SessionPhysicsBlock)
  const lastActivity = new Date(project.updated_at);
  const diffMs = Date.now() - lastActivity.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relativeTime = '';
  if (diffMins < 1) relativeTime = 'just now';
  else if (diffMins < 60) relativeTime = `${diffMins}m ago`;
  else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
  else relativeTime = `${diffDays}d ago`;

  return (
    <PhysicsBlockBase
      id={project.id}
      position={position}
      angle={angle}
      size={size}
      activityScore={50}
      onClick={onClick}
      style={{
        backgroundColor: 'var(--block-draft)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--block-draft-border)',
      }}
      className="flex flex-col items-center justify-center p-3 gap-1 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
    >
      {showContent && (
        <>
          <div className="text-sm font-medium text-center line-clamp-2 w-full px-1">
            {project.name}
          </div>
          <div
            className="text-xs text-center"
            style={{ color: 'var(--canvas-text-muted)' }}
          >
            {phase}
          </div>
          <div
            className="text-xs mt-auto"
            style={{ color: 'var(--canvas-text-muted)' }}
          >
            {relativeTime}
          </div>
        </>
      )}
    </PhysicsBlockBase>
  );
}
