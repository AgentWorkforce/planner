import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

export class WorkspaceManager {
  private readonly base: string;
  private readonly activeWorkspaces = new Set<string>();
  private cleanupRegistered = false;

  constructor(base: string) {
    this.base = base;
  }

  /**
   * Create an isolated workspace directory for a scenario run.
   * Returns the absolute path to the workspace.
   */
  async create(scenarioId: string): Promise<string> {
    const timestamp = Date.now();
    const suffix = randomBytes(4).toString('hex');
    const dirName = `${scenarioId}-${timestamp}-${suffix}`;
    const workspacePath = join(this.base, dirName);

    await mkdir(workspacePath, { recursive: true });
    this.activeWorkspaces.add(workspacePath);
    this.registerCleanupHandlers();

    return workspacePath;
  }

  /**
   * Remove a workspace directory.
   */
  async cleanup(workspacePath: string): Promise<void> {
    if (existsSync(workspacePath)) {
      await rm(workspacePath, { recursive: true, force: true });
    }
    this.activeWorkspaces.delete(workspacePath);
  }

  /**
   * Remove all workspaces in the base directory.
   */
  async cleanupAll(): Promise<void> {
    if (!existsSync(this.base)) return;

    const entries = await readdir(this.base);
    await Promise.all(
      entries.map((entry) => rm(join(this.base, entry), { recursive: true, force: true }))
    );

    this.activeWorkspaces.clear();
  }

  /**
   * List all active (not yet cleaned up) workspace paths.
   */
  getActiveWorkspaces(): string[] {
    return [...this.activeWorkspaces];
  }

  private registerCleanupHandlers(): void {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    const handler = () => {
      // Synchronous cleanup on signal - best effort
      for (const ws of this.activeWorkspaces) {
        try {
          if (existsSync(ws)) {
            rmSync(ws, { recursive: true, force: true });
          }
        } catch {
          // Best effort - process is exiting
        }
      }
      process.exit(1);
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }
}
