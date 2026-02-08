/**
 * GateArtifactsList - Display artifacts associated with a gate
 *
 * Groups artifacts by type (PRs, commits, tests, etc.) with
 * external links, status badges, and copy functionality.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { GateArtifact } from '@/types';

interface GateArtifactsListProps {
  artifacts: GateArtifact[];
  className?: string;
}

type ArtifactGroup = {
  type: string;
  label: string;
  items: GateArtifact[];
};

const TYPE_LABELS: Record<string, string> = {
  pr: 'Pull Requests',
  commit: 'Commits',
  test: 'Test Results',
  file: 'Files',
  link: 'Links',
  other: 'Other',
};

const TYPE_ORDER = ['pr', 'commit', 'test', 'file', 'link', 'other'];

/**
 * Group artifacts by type
 */
function groupArtifacts(artifacts: GateArtifact[]): ArtifactGroup[] {
  const groups: Record<string, GateArtifact[]> = {};

  for (const artifact of artifacts) {
    const type = artifact.type || 'other';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(artifact);
  }

  return TYPE_ORDER
    .filter((type) => groups[type]?.length > 0)
    .map((type) => ({
      type,
      label: TYPE_LABELS[type] || type,
      items: groups[type],
    }));
}

/**
 * Get status badge styles
 */
function getStatusStyles(status?: string): { bg: string; text: string } {
  switch (status) {
    case 'open':
      return { bg: 'bg-amber-500/10', text: 'text-amber-500' };
    case 'merged':
      return { bg: 'bg-purple-500/10', text: 'text-purple-500' };
    case 'closed':
      return { bg: 'bg-text-muted/10', text: 'text-text-muted' };
    case 'passed':
      return { bg: 'bg-success/10', text: 'text-success' };
    case 'failed':
      return { bg: 'bg-error/10', text: 'text-error' };
    default:
      return { bg: '', text: '' };
  }
}

export function GateArtifactsList({ artifacts, className }: GateArtifactsListProps) {
  const groups = groupArtifacts(artifacts);

  if (groups.length === 0) {
    return (
      <div className={cn('text-sm text-text-muted italic', className)}>
        No artifacts attached
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {groups.map((group) => (
        <div key={group.type}>
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
            {group.label}
          </h4>
          <ul className="space-y-2">
            {group.items.map((artifact) => (
              <ArtifactItem key={artifact.artifact_id} artifact={artifact} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface ArtifactItemProps {
  artifact: GateArtifact;
}

function ArtifactItem({ artifact }: ArtifactItemProps) {
  const [copied, setCopied] = useState(false);
  const statusStyles = getStatusStyles(artifact.status);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(artifact.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <li className="group flex items-center gap-2">
      <ArtifactIcon type={artifact.type} className="h-4 w-4 text-text-muted flex-shrink-0" />

      <a
        href={artifact.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-sm text-text-primary hover:text-accent-cyan transition-colors truncate"
      >
        {artifact.label}
      </a>

      {artifact.status && (
        <span
          className={cn(
            'flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium capitalize',
            statusStyles.bg,
            statusStyles.text
          )}
        >
          {artifact.status}
        </span>
      )}

      <button
        onClick={handleCopy}
        className="flex-shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary opacity-0 group-hover:opacity-100 transition-all"
        title="Copy link"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-success" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>

      <a
        href={artifact.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary opacity-0 group-hover:opacity-100 transition-all"
        title="Open in new tab"
      >
        <ExternalLinkIcon className="h-3.5 w-3.5" />
      </a>
    </li>
  );
}

/**
 * Get icon for artifact type
 */
function ArtifactIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'pr':
      return <GitPullRequestIcon className={className} />;
    case 'commit':
      return <GitCommitIcon className={className} />;
    case 'test':
      return <TestTubeIcon className={className} />;
    case 'file':
      return <FileIcon className={className} />;
    default:
      return <LinkIcon className={className} />;
  }
}

function GitPullRequestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  );
}

function GitCommitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function TestTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2" />
      <path d="M8.5 2h7" />
      <path d="M14.5 16h-5" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
