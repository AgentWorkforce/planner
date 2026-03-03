import { TreeNodeLayout } from './TreeNodeLayout';
import type { GitFileStatus } from './git-types';

const STATUS_CONFIG: Record<
  GitFileStatus['status'],
  { icon: string; iconClassName: string }
> = {
  modified:  { icon: '✎', iconClassName: 'text-warning' },
  added:     { icon: '+', iconClassName: 'text-success' },
  deleted:   { icon: '✗', iconClassName: 'text-error' },
  renamed:   { icon: '↷', iconClassName: 'text-info' },
  untracked: { icon: '◌', iconClassName: 'text-text-muted' },
  conflict:  { icon: '⚡', iconClassName: 'text-error font-bold' },
};

function getLabel(file: GitFileStatus): string {
  const newName = file.path.split('/').pop() ?? file.path;
  if (file.status === 'renamed' && file.origPath) {
    const oldName = file.origPath.split('/').pop() ?? file.origPath;
    return `${oldName} → ${newName}`;
  }
  return newName;
}

interface FileNodeProps {
  file: GitFileStatus;
  isSelected?: boolean;
  onClick?: () => void;
}

export function FileNode({ file, isSelected, onClick }: FileNodeProps) {
  const { icon, iconClassName } = STATUS_CONFIG[file.status];

  const hasStats =
    (file.additions !== undefined && file.additions > 0) ||
    (file.deletions !== undefined && file.deletions > 0);

  const trailing = (
    <span className="flex items-center gap-1.5 flex-shrink-0 pr-1.5">
      {file.staged && (
        <span className="text-xs text-success/60">●</span>
      )}
      {hasStats && (
        <span className="text-[10px] font-mono flex items-center gap-0.5">
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
    </span>
  );

  return (
    <TreeNodeLayout
      icon={icon}
      iconClassName={iconClassName}
      label={getLabel(file)}
      trailing={trailing}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}
