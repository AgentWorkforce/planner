export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict';
  staged: boolean;
  origPath?: string;
  additions?: number;
  deletions?: number;
}

export interface GitCommit {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  date: string; // ISO 8601
}

export interface GitCommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
}
