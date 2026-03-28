import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useInitiatives, invalidateInitiatives } from '@/hooks/useInitiatives';
import { createInitiative, reorderInitiatives } from '@/api/initiatives';
import { InitiativeCard } from '@/components/initiatives/InitiativeCard';
import { InitiativeCardSkeleton } from '@/components/initiatives/InitiativeCardSkeleton';
import { InitiativeModal } from '@/components/initiatives/InitiativeModal';
import { PlusIcon, InitiativesIcon } from '@/components/icons';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { InitiativeStatus, InitiativeWithPlanCounts, CreateInitiativeInput, UpdateInitiativeInput } from '@/types/initiative';

type FilterOption = InitiativeStatus | 'all';

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

/**
 * SortableInitiativeCard Component
 *
 * Wraps InitiativeCard with drag-and-drop functionality using @dnd-kit.
 * Provides smooth animations and proper accessibility support.
 *
 * Props:
 * - initiative: The initiative to render
 *
 * Features:
 * - Drag handle (entire card is draggable)
 * - Keyboard navigation support
 * - Smooth transform animations during drag
 * - Accessible attributes for screen readers
 */
function SortableInitiativeCard({ initiative }: { initiative: InitiativeWithPlanCounts }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: initiative.initiative_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <InitiativeCard initiative={initiative} />
    </div>
  );
}

/**
 * InitiativesListPage Component
 *
 * Displays all initiatives in a responsive grid with:
 * - Status filtering (All, Active, Completed, Archived)
 * - Create new initiative action
 * - Loading skeleton states
 * - Empty state when no initiatives
 * - Error handling
 *
 * Grid layout:
 * - 1 column on mobile
 * - 2 columns on medium screens
 * - 3 columns on large screens
 *
 * Usage:
 * <Route path="/initiatives" element={<InitiativesListPage />} />
 */
export function InitiativesListPage() {
  const { initiatives, isLoading, error } = useInitiatives();
  const [statusFilter, setStatusFilter] = useState<FilterOption>('all');
  const [modalOpen, setModalOpen] = useState(false);

  // Set up sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter initiatives by status
  const filteredInitiatives = useMemo(() => {
    if (statusFilter === 'all') return initiatives;
    return initiatives.filter((i) => i.status === statusFilter);
  }, [initiatives, statusFilter]);

  // Handle creating new initiative
  const handleCreateInitiative = async (data: CreateInitiativeInput | UpdateInitiativeInput) => {
    await createInitiative(data as CreateInitiativeInput);
    invalidateInitiatives(); // Notify all useInitiatives hooks (including sidebar) to refresh
  };

  // Handle drag end to reorder initiatives
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Get the original order
    const oldIndex = filteredInitiatives.findIndex((i) => i.initiative_id === active.id);
    const newIndex = filteredInitiatives.findIndex((i) => i.initiative_id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder locally (optimistic update)
    const reordered = [...filteredInitiatives];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);

    // Extract IDs in new order
    const newOrder = reordered.map((i) => i.initiative_id);

    try {
      await reorderInitiatives(newOrder);
      invalidateInitiatives(); // Notify all hooks to refresh
    } catch (err) {
      console.error('Failed to reorder initiatives:', err);
      // On error, invalidate to restore original order from server
      invalidateInitiatives();
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border-subtle bg-bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-7">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold text-text-primary">Initiatives</h1>
              <p className="mt-1.5 text-sm text-text-muted">
                Organize and track strategic goals with grouped plans
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan active:scale-[0.98]"
            >
              <PlusIcon size="sm" />
              New Initiative
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Loading state */}
        {isLoading && (
          <div>
            {/* Filter tabs skeleton */}
            <div className="mb-6">
              <div className="flex gap-0.5 p-1 bg-bg-secondary/50 rounded-lg border border-border-subtle w-fit">
                {FILTER_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="px-3.5 py-1.5 w-20 h-8 bg-bg-tertiary rounded-md animate-pulse"
                  />
                ))}
              </div>
            </div>

            {/* Skeleton grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <InitiativeCardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {/* Empty state - no initiatives at all */}
        {!isLoading && !error && initiatives.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-bg-tertiary to-bg-card border border-border-subtle flex items-center justify-center">
              <InitiativesIcon size="xl" className="text-text-muted" />
            </div>
            <h2 className="text-xl font-display font-medium text-text-primary mb-2">
              No initiatives yet
            </h2>
            <p className="text-text-muted mb-8 max-w-sm mx-auto">
              Create your first initiative to organize plans around strategic goals.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan active:scale-[0.98]"
            >
              <PlusIcon size="sm" />
              Create your first initiative
            </button>
          </div>
        )}

        {/* Initiatives list with filters */}
        {!isLoading && !error && initiatives.length > 0 && (
          <div>
            {/* Status filter tabs */}
            <div className="mb-6">
              <ToggleGroup
                type="single"
                value={statusFilter}
                onValueChange={(val) => {
                  if (val) setStatusFilter(val as FilterOption);
                }}
                variant="tabs"
                aria-label="Filter by status"
              >
                {FILTER_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={`${option.label} initiatives`}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Filtered initiatives display */}
            {filteredInitiatives.length === 0 ? (
              /* Empty filtered state */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 mb-3 rounded-full bg-bg-tertiary flex items-center justify-center">
                  <InitiativesIcon size="md" className="text-text-muted" />
                </div>
                <p className="text-text-secondary font-medium">No {statusFilter} initiatives</p>
                <p className="text-sm text-text-muted mt-1">
                  Try selecting a different status filter
                </p>
              </div>
            ) : (
              /* Initiatives grid with drag-and-drop */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredInitiatives.map((i) => i.initiative_id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInitiatives.map((initiative) => (
                      <SortableInitiativeCard
                        key={initiative.initiative_id}
                        initiative={initiative}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </div>

      {/* Create Initiative Modal */}
      <InitiativeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleCreateInitiative}
      />
    </div>
  );
}
