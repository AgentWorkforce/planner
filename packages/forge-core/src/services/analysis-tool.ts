import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import type { GateResultRegistry } from './gate-registry.js';
import type { SpawnGateAgentFn } from './agent-spawner.js';

export interface AnalysisUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  total_cost_usd: number;
}

export interface AnalysisResult {
  output: string;
  parsed?: Record<string, unknown>;
  durationMs: number;
  model: string;
  usage?: AnalysisUsage;
}

export interface AnalysisToolConfig {
  cli?: string;
  defaultTimeoutMs?: number;
  concurrencyLimit?: number;
  /** Gate registry for agent-based quality gate coordination */
  gateRegistry?: GateResultRegistry;
  /** Spawn function for gate agents (injected from server) */
  spawnGateAgent?: SpawnGateAgentFn;
  /** Function to terminate a spawned agent (called on timeout) */
  terminateAgent?: (agentId: string) => Promise<void>;
}

const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-6',
};

export class AnalysisTool {
  private cli: string;
  private defaultTimeoutMs: number;
  private concurrencyLimit: number;
  private activeCount = 0;
  private waitQueue: Array<() => void> = [];
  private gateRegistry?: GateResultRegistry;
  private spawnGateAgent?: SpawnGateAgentFn;
  private terminateAgent?: (agentId: string) => Promise<void>;

