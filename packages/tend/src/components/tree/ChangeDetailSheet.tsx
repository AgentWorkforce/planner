import { SheetContainer } from '../sheets/SheetContainer';
import type { GitFileStatus, GitCommit, GitCommitFile } from './git-types';

const FILE_STATUS_LABELS: Record<GitFileStatus['status'], string> = {
  modified:  'Modified',
  added:     'Added',
  deleted:   'Deleted',
  renamed:   'Renamed',
  untracked: 'Untracked',
  conflict:  'Conflict',
};

const FILE_STATUS_CLASSES: Record<GitFileStatus['status'], string> = {
  modified:  'bg-warning-light text-warning border border-warning/20',
  added:     'bg-success-light text-success border border-success/20',
  deleted:   'bg-error-light text-error border border-error/20',
  renamed:   'bg-info-light text-info border border-info/20',
  untracked: 'bg-bg-elevated text-text-muted border border-border-subtle',
  conflict:  'bg-error-light text-error border border-error/20 font-bold',
};

const COMMIT_FILE_STATUS_CONFIG: Record<
  GitCommitFile['status'],
  { icon: string; iconClassName: string }
> = {
  modified: { icon: '✎', iconClassName: 'text-warning' },
  added:    { icon: '+', iconClassName: 'text-success' },
  deleted:  { icon: '✗', iconClassName: 'text-error' },
  renamed:  { icon: '↷', iconClassName: 'text-info' },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LineStats({
  additions,
  deletions,
}: {
  additions?: number;
  deletions?: number;
}) {
  const hasAdd = additions !== undefined && additions > 0;
  const hasDel = deletions !== undefined && deletions > 0;
  if (!hasAdd && !hasDel) return null;

  return (
    <span className="text-xs font-mono flex items-center gap-0.5">
      <span className="text-text-muted opacity-40">[</span>
      {hasAdd && <span className="text-success">+{additions}</span>}
      {hasAdd && hasDel && <span className="text-text-muted opacity-40">|</span>}
      {hasDel && <span className="text-error">-{deletions}</span>}
      <span className="text-text-muted opacity-40">]</span>
    </span>
  );
}

export interface ChangeDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  file?: GitFileStatus;
  commit?: GitCommit;
  commitFiles?: GitCommitFile[];
}

export function ChangeDetailSheet({
  isOpen,
  onClose,
  file,
  commit,
  commitFiles,
}: ChangeDetailSheetProps) {
  const title = file ? 'File Changes' : commit ? 'Commit Details' : 'Details';

  return (
    <SheetContainer isOpen={isOpen} onClose={onClose} title={title}>
      {file && <FileDetail file={file} />}
      {commit && !file && (
        <CommitDetail commit={commit} files={commitFiles ?? []} />
      )}
    </SheetContainer>
  );
}

// --- File detail ---

function FileDetail({ file }: { file: GitFileStatus }) {
  return (
    <div className="px-6 py-5 space-y-6">
      {/* Path */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
          Path
        </label>
        <p className="text-sm text-text-primary font-mono break-all">{file.path}</p>
        {file.status === 'renamed' && file.origPath && (
          <p className="text-xs text-text-muted font-mono mt-1">
            from {file.origPath}
          </p>
        )}
      </div>

      {/* Status + line stats */}
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Status
          </label>
          <span
            className={`inline-block px-2.5 py-1 text-xs font-medium rounded ${FILE_STATUS_CLASSES[file.status]}`}
          >
            {FILE_STATUS_LABELS[file.status]}
          </span>
        </div>

        {(file.additions !== undefined || file.deletions !== undefined) && (
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Changes
            </label>
            <LineStats additions={file.additions} deletions={file.deletions} />
          </div>
        )}

        {file.staged && (
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Staged
            </label>
            <span className="text-xs text-success">● Staged</span>
          </div>
        )}
      </div>

      {/* Diff placeholder */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Diff
        </label>
        <div className="px-4 py-3 bg-bg-elevated border border-border-subtle rounded-md text-sm text-text-muted italic font-mono">
          Diff preview coming soon
        </div>
      </div>
    </div>
  );
}

// --- Commit detail ---

function CommitDetail({
  commit,
  files,
}: {
  commit: GitCommit;
  files: GitCommitFile[];
}) {
  return (
    <div className="px-6 py-5 space-y-6">
      {/* Hash + author + date */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Commit
          </label>
          <p className="text-sm text-text-primary font-mono break-all">{commit.hash}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Author
            </label>
            <p className="text-sm text-text-primary">{commit.author}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Date
            </label>
            <p className="text-sm text-text-primary">{formatDate(commit.date)}</p>
          </div>
        </div>
      </div>

      {/* Full message */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Message
        </label>
        <p className="text-sm text-text-primary whitespace-pre-wrap">{commit.message}</p>
      </div>

      {/* Changed files */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Changed Files{files.length > 0 ? ` (${files.length})` : ''}
        </label>

        {files.length === 0 ? (
          <p className="text-sm text-text-muted italic">No file data available</p>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => {
              const { icon, iconClassName } = COMMIT_FILE_STATUS_CONFIG[file.status];
              const basename = file.path.split('/').pop() ?? file.path;
              return (
                <div
                  key={file.path}
                  className="flex items-center gap-2 font-mono text-sm py-0.5"
                >
                  <span className={`flex-shrink-0 ${iconClassName}`}>{icon}</span>
                  <span className="text-text-secondary truncate flex-1 min-w-0" title={file.path}>
                    {basename}
                  </span>
                  <LineStats additions={file.additions} deletions={file.deletions} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
