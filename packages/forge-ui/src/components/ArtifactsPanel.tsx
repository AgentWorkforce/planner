/**
 * ArtifactsPanel - Panel for displaying all artifacts from a run
 *
 * Features:
 * - Header: 'Artifacts (N)' with refresh button
 * - ArtifactGroups for each type (PRs first, then deployments, commits, files, test results)
 * - Empty state: 'No artifacts produced yet'
 * - Loading state on refresh
 */

import { useMemo, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArtifactGroup } from './ArtifactGroup';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import type { Artifact, ArtifactType } from '@/types';

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  onRefresh?: () => void;
  onRefreshPR?: (artifactId: string) => void;
  isLoading?: boolean;
  refreshingArtifacts?: Set<string>;
  showHeader?: boolean;
  highlighted?: boolean;
  className?: string;
}

/**
 * Order for artifact type groups
 */
const TYPE_ORDER: ArtifactType[] = ['pr', 'deployment', 'commit', 'file', 'test_result'];

/**
 * Refresh icon
 */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

/**
 * Package icon for empty state
 */
function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16.5 9.4l-9-5.19" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

/**
 * Group artifacts by type
 */
function groupArtifactsByType(artifacts: Artifact[]): Map<ArtifactType, Artifact[]> {
  const groups = new Map<ArtifactType, Artifact[]>();

  for (const artifact of artifacts) {
    const existing = groups.get(artifact.type) || [];
    existing.push(artifact);
    groups.set(artifact.type, existing);
  }

  return groups;
}

export function ArtifactsPanel({
  artifacts,
  onRefresh,
  onRefreshPR,
  isLoading = false,
  refreshingArtifacts = new Set(),
  showHeader = true,
  highlighted = false,
  className,
}: ArtifactsPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupedArtifacts = useMemo(() => groupArtifactsByType(artifacts), [artifacts]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  // Sort groups by predefined order
  const sortedGroups = useMemo(() => {
    const result: { type: ArtifactType; artifacts: Artifact[] }[] = [];
    for (const type of TYPE_ORDER) {
      const group = groupedArtifacts.get(type);
      if (group && group.length > 0) {
        result.push({ type, artifacts: group });
      }
    }
    return result;
  }, [groupedArtifacts]);

  const totalCount = artifacts.length;
  const isEmpty = totalCount === 0;

  return (
    <div
      className={cn(
        'flex flex-col',
        highlighted && 'ring-2 ring-success/50 rounded-lg',
        className
      )}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
              Artifacts
            </h2>
            {totalCount > 0 && (
              <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
          </div>

          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Refresh artifacts"
            >
              <RefreshIcon
                className={cn('h-4 w-4 text-text-muted', isRefreshing && 'animate-spin')}
              />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={<PackageIcon className="h-6 w-6" />}
          title="No artifacts yet"
          description="Artifacts will appear here as agents produce PRs, commits, and other outputs."
          className="py-4"
        />
      ) : (
        <div className="space-y-3">
          {sortedGroups.map(({ type, artifacts: groupArtifacts }) => (
            <ArtifactGroup
              key={type}
              type={type}
              artifacts={groupArtifacts}
              onRefreshPR={onRefreshPR}
              refreshingArtifacts={refreshingArtifacts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Highlighted panel for run completion summary
 */
export function ArtifactsPanelHighlighted({
  artifacts,
  onRefresh,
  onRefreshPR,
  isLoading,
  refreshingArtifacts,
  className,
}: Omit<ArtifactsPanelProps, 'showHeader' | 'highlighted'>) {
  const totalCount = artifacts.length;

  return (
    <div
      className={cn(
        'bg-success-light/10 border border-success/30 rounded-lg p-4',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="h-5 w-5 text-success"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <h2 className="text-lg font-semibold text-text-primary">
          Run Complete - Artifacts Produced
        </h2>
        {totalCount > 0 && (
          <span className="text-sm text-success bg-success/20 px-2 py-0.5 rounded-full">
            {totalCount} artifact{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <ArtifactsPanel
        artifacts={artifacts}
        onRefresh={onRefresh}
        onRefreshPR={onRefreshPR}
        isLoading={isLoading}
        refreshingArtifacts={refreshingArtifacts}
        showHeader={false}
      />
    </div>
  );
}
