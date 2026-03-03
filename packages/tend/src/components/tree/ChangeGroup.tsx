import { cn } from '@/lib/utils';
import { FileNode } from './FileNode';
import type { GitFileStatus } from './git-types';

const DEFAULT_MAX_FILES = 50;

function getScopeLabel(scope: string): string {
  if (scope === 'root') return './';
  return `packages/${scope}/`;
}

function sortFiles(files: GitFileStatus[]): GitFileStatus[] {
  return [...files].sort((a, b) =>
    (a.status === 'conflict' ? -1 : 0) - (b.status === 'conflict' ? -1 : 0)
  );
}

interface ChangeGroupProps {
  scope: string;
  files: GitFileStatus[];
  isExpanded?: boolean;
  onToggle?: () => void;
  onFileClick?: (file: GitFileStatus) => void;
  maxFiles?: number;
  className?: string;
}

export function ChangeGroup({
  scope,
  files,
  isExpanded = false,
  onToggle,
  onFileClick,
  maxFiles = DEFAULT_MAX_FILES,
  className,
}: ChangeGroupProps) {
  const chevron = isExpanded ? '▼' : '▶';
  const scopeLabel = getScopeLabel(scope);
  const sorted = sortFiles(files);
  const visible = sorted.slice(0, maxFiles);
  const overflow = sorted.length - visible.length;

  return (
    <div className={cn('font-mono text-sm', className)}>
      {/* Scope header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors select-none"
      >
        <span className="text-xs text-text-muted flex-shrink-0 w-3 leading-5">{chevron}</span>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 text-text-muted ml-[-2px] mr-[2px]">
          <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75ZM1.5 2.75a.25.25 0 0 1 .25-.25H5c.091 0 .177.042.232.1l.9 1.2c.333.444.85.7 1.4.7h6.7a.25.25 0 0 1 .25.25v8.25a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25V2.75Z" />
        </svg>
        <span className="text-sm font-medium text-text-primary truncate">{scopeLabel}</span>
        <span className="flex-1 min-w-0 overflow-hidden text-text-muted select-none opacity-40 leading-none">
          {'·'.repeat(40)}
        </span>
        <span className="text-xs text-text-muted flex-shrink-0 tabular-nums">
          {files.length}
        </span>
      </div>

      {/* File list with box-drawing connectors */}
      {isExpanded && (
        <div className="ml-4">
          {visible.length === 0 ? (
            <div className="flex items-center">
              <span className="text-text-muted opacity-40 mr-1 select-none">└─</span>
              <span className="text-xs text-text-muted italic">no files</span>
            </div>
          ) : (
            <>
              {visible.map((file, index) => {
                const isLast = index === visible.length - 1 && overflow === 0;
                const connector = isLast ? '└─' : '├─';
                return (
                  <div key={file.path} className="flex items-center">
                    <span className="text-text-muted opacity-40 flex-shrink-0 mr-1 select-none">
                      {connector}
                    </span>
                    <div className="flex-1 min-w-0">
                      <FileNode
                        file={file}
                        onClick={onFileClick ? () => onFileClick(file) : undefined}
                      />
                    </div>
                  </div>
                );
              })}

              {overflow > 0 && (
                <div className="flex items-center">
                  <span className="text-text-muted opacity-40 flex-shrink-0 mr-1 select-none">
                    └─
                  </span>
                  <span className="text-xs text-text-muted italic opacity-60">
                    +{overflow} more
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