  constructor(config: AnalysisToolConfig = {}) {
    this.cli = config.cli ?? 'claude';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 120000;
    this.concurrencyLimit = config.concurrencyLimit ?? 2;
    this.gateRegistry = config.gateRegistry;
    this.spawnGateAgent = config.spawnGateAgent;
    this.terminateAgent = config.terminateAgent;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.concurrencyLimit) {
      this.activeCount++;
      return;
    }
    return new Promise<void>(resolve => {
      this.waitQueue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeCount--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  async run(
    prompt: string,
    options?: {
      model?: string;
      cwd?: string;
      timeoutMs?: number;
      retries?: number;
    }
  ): Promise<AnalysisResult> {
    await this.acquireSlot();
    try {
      const maxRetries = options?.retries ?? 2;
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await this.runOnce(prompt, options);
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < maxRetries) {
            const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s
            console.warn(
              `[AnalysisTool] Attempt ${attempt + 1}/${maxRetries + 1} failed (${lastError.message}), retrying in ${delayMs}ms...`
            );
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
      }

      throw lastError!;
    } finally {
      this.releaseSlot();
    }
  }

  private async runOnce(
    prompt: string,
    options?: {
      model?: string;
      cwd?: string;
      timeoutMs?: number;
    }
  ): Promise<AnalysisResult> {
    // Dispatch: use spawned agent when gate infrastructure is available, else subprocess fallback
    if (this.gateRegistry && this.spawnGateAgent) {
      return this.runViaAgent(prompt, options);
    }
    return this.runViaSubprocess(prompt, options);
  }

  /**
   * Spawns a gate agent via relay to perform the analysis.
   * Uses file-based result passing: agent writes findings to /tmp/gate-{id}.json,
   * and the onExited callback reads the file to resolve the gate Promise.
   * This avoids the fragile curl-based MCP reporting that caused 100% timeouts.
   */
  private async runViaAgent(
    prompt: string,
    options?: {
      model?: string;
      cwd?: string;
      timeoutMs?: number;
    }
  ): Promise<AnalysisResult> {
    const modelKey = options?.model ?? 'sonnet';
    const modelName = MODEL_MAP[modelKey] ?? MODEL_MAP['sonnet'] ?? 'claude-sonnet-4-5-20250929';
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const gateId = randomUUID();
    const resultFilePath = `/tmp/gate-${gateId}.json`;

    // Track spawned agent so we can terminate it on timeout
    let spawnedAgentId: string | undefined;

    // Create the gate Promise BEFORE spawning the agent.
    // onTimeout: terminate the gate agent to stop wasting Conductor credits.
    const gatePromise = this.gateRegistry!.createGate(gateId, timeoutMs, () => {
      if (spawnedAgentId) {
        console.warn(`[AnalysisTool] Gate ${gateId} timed out — terminating agent ${spawnedAgentId}`);
        this.terminateAgent?.(spawnedAgentId).catch((err) => {
          console.error(`[AnalysisTool] Failed to terminate agent ${spawnedAgentId}:`, err);
        });
      }
    });

    try {
      const spawnResult = await this.spawnGateAgent!({
        gateId,
        prompt,
        cwd: options?.cwd,
        cli: this.cli,
        model: modelKey,
      }, (exitCode) => {
        // Agent exited — check for result file before rejecting
        if (!this.gateRegistry!.hasPendingGate(gateId)) return;

        try {
          if (existsSync(resultFilePath)) {
            const raw = readFileSync(resultFilePath, 'utf-8');
            const findings = JSON.parse(raw);
            console.log(`[AnalysisTool] Gate ${gateId} — read findings from ${resultFilePath}`);
            this.gateRegistry!.resolveGate(gateId, findings);
            // Clean up temp file
            try { unlinkSync(resultFilePath); } catch { /* best effort */ }
          } else {
            this.gateRegistry!.rejectGate(
              gateId,
              `Gate agent exited (code: ${exitCode}) without writing result file`
            );
          }
        } catch (err) {
          this.gateRegistry!.rejectGate(
            gateId,
            `Gate agent exited but result file was invalid: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      });

      spawnedAgentId = spawnResult.agentId;
      console.log(`[AnalysisTool] Spawned gate agent ${spawnResult.agentId} for gate ${gateId}`);

      // Await the gate result (resolved when agent exits and result file is read)
      const gateResult = await gatePromise;

      return {
        output: JSON.stringify(gateResult.findings),
        parsed: gateResult.findings,
        durationMs: gateResult.durationMs,
        model: modelName,
      };
    } catch (err) {
      // Ensure gate is cleaned up on any error
      if (this.gateRegistry!.hasPendingGate(gateId)) {
        this.gateRegistry!.rejectGate(gateId, 'Analysis cancelled');
      }
      throw err;
    } finally {
      // Always terminate the gate agent after result (or error/timeout)
      if (spawnedAgentId) {
        this.terminateAgent?.(spawnedAgentId).catch((err) => {
          console.warn(`[AnalysisTool] Failed to terminate gate agent ${spawnedAgentId}:`, err);
        });
      }
      // Clean up result file (in case timeout killed agent before onExited ran)
      try { if (existsSync(resultFilePath)) unlinkSync(resultFilePath); } catch { /* best effort */ }
    }
  }

  /**
   * Fallback: runs analysis via `claude -p` subprocess.
   * Used when gate infrastructure is not available (disconnected/test mode).
   */
  private async runViaSubprocess(
    prompt: string,
    options?: {
      model?: string;
      cwd?: string;
      timeoutMs?: number;
    }
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const modelKey = options?.model ?? 'sonnet';
    const modelName = MODEL_MAP[modelKey] ?? MODEL_MAP['sonnet'] ?? 'claude-sonnet-4-5-20250929';
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;

    const args: string[] = ['-p', '--model', modelName, '--output-format', 'json'];

    // Strip inherited env vars that confuse the claude CLI subprocess.
    // CLAUDECODE / CLAUDE_CODE_* / CLAUDE_AGENT_* make the CLI think it's inside an SDK session.
    // npm_* vars are irrelevant noise.
    // Keep CONDUCTOR_* vars — they route the CLI through Conductor billing.
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE') || key.startsWith('CLAUDE_AGENT')) continue;
      if (key.startsWith('npm_')) continue;
      cleanEnv[key] = value;
    }

    return new Promise<AnalysisResult>((resolve, reject) => {
      const proc: ChildProcess = spawn(this.cli, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cleanEnv,
        ...(options?.cwd ? { cwd: options.cwd } : {}),
      });

      let stdout = '';
      let stderr = '';
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        fn();
      };

      proc.on('error', (err: Error) => {
        settle(() => {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new Error(`Claude CLI not found: ${this.cli}`));
          } else {
            reject(err);
          }
        });
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code: number | null) => {
        settle(() => {
          const durationMs = Date.now() - startTime;

          if (code !== 0) {
            const errorParts = [
              `Claude CLI exited with code ${code}`,
              stderr ? `stderr: ${stderr.slice(0, 500)}` : 'no stderr',
              stdout ? `stdout: ${stdout.slice(0, 500)}` : 'no stdout',
              `model: ${modelName}`,
              `duration: ${durationMs}ms`,
              `prompt: ${prompt.length} chars`,
              options?.cwd ? `cwd: ${options.cwd}` : 'no cwd',
            ];
            reject(new Error(errorParts.join(' | ')));
            return;
          }

          const trimmed = stdout.trim();
          const usage = this.extractUsage(trimmed);
          const parsed = this.tryParseOutput(trimmed);

          resolve({
            output: stdout,
            parsed,
            durationMs,
            model: modelName,
            usage,
          });
        });
      });

      timeoutHandle = setTimeout(() => {
        settle(() => {
          proc.kill('SIGKILL');
          reject(
            new Error(`Analysis timed out after ${timeoutMs}ms (model: ${modelKey})`)
          );
        });
      }, timeoutMs);

      proc.stdin?.write(prompt);
      proc.stdin?.end();
    });
  }

  /**
   * Extracts usage metadata from the claude CLI JSON envelope.
   * The envelope contains { usage: { input_tokens, output_tokens, ... }, total_cost_usd, result: "..." }
   */
  private extractUsage(output: string): AnalysisUsage | undefined {
    try {
      const envelope = JSON.parse(output);
      if (envelope && typeof envelope === 'object' && 'usage' in envelope) {
        const u = envelope.usage;
        return {
          input_tokens: u?.input_tokens ?? 0,
          output_tokens: u?.output_tokens ?? 0,
          cache_read_input_tokens: u?.cache_read_input_tokens,
          total_cost_usd: envelope.total_cost_usd ?? 0,
        };
      }
    } catch {
      // Not a JSON envelope
    }
    return undefined;
  }

  private tryParseOutput(output: string): Record<string, unknown> | undefined {
    try {
      const jsonOutput = JSON.parse(output);
      if (jsonOutput && typeof jsonOutput === 'object') {
        // claude --output-format json wraps response in { result: "..." }
        const content = 'result' in jsonOutput ? jsonOutput.result : jsonOutput;
        if (typeof content === 'string') {
          // The LLM's text output may itself be JSON
          const parsed = this.tryParseJsonString(content);
          if (parsed) return parsed;
        } else if (typeof content === 'object') {
          return content as Record<string, unknown>;
        }
      }
    } catch {
      // Not JSON wrapper — try direct parse
      const parsed = this.tryParseJsonString(output);
      if (parsed) return parsed;
    }
    return undefined;
  }

  /**
   * Attempts to parse a string as JSON. If direct parse fails,
   * tries to extract JSON from markdown code blocks (```json ... ```).
   */
  private tryParseJsonString(str: string): Record<string, unknown> | undefined {
    // Try direct parse first
    try {
      const direct = JSON.parse(str);
      if (direct && typeof direct === 'object') return direct;
    } catch {
      // Fall through to markdown extraction
    }

    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1]) {
      try {
        const extracted = JSON.parse(codeBlockMatch[1].trim());
        if (extracted && typeof extracted === 'object') return extracted;
      } catch {
        // Not valid JSON in code block
      }
    }

    // Try to find the first { ... } or [ ... ] in the string
    const braceStart = str.indexOf('{');
    const braceEnd = str.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        const extracted = JSON.parse(str.slice(braceStart, braceEnd + 1));
        if (extracted && typeof extracted === 'object') return extracted;
      } catch {
        // Not valid JSON substring
      }
    }

    return undefined;
  }
}
