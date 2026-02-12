import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);

/**
 * WorktreeManager manages git worktrees for isolated Forge run execution.
 *
 * Each run gets its own worktree so agents don't pollute the main checkout.
 * This is critical for parallel execution — multiple agents working in
 * the same directory would cause conflicts.
 */
export class WorktreeManager {
  constructor(
    private readonly repoRoot: string,
    private readonly worktreeBase: string
  ) {}

  /**
   * Create a git worktree for a run.
   * Uses detached HEAD from current branch so work is isolated.
   * @returns The absolute path to the worktree directory.
   */
  async create(runId: string): Promise<string> {
    const worktreePath = join(this.worktreeBase, `forge-run-${runId.slice(0, 12)}`);

    // Create base directory if it doesn't exist
    await execFileAsync('mkdir', ['-p', this.worktreeBase]);

    // If the worktree directory already exists (e.g. from a previous failed run being resumed),
    // reuse it — the completed work from the previous attempt is still there
    if (existsSync(worktreePath)) {
      console.log(`[WorktreeManager] Reusing existing worktree at ${worktreePath}`);
      return worktreePath;
    }

    // Create worktree with detached HEAD
    await execFileAsync('git', ['worktree', 'add', '--detach', worktreePath], {
      cwd: this.repoRoot,
    });

    console.log(`[WorktreeManager] Created worktree at ${worktreePath}`);
    return worktreePath;
  }

  /**
   * Create a git worktree for a build.
   * Uses detached HEAD from current branch so work is isolated.
   * @returns The absolute path to the worktree directory.
   */
  async createForBuild(buildId: string): Promise<string> {
    const worktreePath = join(this.worktreeBase, `forge-build-${buildId.slice(0, 12)}`);

    // Create base directory if it doesn't exist
    await execFileAsync('mkdir', ['-p', this.worktreeBase]);

    // Create worktree with detached HEAD (committed state)
    await execFileAsync('git', ['worktree', 'add', '--detach', worktreePath], {
      cwd: this.repoRoot,
    });

    // Overlay uncommitted working tree state (modified + untracked files)
    await this.overlayWorkingTree(worktreePath);

    console.log(`[WorktreeManager] Created build worktree at ${worktreePath}`);
    return worktreePath;
  }

  /**
   * Overlay uncommitted working tree state into the worktree.
   * Copies modified tracked files AND untracked files so agents see
   * the current state, not just the last commit.
   */
  private async overlayWorkingTree(worktreePath: string): Promise<void> {
    try {
      await execFileAsync('rsync', [
        '-a',
        '--exclude', '.git',
        '--exclude', 'node_modules',
        '--exclude', 'dist',
        '--exclude', '.forge-worktrees',
        '--exclude', '*.db',
        '--exclude', '*.db-journal',
        '--exclude', 'tsconfig.tsbuildinfo',
        this.repoRoot + '/',
        worktreePath + '/',
      ]);
      console.log(`[WorktreeManager] Overlaid working tree state into ${worktreePath}`);
    } catch (err) {
      // Non-fatal — worktree still usable with committed state
      console.error(`[WorktreeManager] Failed to overlay working tree:`, err);
    }
  }

  /**
   * Remove a git worktree after run completion.
   */
  async remove(worktreePath: string): Promise<void> {
    if (!existsSync(worktreePath)) {
      console.warn(`[WorktreeManager] Worktree not found: ${worktreePath}`);
      return;
    }

    try {
      await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: this.repoRoot,
      });
      console.log(`[WorktreeManager] Removed worktree at ${worktreePath}`);
    } catch (err) {
      console.error(`[WorktreeManager] Failed to remove worktree ${worktreePath}:`, err);
    }
  }

  /**
   * Clean up all forge worktrees.
   */
  async removeAll(): Promise<void> {
    try {
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: this.repoRoot,
      });

      const worktreePaths = stdout
        .split('\n')
        .filter((line) => line.startsWith('worktree '))
        .map((line) => line.replace('worktree ', ''))
        .filter((path) => path.includes('forge-run-') || path.includes('forge-build-'));

      for (const path of worktreePaths) {
        await this.remove(path);
      }
    } catch (err) {
      console.error('[WorktreeManager] Failed to list worktrees:', err);
    }
  }
}
