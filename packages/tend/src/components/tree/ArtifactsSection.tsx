import { cn } from '@/lib/utils';

export interface ArtifactsSectionProps {
  artifacts?: Array<{ id: string; name: string; type: string }>;
  className?: string;
}

/**
 * ArtifactsSection - Shell for future artifact display
 *
 * Currently shows:
 * - "No artifacts yet" when empty
 * - Hidden when no artifacts
 *
 * Will be populated later by forge integration with:
 * - Test results
 * - Generated files
 * - PR links
 * - Documentation
 */
export function ArtifactsSection({ artifacts = [], className }: ArtifactsSectionProps) {
  // Hidden when no artifacts
  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div className={cn('px-3 py-2 border-t border-border-subtle', className)}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">Artifacts</h3>
      <div className="text-xs text-text-muted">No artifacts yet</div>
    </div>
  );
}
