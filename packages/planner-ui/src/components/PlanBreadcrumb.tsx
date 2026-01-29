import { Link } from 'react-router-dom';
import type { ParentPlanInfo } from '@/types';

interface PlanBreadcrumbProps {
  parents: ParentPlanInfo[];
  currentGoal: string;
}

export function PlanBreadcrumb({ parents, currentGoal }: PlanBreadcrumbProps) {
  if (parents.length === 0) {
    return (
      <Link to="/plans" className="back-link">
        &larr; Back to Plans
      </Link>
    );
  }

  return (
    <nav className="plan-breadcrumb" aria-label="Plan navigation">
      <Link to="/plans" className="breadcrumb-link">
        Plans
      </Link>
      {parents.map((parent, index) => (
        <span key={parent.plan_id}>
          <span className="breadcrumb-separator">&gt;</span>
          <Link
            to={`/plans/${parent.plan_id}`}
            className="breadcrumb-link"
            state={{
              parents: parents.slice(0, index),
            }}
          >
            {parent.goal || 'Untitled Plan'}
          </Link>
        </span>
      ))}
      <span className="breadcrumb-separator">&gt;</span>
      <span className="breadcrumb-current">{currentGoal || 'Untitled Plan'}</span>
    </nav>
  );
}
