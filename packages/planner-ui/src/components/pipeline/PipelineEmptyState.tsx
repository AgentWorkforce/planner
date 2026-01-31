import { PipelineIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';

interface PipelineEmptyStateProps {
  initiativeId?: string;
  onCreatePlan?: () => void;
}

/**
 * Empty state component for pipeline view.
 * Shows when no plans exist in the pipeline (all plans, or filtered by initiative).
 *
 * @example
 * <PipelineEmptyState onCreatePlan={() => navigate('/plans/new')} />
 *
 * @example With initiative filter
 * <PipelineEmptyState
 *   initiativeId="init-123"
 *   onCreatePlan={() => navigate('/plans/new?initiative=init-123')}
 * />
 */
export function PipelineEmptyState({
  initiativeId,
  onCreatePlan,
}: PipelineEmptyStateProps) {
  const title = initiativeId ? 'No plans for this initiative' : 'No plans in pipeline';
  const description = initiativeId
    ? 'Create a plan to get started with this initiative'
    : 'Create your first plan to see it flow through the pipeline';

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
      {/* Icon - 48px for visibility in empty state */}
      <div className="mb-6 w-12 h-12 flex items-center justify-center">
        <PipelineIcon size="xl" className="text-text-muted opacity-50 w-12 h-12" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-text-primary mb-2">{title}</h3>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-6">{description}</p>

      {/* CTA button */}
      {onCreatePlan && (
        <Button variant="primary" onClick={onCreatePlan}>
          Create Plan
        </Button>
      )}
    </div>
  );
}
