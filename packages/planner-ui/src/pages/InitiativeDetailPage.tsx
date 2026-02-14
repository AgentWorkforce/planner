import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInitiative } from '@/hooks/useInitiative';
import { invalidateInitiatives } from '@/hooks/useInitiatives';
import { updateInitiative } from '@/api/initiatives';
import { InitiativeModal } from '@/components/initiatives/InitiativeModal';
import { AddPlanSheet } from '@/components/initiatives/AddPlanSheet';
import { PlanCard } from '@/components/PlanCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronLeftIcon, EditIcon, TrashIcon, PlusIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import type { InitiativeStatus, UpdateInitiativeInput } from '@/types/initiative';

/**
 * Get Badge variant based on initiative status
 */
function getStatusBadgeVariant(status: InitiativeStatus): 'success' | 'info' | 'default' {
  switch (status) {
    case 'active':
      return 'success';
    case 'completed':
      return 'info';
    case 'archived':
      return 'default';
  }
}

/**
 * InitiativeDetailPage Component
 *
 * Shows full details of a single initiative including:
 * - Header with icon, name, status badge
 * - Edit and archive actions
 * - Full description
 * - All associated plans
 *
 * Features:
 * - Loading skeleton
 * - 404 handling
 * - Edit modal
 * - Archive confirmation
 * - Empty state for no plans
 *
 * Route: /initiatives/:id
 *
 * @example
 * // Renders at /initiatives/abc123
 * <InitiativeDetailPage />
 */
export function InitiativeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { initiative, plans, isLoading, error, refresh } = useInitiative(id);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addPlanSheetOpen, setAddPlanSheetOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Handle edit modal save
  const handleEditSave = async (data: UpdateInitiativeInput) => {
    if (!id) return;
    await updateInitiative(id, data);
    await refresh(); // Refresh to show updated data
    invalidateInitiatives(); // Sync sidebar and other views
  };

  // Handle archive action
  const handleArchive = async () => {
    if (!id || !initiative) return;

    const confirmed = window.confirm(
      `Archive "${initiative.name}"? This will hide it from active views.`
    );

    if (!confirmed) return;

    setIsArchiving(true);
    try {
      await updateInitiative(id, { status: 'archived' });
      invalidateInitiatives(); // Sync sidebar and other views
      // Navigate back to initiatives list after archiving
      navigate('/initiatives');
    } catch (err) {
      console.error('Failed to archive initiative:', err);
      alert('Failed to archive initiative. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        {/* Header skeleton */}
        <div className="border-b border-border-subtle bg-bg-card/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-7">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-5 w-80 mt-1.5" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="p-6 bg-error/10 border border-error/30 rounded-lg text-center">
            <h2 className="text-lg font-semibold text-error mb-2">Error Loading Initiative</h2>
            <p className="text-text-secondary">{error}</p>
            <Link
              to="/initiatives"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to Initiatives
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 404 - Initiative not found
  if (!initiative) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-bg-tertiary to-bg-card border border-border-subtle flex items-center justify-center">
              <span className="text-3xl">🔍</span>
            </div>
            <h2 className="text-xl font-display font-medium text-text-primary mb-2">
              Initiative not found
            </h2>
            <p className="text-text-muted mb-8 max-w-sm mx-auto">
              The initiative you're looking for doesn't exist or has been deleted.
            </p>
            <Link
              to="/initiatives"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan active:scale-[0.98]"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to Initiatives
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const iconBgColor = initiative.color || '#00d9ff';

  // Filter out child plans already shown inside a coordination plan
  const childPlanIds = new Set(
    plans.flatMap((p) => p.sub_plan_ids ?? [])
  );
  const visiblePlans = plans.filter((p) => !childPlanIds.has(p.plan_id));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border-subtle bg-bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-7">
          {/* Back button */}
          <Link
            to="/initiatives"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent-cyan transition-colors mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Initiatives
          </Link>

          {/* Header content - matches InitiativesListPage typography */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div
                className="flex items-center justify-center w-14 h-14 rounded-xl flex-shrink-0"
                style={{ backgroundColor: `${iconBgColor}20` }}
              >
                <span className="text-3xl leading-none" role="img" aria-label="Initiative icon">
                  {initiative.icon || '🎯'}
                </span>
              </div>

              {/* Name and status */}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl font-semibold text-text-primary">
                    {initiative.name}
                  </h1>
                  <Badge variant={getStatusBadgeVariant(initiative.status)}>
                    {initiative.status}
                  </Badge>
                </div>
                {initiative.description && (
                  <p className="mt-1.5 text-sm text-text-muted max-w-2xl">
                    {initiative.description}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="gap-1.5"
              >
                <EditIcon size="sm" />
                Edit
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={isArchiving}
                className="gap-1.5"
              >
                <TrashIcon size="sm" />
                {isArchiving ? 'Archiving...' : 'Archive'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Plans section */}
        <div>
          {/* Header with title and action buttons */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Plans ({visiblePlans.length})
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddPlanSheetOpen(true)}
              >
                <PlusIcon size="sm" />
                Add Existing
              </Button>
              <Link
                to={`/plans/new?initiative=${initiative.initiative_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-accent-cyan text-bg-deep rounded-lg transition-all duration-150 hover:shadow-glow-cyan active:scale-[0.98]"
              >
                <PlusIcon size="sm" />
                Create Plan
              </Link>
            </div>
          </div>

          {visiblePlans.length === 0 ? (
            // Empty state - no plans
            <div className="flex flex-col items-center justify-center py-16 text-center border border-border-subtle rounded-xl bg-bg-card/50">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-tertiary flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-base font-medium text-text-primary mb-1">
                No plans in this initiative yet
              </h3>
              <p className="text-sm text-text-muted mb-6 max-w-sm">
                Create a new plan or add existing plans to this initiative.
              </p>
            </div>
          ) : (
            // Plans grid
            <div className="space-y-2.5">
              {visiblePlans.map((plan) => (
                <PlanCard key={plan.plan_id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <InitiativeModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initiative={initiative}
        onSave={handleEditSave}
      />

      {/* Add existing plans sheet */}
      <AddPlanSheet
        open={addPlanSheetOpen}
        onOpenChange={setAddPlanSheetOpen}
        initiativeId={initiative.initiative_id}
        excludePlanIds={plans.map((p) => p.plan_id)}
        onPlansAdded={() => {
          refresh();
          invalidateInitiatives();
        }}
      />
    </div>
  );
}
