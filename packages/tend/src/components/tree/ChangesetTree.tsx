import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useWorkingChanges } from '@/hooks/useWorkingChanges';
import { useCommitLog } from '@/hooks/useCommitLog';
import { ChangeGroup } from './ChangeGroup';
import { CommitSection } from './CommitSection';
import { ChangeDetailSheet } from './ChangeDetailSheet';
import type { GitFileStatus } from './git-types';

export function ChangesetTree({ className }: { className?: string }) {
  const { changes, isClean, available, loading, totalChanges } =
    useWorkingChanges();

  // Refetch commit log when file count drops (likely a commit happened)
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const prevTotalRef = useRef(totalChanges);

  useEffect(() => {
    if (prevTotalRef.current > totalChanges) {
      setRefreshTrigger((n) => n + 1);
    }
    prevTotalRef.current = totalChanges;
  }, [totalChanges]);

  const { commits, loading: commitsLoading } = useCommitLog(refreshTrigger);

  // Per-scope expand/collapse state: all scopes start collapsed
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());

  const handleToggle = (scope: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  // Detail sheet state: file mode only (commit expand is inline in CommitNode)
  const [sheetFile, setSheetFile] = useState<GitFileStatus | null>(null);

  const handleFileClick = useCallback((file: GitFileStatus) => {
    setSheetFile(file);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSheetFile(null);
  }, []);

  // — Not a git repo
  if (!available) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <span className="text-xs text-text-muted font-mono">No repository detected</span>
      </div>
    );
  }

  // — First load skeleton
  if (loading && totalChanges === 0 && commits.length === 0) {
    return (
      <div className={cn('flex flex-col h-full py-2 px-2 gap-2', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 rounded bg-border/20 animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        ))}
      </div>
    );
  }

  // — Empty repo
  if (isClean && commits.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <span className="text-xs text-text-muted font-mono italic">Empty repository</span>
      </div>
    );
  }

  return (
    <>
      <div className={cn('flex flex-col h-full', className)}>
        {/* Uncommitted changes — fills available space, scrolls independently */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {isClean ? (
            <p className="text-xs text-text-muted font-mono mb-1 italic">
              Working directory clean
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-text-secondary uppercase tracking-wider font-mono mb-1">
                Uncommitted Changes
              </div>
              {changes.map(({ scope, files }) => (
                <ChangeGroup
                  key={scope}
                  scope={scope}
                  files={files}
                  isExpanded={expandedScopes.has(scope)}
                  onToggle={() => handleToggle(scope)}
                  onFileClick={handleFileClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent commits — pinned to bottom, scrolls independently */}
        <div className="flex-shrink-0 max-h-[40%] flex flex-col border-t border-border-subtle">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-mono px-2 pt-2 pb-1 flex-shrink-0">
            Recent Commits
          </div>
          <div className="overflow-y-auto px-2 pb-2">
            <CommitSection commits={commits} loading={commitsLoading} />
          </div>
        </div>
      </div>

      <ChangeDetailSheet
        isOpen={sheetFile !== null}
        onClose={handleSheetClose}
        file={sheetFile ?? undefined}
      />
    </>
  );
}
