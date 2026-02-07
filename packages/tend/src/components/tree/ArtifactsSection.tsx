/**
 * Props for ArtifactsSection component
 */
export interface ArtifactsSectionProps {
  /** Step ID to show artifacts for */
  stepId: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * ArtifactsSection
 *
 * Shell/placeholder for future artifact links related to a step.
 * Will display PRs, commits, issues, and other forge-generated artifacts.
 *
 * Future implementation will:
 * - Fetch artifacts from forge API via /api/forge/steps/:stepId/artifacts
 * - Display links to GitHub PRs, commits, issues
 * - Show artifact status (pending, success, failed)
 * - Group by artifact type
 *
 * Current state: Empty state with placeholder message
 *
 * @example
 * ```tsx
 * <ArtifactsSection stepId="step-123" />
 * ```
 */
export function ArtifactsSection({
  stepId: _stepId,
  className = '',
}: ArtifactsSectionProps) {
  // TODO: Fetch artifacts from forge API
  // const artifacts = useFetchArtifacts(_stepId);

  return (
    <div className={`p-3 ${className}`}>
      {/* Section header */}
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
        Artifacts
      </h3>

      {/* Empty state */}
      <div className="px-3 py-6 bg-bg-elevated border border-border-subtle rounded-md text-center">
        <p className="text-sm text-text-muted">
          No artifacts yet
        </p>
        <p className="text-xs text-text-dim mt-1">
          PRs, commits, and issues will appear here when forge runs this step
        </p>
      </div>

      {/* Future: Artifact list */}
      {/* {artifacts.length > 0 && (
        <div className="space-y-2">
          {artifacts.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )} */}
    </div>
  );
}
