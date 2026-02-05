/**
 * ArtifactGroup - Collapsible group of artifacts by type
 *
 * Features:
 * - Header with type icon, name, count
 * - Collapsible content area
 * - Default expanded for PRs and deployments
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ArtifactTypeIcon, getArtifactTypeName } from './ArtifactTypeIcon';
import { ArtifactItem } from './ArtifactItem';
import type { Artifact, ArtifactType } from '@/types';

interface ArtifactGroupProps {
  type: ArtifactType;
  artifacts: Artifact[];
  onRefreshPR?: (artifactId: string) => void;
  refreshingArtifacts?: Set<string>;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Chevron icon for collapse/expand
 */
function ChevronIcon({ className, isExpanded }: { className?: string; isExpanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'transition-transform duration-200',
        isExpanded && 'rotate-90',
        className
      )}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Determine if group should be expanded by default
 */
function shouldExpandByDefault(type: ArtifactType): boolean {
  return type === 'pr' || type === 'deployment';
}

export function ArtifactGroup({
  type,
  artifacts,
  onRefreshPR,
  refreshingArtifacts = new Set(),
  defaultExpanded,
  className,
}: ArtifactGroupProps) {
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded ?? shouldExpandByDefault(type)
  );

  if (artifacts.length === 0) return null;

  const groupName = getArtifactTypeName(type);

  return (
    <div className={cn('border border-border-subtle rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-3 w-full px-3 py-2 text-left',
          'hover:bg-bg-hover transition-colors',
          isExpanded && 'bg-bg-secondary'
        )}
      >
        <ChevronIcon className="h-4 w-4 text-text-muted flex-shrink-0" isExpanded={isExpanded} />
        <ArtifactTypeIcon type={type} size="sm" className="flex-shrink-0" />
        <span className="text-sm font-medium text-text-primary flex-1">{groupName}</span>
        <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">
          {artifacts.length}
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle">
          {artifacts.map((artifact) => (
            <ArtifactItem
              key={artifact.artifact_id}
              artifact={artifact}
              onRefreshPR={type === 'pr' ? onRefreshPR : undefined}
              isRefreshing={refreshingArtifacts.has(artifact.artifact_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact group for smaller spaces
 */
export function ArtifactGroupCompact({
  type,
  count,
  className,
}: {
  type: ArtifactType;
  count: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-secondary',
        className
      )}
    >
      <ArtifactTypeIcon type={type} size="sm" />
      <span className="text-xs text-text-secondary">{count}</span>
    </div>
  );
}
