import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { RowsIcon } from '@/components/icons/RowsIcon';
import { ColumnsIcon } from '@/components/icons/ColumnsIcon';
import { InitiativeTabs } from './InitiativeTabs';

export type ViewMode = 'sequence' | 'board';

export interface PipelineToolbarProps {
  /** Currently selected initiative ID (null = All) */
  selectedInitiative: string | null;
  /** Callback when initiative selection changes */
  onSelectInitiative: (id: string | null) => void;
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback when view mode changes */
  onViewModeChange: (mode: ViewMode) => void;
  /** Optional callback for New Plan button */
  onNewPlan?: () => void;
}

/**
 * PipelineToolbar - Two-row toolbar for the pipeline view.
 *
 * Implements the two_row_toolbar pattern from ui-pipeline-view spec.
 *
 * Row 1: Breadcrumb + action
 * - Left: "Pipeline" title
 * - Right: "+ New Plan" button
 *
 * Row 2: Filters + view toggle
 * - Left: InitiativeTabs (horizontal scrollable pills)
 * - Right: View mode toggle (Sequence | Board)
 *
 * Design spec: docs/flow/features/ui-pipeline-view.json step p011
 *
 * @example
 * ```tsx
 * function PipelinePage() {
 *   const [selectedInitiative, setSelectedInitiative] = useState<string | null>(null);
 *   const [viewMode, setViewMode] = useState<ViewMode>('sequence');
 *
 *   return (
 *     <div>
 *       <PipelineToolbar
 *         selectedInitiative={selectedInitiative}
 *         onSelectInitiative={setSelectedInitiative}
 *         viewMode={viewMode}
 *         onViewModeChange={setViewMode}
 *       />
 *       {viewMode === 'sequence' ? <SequenceView /> : <BoardView />}
 *     </div>
 *   );
 * }
 * ```
 */
export function PipelineToolbar({
  selectedInitiative,
  onSelectInitiative,
  viewMode,
  onViewModeChange,
  onNewPlan,
}: PipelineToolbarProps) {
  return (
    <div className="border-b border-border-subtle">
      {/* Row 1: Breadcrumb + Action */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border-subtle">
        <h1 className="font-display text-lg font-semibold text-text-primary">
          Pipeline
        </h1>
        <Button
          asChild
          variant="primary"
          size="sm"
          onClick={onNewPlan}
        >
          <Link to="/plans/new">
            <PlusIcon size="sm" />
            New Plan
          </Link>
        </Button>
      </div>

      {/* Row 2: Filters + View Toggle */}
      <div className="flex items-center justify-between h-12 px-4 gap-4">
        {/* Left: Initiative Filter */}
        <InitiativeTabs
          selectedId={selectedInitiative}
          onSelect={onSelectInitiative}
        />

        {/* Right: View Mode Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
    </div>
  );
}

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/**
 * ViewModeToggle - Toggle between Sequence and Board views.
 *
 * Uses icon-based toggle with RowsIcon (sequence) and ColumnsIcon (board).
 */
function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onChange(val as ViewMode);
      }}
      variant="outline"
      size="sm"
      aria-label="View mode"
    >
      <ToggleGroupItem value="sequence" aria-label="Sequence view">
        <RowsIcon size="sm" />
      </ToggleGroupItem>
      <ToggleGroupItem value="board" aria-label="Board view">
        <ColumnsIcon size="sm" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
