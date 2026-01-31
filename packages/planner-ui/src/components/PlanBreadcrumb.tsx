import { Link } from 'react-router-dom';
import type { ParentPlanInfo } from '@/types';
import { ChevronIcon } from './icons';

interface PlanBreadcrumbProps {
  parents: ParentPlanInfo[];
  currentGoal: string;
}

export function PlanBreadcrumb({ parents, currentGoal }: PlanBreadcrumbProps) {
  // When no parents, return nothing - the title is already shown in the header
  if (parents.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm" aria-label="Plan navigation">
      <Link to="/plans" className="text-text-secondary hover:text-accent-cyan transition-colors">
        Plans
      </Link>
      {parents.map((parent, index) => (
        <span key={parent.plan_id} className="flex items-center gap-1">
          <ChevronIcon direction="right" size="sm" className="text-text-muted" />
          <Link
            to={`/plans/${parent.plan_id}`}
            className="text-text-secondary hover:text-accent-cyan transition-colors max-w-[200px] truncate"
            state={{
              parents: parents.slice(0, index),
            }}
          >
            {parent.goal || 'Untitled Plan'}
          </Link>
        </span>
      ))}
      <span className="flex items-center gap-1">
        <ChevronIcon direction="right" size="sm" className="text-text-muted" />
        <span className="text-text-primary font-medium max-w-[200px] truncate">
          {currentGoal || 'Untitled Plan'}
        </span>
      </span>
    </nav>
  );
}
