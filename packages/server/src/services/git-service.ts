import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Mutex — serialises concurrent git commands to prevent race conditions
// ---------------------------------------------------------------------------

class Mutex {
  private chain = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>(resolve => {
      release = resolve;
    });
    const prev = this.chain;
    this.chain = this.chain.then(() => next);
    await prev;
    return release;
  }
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict';
  staged: boolean;
  origPath?: string;
  additions?: number;
  deletions?: number;
}

export interface GitCommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
}

export interface GitCommitFilesResponse {
  available: boolean;
  files: GitCommitFile[];
}

export interface GitStatusResponse {
  available: boolean;
  branch: string | null;
  detachedHead?: string;
  files: GitFileStatus[];
  ahead: number;
  behind: number;
  hasConflicts: boolean;
}

export interface GitCommit {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  date: string; // ISO 8601
}

export interface GitLogResponse {
  available: boolean;
  commits: GitCommit[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a single porcelain v2 XY status character to a GitFileStatus status */
function mapStatusChar(char: string): GitFileStatus['status'] | null {
  switch (char) {
    case 'M': return 'modified';
    case 'A': return 'added';
    case 'D': return 'deleted';
    case '.': return null; // unchanged side — no entry needed
    default:  return 'modified'; // treat unknown chars conservatively
  }
}

const DEFAULT_STATUS: GitStatusResponse = {
  available: false,
  branch: null,
  files: [],
  ahead: 0,
  behind: 0,
  hasConflicts: false,
};

const DEFAULT_LOG: GitLogResponse = {
  available: false,
  commits: [],
};

// ---------------------------------------------------------------------------
// GitService
// ---------------------------------------------------------------------------

export class GitService {
  private repoRoot: string;
  private gitRoot: string | null = null;
  public available = false;
  private mutex = new Mutex();
  private statusCache: { data: GitStatusResponse; ts: number } | null = null;
  private logCache: { data: GitLogResponse; ts: number; limit: number } | null = null;
  private static STATUS_TTL = 3000;
  private static LOG_TTL = 10_000;

  constructor(opts?: { repoRoot?: string }) {
    this.repoRoot = opts?.repoRoot ?? process.cwd();
  }

  /**
   * Detect whether git is available in the repoRoot. Must be called once
   * before using getStatus() / getLog(). Safe to call multiple times.
   */
  async initialize(): Promise<void> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
        cwd: this.repoRoot,
      });
      this.gitRoot = stdout.trim();
      this.available = true;
    } catch (err) {
      this.available = false;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[git-service] Git not available: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // getStatus
  // -------------------------------------------------------------------------

  async getStatus(): Promise<GitStatusResponse> {
    if (!this.available) {
      return { ...DEFAULT_STATUS };
    }

    const now = Date.now();
    if (this.statusCache && now - this.statusCache.ts < GitService.STATUS_TTL) {
      return this.statusCache.data;
    }

    const release = await this.mutex.acquire();
    try {
      // Re-check cache after acquiring lock (another caller may have populated it)
      const now2 = Date.now();
      if (this.statusCache && now2 - this.statusCache.ts < GitService.STATUS_TTL) {
        return this.statusCache.data;
      }

      const [statusResult, unstagedResult, stagedResult] = await Promise.all([
        execFileAsync('git', ['status', '--porcelain=v2', '-b', '-z'], {
          cwd: this.gitRoot!,
          maxBuffer: 1024 * 1024,
        }),
        execFileAsync('git', ['diff', '--numstat'], {
          cwd: this.gitRoot!,
          maxBuffer: 1024 * 1024,
        }).catch(() => ({ stdout: '' })),
        execFileAsync('git', ['diff', '--cached', '--numstat'], {
          cwd: this.gitRoot!,
          maxBuffer: 1024 * 1024,
        }).catch(() => ({ stdout: '' })),
      ]);

      const result = this.parsePortcelainV2(statusResult.stdout);
      const numstatMap = this.parseNumstat(unstagedResult.stdout, stagedResult.stdout);
      this.mergeNumstatIntoFiles(result.files, numstatMap);
      this.statusCache = { data: result, ts: Date.now() };
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[git-service] Error in getStatus: ${message}`);
      return { ...DEFAULT_STATUS, available: true };
    } finally {
      release();
    }
  }

  // -------------------------------------------------------------------------
  // getLog
  // -------------------------------------------------------------------------

  async getLog(limit = 20): Promise<GitLogResponse> {
    if (!this.available) {
      return { ...DEFAULT_LOG };
    }

    const now = Date.now();
    if (
      this.logCache &&
      now - this.logCache.ts < GitService.LOG_TTL &&
      this.logCache.limit === limit
    ) {
      return this.logCache.data;
    }

    const release = await this.mutex.acquire();
    try {
      // Re-check cache after acquiring lock
      const now2 = Date.now();
      if (
        this.logCache &&
        now2 - this.logCache.ts < GitService.LOG_TTL &&
        this.logCache.limit === limit
      ) {
        return this.logCache.data;
      }

      const format = '%H%x00%h%x00%an%x00%aI%x00%s';
      const { stdout } = await execFileAsync(
        'git',
        ['log', `--format=${format}`, `-n`, String(limit), '--no-merges'],
        { cwd: this.gitRoot!, maxBuffer: 1024 * 1024 },
      );

      const commits: GitCommit[] = stdout
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          const parts = line.split('\0');
          return {
            hash:      parts[0] ?? '',
            hashShort: parts[1] ?? '',
            author:    parts[2] ?? '',
            date:      parts[3] ?? '',
            message:   parts[4] ?? '',
          };
        });

      const result: GitLogResponse = { available: true, commits };
      this.logCache = { data: result, ts: Date.now(), limit };
      return result;
    } catch (err) {
      // Empty repo or other expected failure
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[git-service] Error in getLog: ${message}`);
      return { available: true, commits: [] };
    } finally {
      release();
    }
  }

  // -------------------------------------------------------------------------
  // Private: porcelain v2 parser
  // -------------------------------------------------------------------------

  /**
   * Parses `git status --porcelain=v2 -b -z` output.
   *
   * With -z, NUL is the record separator for file entries but header (#) lines
   * are still newline-terminated. We split on both delimiters and walk the
   * token stream sequentially, consuming an extra token for rename entries.
   */
  private parsePortcelainV2(raw: string): GitStatusResponse {
    const files: GitFileStatus[] = [];
    let branch: string | null = null;
    let detachedHead: string | undefined;
    let oid: string | undefined;
    let ahead = 0;
    let behind = 0;

    // Split on both newline and NUL to produce a flat token stream.
    const tokens = raw.split(/[\n\0]/).filter(t => t.length > 0);
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      // --- Header lines ---
      if (token.startsWith('# branch.head ')) {
        const value = token.slice('# branch.head '.length).trim();
        if (value === '(detached)') {
          branch = null;
          // detachedHead will be set when we see branch.oid
        } else {
          branch = value;
        }
        i++;
        continue;
      }

      if (token.startsWith('# branch.oid ')) {
        oid = token.slice('# branch.oid '.length).trim();
        if (branch === null) {
          detachedHead = oid.slice(0, 7);
        }
        i++;
        continue;
      }

      if (token.startsWith('# branch.ab ')) {
        const ab = token.slice('# branch.ab '.length).trim();
        const match = ab.match(/^\+(\d+)\s+-(\d+)$/);
        if (match) {
          ahead = parseInt(match[1], 10);
          behind = parseInt(match[2], 10);
        }
        i++;
        continue;
      }

      if (token.startsWith('#')) {
        // Other header we don't care about
        i++;
        continue;
      }

      // --- Entry lines ---

      if (token.startsWith('1 ')) {
        // Ordinary changed entry: "1 XY sub mH mI mW hH hI path"
        const parts = token.split(' ');
        const xy = parts[1] ?? '..';
        const path = parts.slice(8).join(' ');
        const x = xy[0] ?? '.';
        const y = xy[1] ?? '.';

        const stagedStatus = mapStatusChar(x);
        const unstagedStatus = mapStatusChar(y);

        if (stagedStatus !== null) {
          files.push({ path, status: stagedStatus, staged: true });
        }
        if (unstagedStatus !== null) {
          files.push({ path, status: unstagedStatus, staged: false });
        }

        i++;
        continue;
      }

      if (token.startsWith('2 ')) {
        // Rename/copy entry: "2 XY sub mH mI mW hH hI X{score} path"
        // The origPath is the NEXT NUL-delimited token.
        const parts = token.split(' ');
        const xy = parts[1] ?? '..';
        const path = parts.slice(9).join(' ');
        const x = xy[0] ?? '.';
        const y = xy[1] ?? '.';

        // Consume origPath from the next token
        const origPath = tokens[i + 1];
        i += 2; // consume both the entry token and the origPath token

        const stagedStatus = x !== '.' ? 'renamed' as const : null;
        const unstagedStatus = y !== '.' ? 'renamed' as const : null;

        if (stagedStatus !== null) {
          files.push({ path, status: stagedStatus, staged: true, origPath });
        }
        if (unstagedStatus !== null) {
          files.push({ path, status: unstagedStatus, staged: false, origPath });
        }

        continue;
      }

      if (token.startsWith('u ')) {
        // Unmerged/conflict entry: "u XY sub m1 m2 m3 mW h1 h2 h3 path"
        const parts = token.split(' ');
        const path = parts.slice(10).join(' ');
        files.push({ path, status: 'conflict', staged: false });
        i++;
        continue;
      }

      if (token.startsWith('? ')) {
        // Untracked: "? path"
        const path = token.slice(2);
        files.push({ path, status: 'untracked', staged: false });
        i++;
        continue;
      }

      // Unknown token — skip
      i++;
    }

    const hasConflicts = files.some(f => f.status === 'conflict');

    const result: GitStatusResponse = {
      available: true,
      branch,
      files,
      ahead,
      behind,
      hasConflicts,
    };

    if (detachedHead !== undefined) {
      result.detachedHead = detachedHead;
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Private: numstat parser
  // -------------------------------------------------------------------------

  /**
   * Parses `git diff --numstat` output (unstaged and staged) and returns a
   * map keyed by file path with summed additions/deletions.
   *
   * Binary files produce "-\t-\tpath" — these result in undefined values.
   */
  private parseNumstat(
    unstagedRaw: string,
    stagedRaw: string,
  ): Map<string, { additions: number | undefined; deletions: number | undefined }> {
    const map = new Map<string, { additions: number | undefined; deletions: number | undefined }>();

    const parseLine = (line: string): void => {
      const parts = line.split('\t');
      if (parts.length < 3) return;

      const addStr = parts[0];
      const delStr = parts[1];
      const path = parts.slice(2).join('\t'); // path may theoretically contain tabs

      if (!path) return;

      const isBinary = addStr === '-' || delStr === '-';
      const additions = isBinary ? undefined : parseInt(addStr, 10);
      const deletions = isBinary ? undefined : parseInt(delStr, 10);

      const existing = map.get(path);
      if (existing) {
        map.set(path, {
          additions: additions !== undefined && existing.additions !== undefined
            ? existing.additions + additions
            : existing.additions ?? additions,
          deletions: deletions !== undefined && existing.deletions !== undefined
            ? existing.deletions + deletions
            : existing.deletions ?? deletions,
        });
      } else {
        map.set(path, { additions, deletions });
      }
    };

    for (const raw of [unstagedRaw, stagedRaw]) {
      raw.split('\n').filter(l => l.trim() !== '').forEach(parseLine);
    }

    return map;
  }

  /**
   * Merges numstat additions/deletions into the file status entries in-place.
   * Matches on the canonical path. For renamed files the new path is used.
   */
  private mergeNumstatIntoFiles(
    files: GitFileStatus[],
    numstatMap: Map<string, { additions: number | undefined; deletions: number | undefined }>,
  ): void {
    for (const file of files) {
      const stats = numstatMap.get(file.path);
      if (stats) {
        file.additions = stats.additions;
        file.deletions = stats.deletions;
      }
    }
  }

  // -------------------------------------------------------------------------
  // getCommitFiles
  // -------------------------------------------------------------------------

  /**
   * Returns the set of files changed in a given commit, along with per-file
   * line addition/deletion counts and change status.
   *
   * The hash parameter is validated against a safe pattern before being
   * passed to git to prevent command injection.
   */
  async getCommitFiles(hash: string): Promise<GitCommitFilesResponse> {
    const HASH_RE = /^[0-9a-f]{4,40}$/i;
    if (!HASH_RE.test(hash)) {
      return { available: false, files: [] };
    }

    if (!this.available) {
      return { available: false, files: [] };
    }

    try {
      const [numstatResult, nameStatusResult] = await Promise.all([
        execFileAsync(
          'git',
          ['diff-tree', '--no-commit-id', '--numstat', '-r', hash],
          { cwd: this.gitRoot!, maxBuffer: 1024 * 1024 },
        ),
        execFileAsync(
          'git',
          ['diff-tree', '--no-commit-id', '--name-status', '-r', hash],
          { cwd: this.gitRoot!, maxBuffer: 1024 * 1024 },
        ),
      ]);

      // Parse numstat: "<add>\t<del>\t<path>"
      const numstatMap = new Map<string, { additions: number | undefined; deletions: number | undefined }>();
      for (const line of numstatResult.stdout.split('\n').filter(l => l.trim() !== '')) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;
        const addStr = parts[0];
        const delStr = parts[1];
        const path = parts.slice(2).join('\t');
        if (!path) continue;
        const isBinary = addStr === '-' || delStr === '-';
        numstatMap.set(path, {
          additions: isBinary ? undefined : parseInt(addStr, 10),
          deletions: isBinary ? undefined : parseInt(delStr, 10),
        });
      }

      // Parse name-status: "<status>\t<path>" or "R<score>\t<old>\t<new>"
      const files: GitCommitFile[] = [];
      for (const line of nameStatusResult.stdout.split('\n').filter(l => l.trim() !== '')) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const statusCode = parts[0] ?? '';

        if (statusCode.startsWith('R')) {
          // Rename: R<score>\t<old>\t<new>
          const newPath = parts[2] ?? parts[1];
          const stats = numstatMap.get(newPath) ?? numstatMap.get(`${parts[1]} => ${newPath}`);
          files.push({
            path: newPath,
            status: 'renamed',
            additions: stats?.additions,
            deletions: stats?.deletions,
          });
        } else {
          const path = parts[1] ?? '';
          if (!path) continue;
          const stats = numstatMap.get(path);

          let status: GitCommitFile['status'];
          switch (statusCode) {
            case 'A': status = 'added'; break;
            case 'D': status = 'deleted'; break;
            default:  status = 'modified'; break;
          }

          files.push({
            path,
            status,
            additions: stats?.additions,
            deletions: stats?.deletions,
          });
        }
      }

      return { available: true, files };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[git-service] Error in getCommitFiles(${hash}): ${message}`);
      return { available: true, files: [] };
    }
  }
}
