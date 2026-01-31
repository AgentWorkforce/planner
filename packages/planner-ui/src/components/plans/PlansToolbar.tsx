import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { RowsIcon } from '@/components/icons/RowsIcon';
import { DocumentIcon } from '@/components/icons/DocumentIcon';
import { TableIcon } from '@/components/icons/TableIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { CloseIcon } from '@/components/icons/CloseIcon';
import type { PlansFilter } from '@/hooks/usePlansFilter';
import type { PlanStatus } from '@/types/plan';
import type { PlansViewMode } from '@/hooks';

export interface PlansToolbarProps {
  /** Page title: "Plans" or "My Plans" */
  title: string;
  /** Current filter state */
  filter: PlansFilter;
  /** Update filter state */
  onFilterChange: (updates: Partial<PlansFilter>) => void;
  /** View mode: list, table, or grouped */
  viewMode: PlansViewMode;
  /** Change view mode */
  onViewModeChange: (mode: PlansViewMode) => void;
}

/**
 * PlansToolbar - Two-row toolbar for the plans list view with search.
 *
 * Implements catalog design_system pattern: two_row_toolbar
 *
 * Row 1: Breadcrumb + action
 * - Left: Page title (Plans / My Plans)
 * - Right: "+ New Plan" button
 *
 * Row 2: Filters + view mode
 * - Left: InitiativeTabs (horizontal scrollable pills)
 * - Right: Status filter (ToggleGroup) + View mode toggle
 *
 * Search: Below toolbar rows, full width with left padding matching content
 *
 * @example
 * ```tsx
 * function PlansListPage() {
 *   const { filter, setFilter } = usePlansFilter();
 *   const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
 *
 *   return (
 *     <div>
 *       <PlansToolbar
 *         title="Plans"
 *         filter={filter}
 *         onFilterChange={setFilter}
 *         viewMode={viewMode}
 *         onViewModeChange={setViewMode}
 *       />
 *       <PlansList ... />
 *     </div>
 *   );
 * }
 * ```
 */
export function PlansToolbar({
  title,
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange,
}: PlansToolbarProps) {
  return (
    <div className="border-b border-border-subtle">
      {/* Row 1: Breadcrumb + Action */}
      <div className="flex items-center justify-between h-12 px-4">
        <h1 className="font-display text-lg font-semibold text-text-primary">
          {title}
        </h1>
        <Button asChild variant="primary" size="sm">
          <Link to="/plans/new">
            <PlusIcon size="sm" />
            New Plan
          </Link>
        </Button>
      </div>

      {/* Row 2: Filters + Search + View Mode */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center h-12 px-4 gap-4">
        {/* Left: Status Filter */}
        <StatusToggle
          value={filter.status}
          onChange={(status) => onFilterChange({ status })}
        />

        {/* Center: Search Input */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-md">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size="sm" />
            <input
              type="text"
              placeholder="Search plans..."
              value={filter.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="w-full pl-8 pr-9 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan placeholder:text-text-muted transition-all"
            />
            {filter.search && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                aria-label="Clear search"
              >
                <CloseIcon size="sm" />
              </button>
            )}
          </div>
        </div>

        {/* Right: View Mode Toggle */}
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
      </div>
    </div>
  );
}

interface StatusToggleProps {
  value: PlanStatus | 'all';
  onChange: (status: PlanStatus | 'all') => void;
}

/**
 * StatusToggle - Filter plans by status (All, Draft, Approved, Published).
 */
function StatusToggle({ value, onChange }: StatusToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onChange(val as PlanStatus | 'all');
      }}
      variant="tabs"
      size="sm"
      aria-label="Filter by status"
    >
      <ToggleGroupItem value="all" aria-label="All plans">
        All
      </ToggleGroupItem>
      <ToggleGroupItem value="draft" aria-label="Draft plans">
        Draft
      </ToggleGroupItem>
      <ToggleGroupItem value="approved" aria-label="Approved plans">
        Approved
      </ToggleGroupItem>
      <ToggleGroupItem value="published" aria-label="Published plans">
        Published
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

interface ViewModeToggleProps {
  value: PlansViewMode;
  onChange: (mode: PlansViewMode) => void;
}

/**
 * ViewModeToggle - Toggle between list, table, and grouped view.
 */
function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onChange(val as PlansViewMode);
      }}
      variant="outline"
      size="sm"
      aria-label="View mode"
    >
      <ToggleGroupItem value="table" aria-label="Table view">
        <RowsIcon size="sm" />
      </ToggleGroupItem>
      <ToggleGroupItem value="sectioned" aria-label="Sectioned table view">
        <TableIcon size="sm" />
      </ToggleGroupItem>
      <ToggleGroupItem value="cards" aria-label="Card view">
        <DocumentIcon size="sm" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
