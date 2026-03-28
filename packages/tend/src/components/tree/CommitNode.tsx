import { useState, useCallback, useRef } from 'react';
import { TreeNodeLayout } from './TreeNodeLayout';
import type { GitCommit, GitCommitFile } from './git-types';

const FILE_STATUS_CONFIG: Record<
  GitCommitFile['status'],
  { icon: string; iconClassName: string }
> = {
  modified: { icon: '✎', iconClassName: 'text-warning' },
  added:    { icon: '+', iconClassName: 'text-success' },
  deleted:  { icon: '✗', iconClassName: 'text-error' },
  renamed:  { icon: '↷', iconClassName: 'text-info' },
};

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface CommitNodeProps {
  commit: GitCommit;
  onClick?: () => void;
}

export function CommitNode({ commit, onClick }: CommitNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState<GitCommitFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Cache so re-expand doesn't refetch
  const cacheRef = useRef<GitCommitFile[] | null>(null);

  const handleClick = useCallback(async () => {
    onClick?.();

    const next = !isExpanded;
    setIsExpanded(next);

    if (!next) return;

    // Already fetched — use cache
    if (cacheRef.current !== null) {
      setFiles(cacheRef.current);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/git/commits/${commit.hash}/files`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { available: boolean; files?: GitCommitFile[] };
      const fetched = data.available && data.files ? data.files : [];
      cacheRef.current = fetched;
      setFiles(fetched);
    } catch {
      cacheRef.current = [];
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [commit.hash, isExpanded, onClick]);

  const trailing = (
    <span className="flex items-center gap-1.5 flex-shrink-0 pr-1.5">
      <span className="text-[10px] text-text-muted opacity-40 select-none">
        {isExpanded ? '▾' : '▸'}
      </span>
      <span className="text-xs text-text-muted tabular-nums">
        {formatRelativeTime(commit.date)}
      </span>
    </span>
  );

  return (
    <div>
      <TreeNodeLayout
        icon="✓"
        iconClassName="text-success"
        label={commit.message}
        trailing={trailing}
        onClick={handleClick}
      />

      {/* Inline expanded file list */}
      {isExpanded && (
        <div className="ml-4">
          {loading ? (
            <div className="flex items-center">
              <span className="text-text-muted opacity-40 mr-1 select-none">└─</span>
              <span className="text-xs text-text-muted animate-pulse">...</span>
            </div>
          ) : files === null || files.length === 0 ? (
            <div className="flex items-center">
              <span className="text-text-muted opacity-40 mr-1 select-none">└─</span>
              <span className="text-xs text-text-muted italic">no files</span>
            </div>
          ) : (
            files.map((file, index) => {
              const isLast = index === files.length - 1;
              const connector = isLast ? '└─' : '├─';
              const { icon, iconClassName } = FILE_STATUS_CONFIG[file.status];
              const basename = file.path.split('/').pop() ?? file.path;
              const hasStats =
                (file.additions !== undefined && file.additions > 0) ||
                (file.deletions !== undefined && file.deletions > 0);

              return (
                <div key={file.path} className="flex items-center font-mono text-sm">
                  <span className="text-text-muted opacity-40 flex-shrink-0 mr-1 select-none">
                    {connector}
                  </span>
                  <span className={`flex-shrink-0 mr-1.5 ${iconClassName}`}>{icon}</span>
                  <span className="text-text-secondary truncate flex-1 min-w-0">{basename}</span>
                  {hasStats && (
                    <span className="text-[10px] font-mono flex items-center gap-0.5 flex-shrink-0 pr-1.5">
                      <span className="text-text-muted opacity-40">[</span>
                      {file.additions !== undefined && file.additions > 0 && (
                        <span className="text-success">+{file.additions}</span>
                      )}
                      {file.additions !== undefined && file.additions > 0 &&
                       file.deletions !== undefined && file.deletions > 0 && (
                        <span className="text-text-muted opacity-40">|</span>
                      )}
                      {file.deletions !== undefined && file.deletions > 0 && (
                        <span className="text-error">-{file.deletions}</span>
                      )}
                      <span className="text-text-muted opacity-40">]</span>
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
