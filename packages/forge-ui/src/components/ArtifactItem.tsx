/**
 * ArtifactItem - Individual artifact display component
 *
 * Features:
 * - ArtifactTypeIcon on left
 * - Title/reference as external link
 * - Task title as secondary text
 * - Status badge for PRs (from metadata.status)
 * - Copy link button on hover
 * - Relative timestamp ('5m ago')
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ArtifactTypeIcon } from './ArtifactTypeIcon';
import { PRStatusBadge } from './PRStatusBadge';
import type { Artifact, PRStatus } from '@/types';

interface ArtifactItemProps {
  artifact: Artifact;
  onRefreshPR?: (artifactId: string) => void;
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Format relative timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diffMs = now - time;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Extract display title from artifact
 */
function getDisplayTitle(artifact: Artifact): string {
  if (artifact.label) return artifact.label;
  if (artifact.name) return artifact.name;
  // Try to extract a meaningful title from the reference
  if (artifact.reference) {
    // For URLs, try to get a meaningful part
    try {
      const url = new URL(artifact.reference);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        // For GitHub PRs/commits, use the last part
        return pathParts[pathParts.length - 1];
      }
    } catch {
      // Not a URL, use as-is
    }
    return artifact.reference;
  }
  return artifact.artifact_id.slice(0, 8);
}

/**
 * Check if reference is a valid URL
 */
function isValidUrl(reference: string): boolean {
  try {
    new URL(reference);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy icon
 */
function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * Check icon (for copy success)
 */
function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * External link icon
 */
function ExternalLinkIcon({ className }: { className?: string }) {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function ArtifactItem({
  artifact,
  onRefreshPR,
  isRefreshing = false,
  className,
}: ArtifactItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayTitle = getDisplayTitle(artifact);
  const isUrl = isValidUrl(artifact.reference);
  const isPR = artifact.type === 'pr';
  const prStatus = artifact.metadata?.status as PRStatus | undefined;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(artifact.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [artifact.reference]);

  const handleRefreshPR = useCallback(() => {
    if (onRefreshPR) {
      onRefreshPR(artifact.artifact_id);
    }
  }, [onRefreshPR, artifact.artifact_id]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
        'hover:bg-bg-hover',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Type icon */}
      <ArtifactTypeIcon type={artifact.type} size="sm" className="flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Title/Reference */}
          {isUrl ? (
            <a
              href={artifact.reference}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-primary hover:text-accent-cyan truncate transition-colors inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {displayTitle}
              <ExternalLinkIcon className="h-3 w-3 opacity-50" />
            </a>
          ) : (
            <span className="text-sm text-text-primary truncate">{displayTitle}</span>
          )}

          {/* PR Status Badge */}
          {isPR && prStatus && (
            <PRStatusBadge
              status={prStatus}
              lastChecked={artifact.metadata?.last_checked as string | undefined}
              onRefresh={onRefreshPR ? handleRefreshPR : undefined}
              isRefreshing={isRefreshing}
            />
          )}
        </div>

        {/* Task title as secondary text */}
        {artifact.task_title && (
          <p className="text-xs text-text-muted truncate mt-0.5">{artifact.task_title}</p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-text-muted flex-shrink-0">
        {formatRelativeTime(artifact.created_at)}
      </span>

      {/* Copy button on hover */}
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="p-1 rounded hover:bg-bg-tertiary transition-colors flex-shrink-0"
          title="Copy link"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-success" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5 text-text-muted hover:text-text-secondary" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Compact version for inline use in task items
 */
export function ArtifactItemCompact({
  artifact,
  className,
}: {
  artifact: Artifact;
  className?: string;
}) {
  const displayTitle = getDisplayTitle(artifact);
  const isUrl = isValidUrl(artifact.reference);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-accent-light',
        className
      )}
    >
      <ArtifactTypeIcon type={artifact.type} size="sm" className="h-3 w-3" />
      {isUrl ? (
        <a
          href={artifact.reference}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-cyan hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {displayTitle}
        </a>
      ) : (
        <span className="text-text-secondary">{displayTitle}</span>
      )}
    </span>
  );
}
