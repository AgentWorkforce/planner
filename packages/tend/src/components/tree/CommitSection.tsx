import { CommitNode } from './CommitNode';
import type { GitCommit } from './git-types';

interface CommitSectionProps {
  commits: GitCommit[];
  loading?: boolean;
}

export function CommitSection({ commits, loading = false }: CommitSectionProps) {
  return (
    <div>
      {loading ? (
        <div className="text-xs text-text-muted animate-pulse">Loading...</div>
      ) : commits.length === 0 ? (
        <p className="text-xs text-text-muted italic">No commits yet</p>
      ) : (
        commits.map((commit) => (
          <CommitNode key={commit.hash} commit={commit} />
        ))
      )}
    </div>
  );
}
