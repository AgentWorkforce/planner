import { spawn, type ChildProcess } from 'node:child_process';
import { MODEL_ID_MAP } from '../config/forge-config.js';

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
}

// Re-alias for local readability; canonical map lives in forge-config
const MODEL_MAP = MODEL_ID_MAP;

export class AnalysisTool {
  private cli: string;
  private defaultTimeoutMs: number;
  private concurrencyLimit: number;
  private activeCount = 0;
  private waitQueue: Array<() => void> = [];

  constructor(config: AnalysisToolConfig = {}) {
    this.cli = config.cli ?? 'claude';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 120000;
    this.concurrencyLimit = config.concurrencyLimit ?? 2;
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
    return this.runViaSubprocess(prompt, options);
  }

  /**
   * Runs analysis via `claude -p` subprocess.
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
