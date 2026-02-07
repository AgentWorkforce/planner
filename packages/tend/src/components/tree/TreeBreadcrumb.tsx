import { useSearchParams } from 'react-router-dom';

/**
 * Props for TreeBreadcrumb component
 */
export interface TreeBreadcrumbProps {
  /** Plan/project name */
  projectName?: string;
  /** Current scope name (when zoomed to scope/step level) */
  scopeName?: string | null;
  /** Current step title (when zoomed to step level) */
  stepTitle?: string | null;
  /** Optional CSS class */
  className?: string;
}

/**
 * TreeBreadcrumb
 *
 * Breadcrumb navigation showing current location in the project tree.
 * Each segment is clickable to zoom out to that level.
 *
 * Hierarchy:
 * - Project (overview level)
 * - Project > Scope (scope level)
 * - Project > Scope > Step (step level)
 *
 * URL param sync:
 * - Reads from: ?zoom=overview|scope|step&focus=scope-id.step-id
 * - Updates: setSearchParams on click
 *
 * Style: Small text with separator, clickable segments with hover states
 *
 * @example
 * ```tsx
 * <TreeBreadcrumb
 *   projectName="My Project"
 *   scopeName="api-service"
 *   stepTitle="Add authentication"
 * />
 * ```
 */
export function TreeBreadcrumb({
  projectName = 'Project',
  scopeName,
  stepTitle,
  className = '',
}: TreeBreadcrumbProps) {
  const [, setSearchParams] = useSearchParams();

  const handleZoomToProject = () => {
    const params = new URLSearchParams();
    params.set('zoom', 'overview');
    setSearchParams(params);
  };

  const handleZoomToScope = () => {
    if (!scopeName) return;
    const params = new URLSearchParams();
    params.set('zoom', 'scope');
    params.set('focus', scopeName);
    setSearchParams(params);
  };

  // Determine which segments to show
  const showScope = scopeName !== null;
  const showStep = stepTitle !== null;

  return (
    <nav className={`text-xs text-text-muted ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {/* Project segment */}
        <li>
          <button
            type="button"
            onClick={handleZoomToProject}
            className="hover:text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green rounded"
          >
            {projectName}
          </button>
        </li>

        {/* Scope segment */}
        {showScope && (
          <>
            <li className="text-text-dim" aria-hidden="true">
              /
            </li>
            <li>
              <button
                type="button"
                onClick={handleZoomToScope}
                className="hover:text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green rounded"
              >
                {scopeName}
              </button>
            </li>
          </>
        )}

        {/* Step segment */}
        {showStep && (
          <>
            <li className="text-text-dim" aria-hidden="true">
              /
            </li>
            <li className="text-text-primary">{stepTitle}</li>
          </>
        )}
      </ol>
    </nav>
  );
}
