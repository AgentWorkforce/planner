import { spawn } from 'node:child_process';
import type { ScriptVerification } from './schema.js';
import type { VerificationResult } from './schema.js';

export class ScriptVerifier {
  async verify(config: ScriptVerification, workspacePath: string): Promise<VerificationResult> {
    const start = Date.now();
    const allOutput: string[] = [];

    for (const command of config.commands) {
      const result = await this.runCommand(command, workspacePath, config.timeout_seconds);
      allOutput.push(result.stdout);

      if (result.exitCode !== undefined && config.expect_exit_code !== undefined) {
        if (result.exitCode !== config.expect_exit_code) {
          return {
            passed: false,
            details: `Command '${command}' exited with code ${result.exitCode}, expected ${config.expect_exit_code}.\nOutput: ${result.stdout}\nStderr: ${result.stderr}`,
            duration_ms: Date.now() - start,
          };
        }
      }

      if (result.timedOut) {
        return {
          passed: false,
          details: `Command '${command}' timed out after ${config.timeout_seconds}s`,
          duration_ms: Date.now() - start,
        };
      }
    }

    const combinedOutput = allOutput.join('\n');

    if (config.expect_output) {
      const pattern = new RegExp(config.expect_output, 'i');
      if (!pattern.test(combinedOutput)) {
        return {
          passed: false,
          details: `Output did not match expected pattern '${config.expect_output}'.\nActual output: ${combinedOutput.slice(0, 500)}`,
          duration_ms: Date.now() - start,
        };
      }
    }

    return {
      passed: true,
      details: `All ${config.commands.length} commands passed.`,
      duration_ms: Date.now() - start,
    };
  }

  private runCommand(
    command: string,
    cwd: string,
    timeoutSeconds: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number | undefined; timedOut: boolean }> {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

      const child = spawn('sh', ['-c', command], {
        cwd,
        signal: controller.signal,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode: code ?? undefined, timedOut: false });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          resolve({ stdout, stderr, exitCode: undefined, timedOut: true });
        } else {
          resolve({ stdout, stderr: stderr + err.message, exitCode: 1, timedOut: false });
        }
      });
    });
  }
}
