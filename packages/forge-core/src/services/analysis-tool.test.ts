import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock child_process BEFORE importing AnalysisTool
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { AnalysisTool } from './analysis-tool.js';
import { GateResultRegistry } from './gate-registry.js';
import type { SpawnGateAgentFn, SpawnGateOptions } from './agent-spawner.js';

const mockSpawn = vi.mocked(spawn);

interface MockProcessOptions {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  delay?: number;
  neverExit?: boolean;
  emitError?: { code?: string; message?: string };
}

function createMockProcess(opts: MockProcessOptions = {}) {
  const proc = new EventEmitter() as any;
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  if (opts.emitError) {
    setTimeout(() => {
      const error: any = new Error(opts.emitError!.message ?? 'Mock error');
      if (opts.emitError!.code) {
        error.code = opts.emitError!.code;
      }
      proc.emit('error', error);
    }, opts.delay ?? 1);
  } else if (!opts.neverExit) {
    setTimeout(() => {
      if (opts.stdout) proc.stdout.emit('data', Buffer.from(opts.stdout));
      if (opts.stderr) proc.stderr.emit('data', Buffer.from(opts.stderr));
      proc.emit('close', opts.exitCode ?? 0);
    }, opts.delay ?? 1);
  }

  return proc;
}

describe('AnalysisTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Model resolution', () => {
    it('should map haiku to correct model', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "test"}' })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test', { model: 'haiku' });

      expect(result.model).toBe('claude-haiku-4-5-20251001');
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'json'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      );
    });

    it('should map sonnet to correct model', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "test"}' })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test', { model: 'sonnet' });

      expect(result.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should map opus to correct model', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "test"}' })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test', { model: 'opus' });

      expect(result.model).toBe('claude-opus-4-6');
    });

    it('should fall back to sonnet for unknown model', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "test"}' })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test', { model: 'gpt4' });

      expect(result.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should default to sonnet when no model specified', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "test"}' })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.model).toBe('claude-sonnet-4-5-20250929');
    });
  });

  describe('Successful execution', () => {
    it('should return output, parsed result, duration, and model', async () => {
      const stdout = '{"result": "hello"}';
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test prompt', { model: 'haiku' });

      expect(result.output).toBe(stdout);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('claude-haiku-4-5-20251001');
    });

    it('should write prompt to stdin and close it', async () => {
      const mockProc = createMockProcess({ stdout: '{"result": "ok"}' });
      mockSpawn.mockReturnValue(mockProc);

      const tool = new AnalysisTool();
      await tool.run('my prompt');

      expect(mockProc.stdin.write).toHaveBeenCalledWith('my prompt');
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });
  });

  describe('Output parsing', () => {
    it('should parse claude wrapper format with nested JSON', async () => {
      const stdout = '{"result": "{\\"key\\": \\"value\\"}"}';
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toEqual({ key: 'value' });
    });

    it('should parse direct JSON object', async () => {
      const stdout = '{"key": "value"}';
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toEqual({ key: 'value' });
    });

    it('should return undefined for plain text in wrapper', async () => {
      const stdout = '{"result": "Hello world"}';
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toBeUndefined();
      expect(result.output).toBe(stdout);
    });

    it('should handle non-JSON output gracefully', async () => {
      const stdout = 'Plain text response';
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toBeUndefined();
      expect(result.output).toBe(stdout);
    });

    it('should extract JSON from markdown code blocks in wrapper', async () => {
      const innerJson = { passed: true, reason: 'All good' };
      const wrappedResult = `Here's my analysis:\n\n\`\`\`json\n${JSON.stringify(innerJson)}\n\`\`\``;
      const stdout = JSON.stringify({ result: wrappedResult });
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toEqual(innerJson);
    });

    it('should extract JSON from untagged code blocks in wrapper', async () => {
      const innerJson = { passed: false, reason: 'Tests fail' };
      const wrappedResult = `Analysis:\n\n\`\`\`\n${JSON.stringify(innerJson)}\n\`\`\``;
      const stdout = JSON.stringify({ result: wrappedResult });
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toEqual(innerJson);
    });

    it('should extract JSON from prose with embedded object', async () => {
      const innerJson = { scope_analysis: 'looks good', warnings: [] };
      const wrappedResult = `Here's the JSON output: ${JSON.stringify(innerJson)} Hope that helps!`;
      const stdout = JSON.stringify({ result: wrappedResult });
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toEqual(innerJson);
    });

    it('should handle raw markdown output (no wrapper)', async () => {
      const innerJson = { passed: true, issues: [] };
      const stdout = `Sure! Here's the result:\n\`\`\`json\n${JSON.stringify(innerJson)}\n\`\`\``;
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.parsed).toEqual(innerJson);
    });
  });

  describe('Usage extraction', () => {
    it('should extract usage from claude CLI JSON envelope', async () => {
      const stdout = JSON.stringify({
        result: '{"passed": true}',
        usage: { input_tokens: 1500, output_tokens: 400, cache_read_input_tokens: 3000 },
        total_cost_usd: 0.0082,
      });
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.usage).toEqual({
        input_tokens: 1500,
        output_tokens: 400,
        cache_read_input_tokens: 3000,
        total_cost_usd: 0.0082,
      });
      expect(result.parsed).toEqual({ passed: true });
    });

    it('should return undefined usage for non-envelope output', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: 'Plain text response' })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.usage).toBeUndefined();
    });

    it('should return undefined usage when envelope has no usage field', async () => {
      const stdout = JSON.stringify({ result: 'hello' });
      mockSpawn.mockReturnValue(createMockProcess({ stdout }));

      const tool = new AnalysisTool();
      const result = await tool.run('test');

      expect(result.usage).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should reject with exit code and stderr on non-zero exit', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          exitCode: 1,
          stderr: 'Something went wrong',
        })
      );

      const tool = new AnalysisTool();

      await expect(tool.run('test', { retries: 0 })).rejects.toThrow(
        /Claude CLI exited with code 1.*stderr: Something went wrong/
      );
    });

    it('should reject with exit code when no stderr', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ exitCode: 2 })
      );

      const tool = new AnalysisTool();

      await expect(tool.run('test', { retries: 0 })).rejects.toThrow(
        /Claude CLI exited with code 2.*no stderr/
      );
    });

    it('should handle ENOENT error (CLI not found)', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          emitError: { code: 'ENOENT', message: 'spawn claude ENOENT' },
        })
      );

      const tool = new AnalysisTool();

      await expect(tool.run('test', { retries: 0 })).rejects.toThrow('Claude CLI not found: claude');
    });

    it('should handle other spawn errors', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          emitError: { message: 'Unknown spawn error' },
        })
      );

      const tool = new AnalysisTool();

      await expect(tool.run('test', { retries: 0 })).rejects.toThrow('Unknown spawn error');
    });
  });

  describe('Timeout handling', () => {
    it('should timeout and kill process if it never exits', async () => {
      const mockProc = createMockProcess({ neverExit: true });
      mockSpawn.mockReturnValue(mockProc);

      const tool = new AnalysisTool();

      await expect(
        tool.run('test', { timeoutMs: 50, retries: 0 })
      ).rejects.toThrow('Analysis timed out after 50ms (model: sonnet)');

      expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should use default timeout when not specified', async () => {
      const mockProc = createMockProcess({ neverExit: true });
      mockSpawn.mockReturnValue(mockProc);

      const tool = new AnalysisTool({ defaultTimeoutMs: 100 });

      const promise = tool.run('test', { retries: 0 });

      // Let it timeout
      await expect(promise).rejects.toThrow('Analysis timed out after 100ms');
    });

    it('should not timeout if process completes in time', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "ok"}', delay: 10 })
      );

      const tool = new AnalysisTool();
      const result = await tool.run('test', { timeoutMs: 100 });

      expect(result.output).toContain('ok');
    });
  });

  describe('Options handling', () => {
    it('should pass cwd option to spawn', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "ok"}' })
      );

      const tool = new AnalysisTool();
      await tool.run('test', { cwd: '/custom/path' });

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('should not pass cwd if not provided', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "ok"}' })
      );

      const tool = new AnalysisTool();
      await tool.run('test');

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );

      const spawnOptions = mockSpawn.mock.calls[0][2];
      expect(spawnOptions).not.toHaveProperty('cwd');
    });

    it('should use custom CLI path from config', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "ok"}' })
      );

      const tool = new AnalysisTool({ cli: '/usr/local/bin/claude' });
      await tool.run('test');

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/local/bin/claude',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('Retry mechanism', () => {
    it('should retry on failure and succeed on second attempt', async () => {
      vi.useFakeTimers();

      let attemptCount = 0;
      mockSpawn.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          return createMockProcess({ exitCode: 1, stderr: 'First attempt failed' });
        } else {
          // Second attempt succeeds
          return createMockProcess({ stdout: '{"result": "success"}' });
        }
      });

      const tool = new AnalysisTool();
      const promise = tool.run('test prompt');

      // Advance through first attempt failure
      await vi.advanceTimersByTimeAsync(10);

      // Advance through 1s retry delay
      await vi.advanceTimersByTimeAsync(1000);

      // Advance through second attempt success
      await vi.advanceTimersByTimeAsync(10);

      const result = await promise;

      expect(attemptCount).toBe(2);
      expect(result.output).toContain('success');
      expect(mockSpawn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should exhaust retries and reject with enhanced error message', async () => {
      // All attempts fail - need to create new mock process for each spawn call
      mockSpawn.mockImplementation(() =>
        createMockProcess({ exitCode: 1, stderr: 'Persistent error' })
      );

      const tool = new AnalysisTool();

      try {
        await tool.run('test prompt', { cwd: '/test/path' });
        expect.fail('Should have thrown an error');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('Claude CLI exited with code 1');
        expect(message).toContain('stderr: Persistent error');
        expect(message).toContain('model: claude-sonnet-4-5-20250929');
        expect(message).toMatch(/duration: \d+ms/);
        expect(message).toContain('prompt: 11 chars');
        expect(message).toContain('cwd: /test/path');
      }

      expect(mockSpawn).toHaveBeenCalledTimes(3);
    }, 15000); // Allow time for 2 retries with 1s + 2s delays

    it('should respect custom retry count of 0 (no retries)', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ exitCode: 1, stderr: 'Failed' })
      );

      const tool = new AnalysisTool();

      await expect(tool.run('test', { retries: 0 })).rejects.toThrow(/Claude CLI exited with code 1/);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should include enhanced diagnostics in error messages', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ exitCode: 1, stderr: 'Model overloaded' })
      );

      const tool = new AnalysisTool();

      try {
        await tool.run('A long prompt for testing', {
          model: 'opus',
          cwd: '/custom/dir',
          retries: 0
        });
        expect.fail('Should have thrown an error');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('stderr: Model overloaded');
        expect(message).toContain('model: claude-opus-4-6');
        expect(message).toContain('prompt: 25 chars'); // "A long prompt for testing" is 25 chars
        expect(message).toContain('cwd: /custom/dir');
      }
    });
  });

  describe('Concurrency limiting', () => {
    it('should enforce concurrency limit of 1', async () => {
      vi.useFakeTimers();

      let activeProcesses = 0;
      let maxConcurrent = 0;

      mockSpawn.mockImplementation(() => {
        activeProcesses++;
        maxConcurrent = Math.max(maxConcurrent, activeProcesses);

        const proc = new EventEmitter() as any;
        proc.stdin = { write: vi.fn(), end: vi.fn() };
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.kill = vi.fn();

        // Complete after a delay
        setTimeout(() => {
          proc.stdout.emit('data', Buffer.from('{"result": "ok"}'));
          proc.emit('close', 0);
          activeProcesses--;
        }, 50);

        return proc;
      });

      const tool = new AnalysisTool({ concurrencyLimit: 1 });

      // Start 2 concurrent runs
      const promise1 = tool.run('test 1');
      const promise2 = tool.run('test 2');

      // Advance time to let first process start and complete
      await vi.advanceTimersByTimeAsync(60);

      // Advance time to let second process start and complete
      await vi.advanceTimersByTimeAsync(60);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.output).toContain('ok');
      expect(result2.output).toContain('ok');
      expect(maxConcurrent).toBe(1); // Only 1 process active at a time
      expect(mockSpawn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should allow concurrent execution up to limit', async () => {
      vi.useFakeTimers();

      let activeProcesses = 0;
      let maxConcurrent = 0;

      mockSpawn.mockImplementation(() => {
        activeProcesses++;
        maxConcurrent = Math.max(maxConcurrent, activeProcesses);

        const proc = new EventEmitter() as any;
        proc.stdin = { write: vi.fn(), end: vi.fn() };
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.kill = vi.fn();

        setTimeout(() => {
          proc.stdout.emit('data', Buffer.from('{"result": "ok"}'));
          proc.emit('close', 0);
          activeProcesses--;
        }, 50);

        return proc;
      });

      const tool = new AnalysisTool({ concurrencyLimit: 2 });

      // Start 3 concurrent runs
      const promise1 = tool.run('test 1');
      const promise2 = tool.run('test 2');
      const promise3 = tool.run('test 3');

      // Advance time to let first 2 processes start and complete
      await vi.advanceTimersByTimeAsync(60);

      // Advance time to let third process start and complete
      await vi.advanceTimersByTimeAsync(60);

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toHaveLength(3);
      expect(maxConcurrent).toBe(2); // Max 2 processes active at a time
      expect(mockSpawn).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should queue and process waiting tasks when slots free up', async () => {
      vi.useFakeTimers();

      const completionOrder: number[] = [];

      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdin = { write: vi.fn(), end: vi.fn() };
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.kill = vi.fn();

        const taskId = mockSpawn.mock.calls.length;
        setTimeout(() => {
          completionOrder.push(taskId);
          proc.stdout.emit('data', Buffer.from(`{"result": "task${taskId}"}`));
          proc.emit('close', 0);
        }, 30);

        return proc;
      });

      const tool = new AnalysisTool({ concurrencyLimit: 1 });

      // Start 3 tasks
      const promises = [
        tool.run('task 1'),
        tool.run('task 2'),
        tool.run('task 3'),
      ];

      // Advance through all 3 tasks sequentially
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(40);
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(completionOrder).toEqual([1, 2, 3]); // Sequential execution
      expect(mockSpawn).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('Agent-based execution', () => {
    it('should dispatch to agent path when gateRegistry and spawnGateAgent are provided', async () => {
      const gateRegistry = new GateResultRegistry();
      const mockSpawnGate: SpawnGateAgentFn = vi.fn(async (options: SpawnGateOptions) => {
        // Simulate agent completing and resolving gate
        setTimeout(() => {
          gateRegistry.resolveGate(options.gateId, { passed: true, summary: 'All good' });
        }, 10);
        return { agentId: `Gate-${options.gateId.slice(0, 8)}`, pid: 12345 };
      });

      const tool = new AnalysisTool({
        gateRegistry,
        spawnGateAgent: mockSpawnGate,
      });

      const result = await tool.run('Analyze the code', { model: 'haiku' });

      expect(mockSpawnGate).toHaveBeenCalledTimes(1);
      expect(mockSpawnGate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Analyze the code',
          model: 'haiku',
        }),
        expect.any(Function),
      );
      expect(result.parsed).toEqual({ passed: true, summary: 'All good' });
      expect(result.model).toBe('claude-haiku-4-5-20251001');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // Should NOT have spawned a subprocess
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should reject when gate times out', async () => {
      const gateRegistry = new GateResultRegistry();
      const mockSpawnGate: SpawnGateAgentFn = vi.fn(async (options: SpawnGateOptions) => {
        // Agent spawns but never reports back — gate will time out
        return { agentId: `Gate-${options.gateId.slice(0, 8)}`, pid: 12345 };
      });

      const tool = new AnalysisTool({
        gateRegistry,
        spawnGateAgent: mockSpawnGate,
      });

      await expect(
        tool.run('test', { timeoutMs: 50, retries: 0 })
      ).rejects.toThrow(/Quality gate timed out/);

      expect(mockSpawnGate).toHaveBeenCalledTimes(1);
    });

    it('should reject when agent exits before reporting', async () => {
      const gateRegistry = new GateResultRegistry();
      const mockSpawnGate: SpawnGateAgentFn = vi.fn(async (options: SpawnGateOptions, onExited?) => {
        // Simulate agent dying immediately
        setTimeout(() => {
          if (onExited) onExited(1);
        }, 10);
        return { agentId: `Gate-${options.gateId.slice(0, 8)}`, pid: 12345 };
      });

      const tool = new AnalysisTool({
        gateRegistry,
        spawnGateAgent: mockSpawnGate,
      });

      await expect(
        tool.run('test', { retries: 0 })
      ).rejects.toThrow(/Gate agent exited/);
    });

    it('should fall back to subprocess when gateRegistry is not provided', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "subprocess ok"}' })
      );

      // Only spawnGateAgent provided, no gateRegistry → subprocess path
      const tool = new AnalysisTool({
        spawnGateAgent: vi.fn(),
      });

      const result = await tool.run('test');

      expect(result.output).toContain('subprocess ok');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should fall back to subprocess when spawnGateAgent is not provided', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "subprocess ok"}' })
      );

      // Only gateRegistry provided, no spawnGateAgent → subprocess path
      const tool = new AnalysisTool({
        gateRegistry: new GateResultRegistry(),
      });

      const result = await tool.run('test');

      expect(result.output).toContain('subprocess ok');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should retry agent path failures', async () => {
      vi.useFakeTimers();

      const gateRegistry = new GateResultRegistry();
      let callCount = 0;
      const mockSpawnGate: SpawnGateAgentFn = vi.fn(async (options: SpawnGateOptions) => {
        callCount++;
        if (callCount === 1) {
          // First attempt: agent dies immediately
          setTimeout(() => {
            if (gateRegistry.hasPendingGate(options.gateId)) {
              gateRegistry.rejectGate(options.gateId, 'Agent crashed');
            }
          }, 5);
        } else {
          // Second attempt: agent succeeds
          setTimeout(() => {
            gateRegistry.resolveGate(options.gateId, { passed: true });
          }, 5);
        }
        return { agentId: `Gate-${options.gateId.slice(0, 8)}` };
      });

      const tool = new AnalysisTool({
        gateRegistry,
        spawnGateAgent: mockSpawnGate,
      });

      const promise = tool.run('test', { retries: 1 });

      // Let first attempt fail
      await vi.advanceTimersByTimeAsync(10);
      // Advance through retry delay (1s)
      await vi.advanceTimersByTimeAsync(1000);
      // Let second attempt succeed
      await vi.advanceTimersByTimeAsync(10);

      const result = await promise;
      expect(callCount).toBe(2);
      expect(result.parsed).toEqual({ passed: true });

      vi.useRealTimers();
    });
  });

  describe('env variable passing', () => {
    it('should strip CLAUDECODE/CLAUDE_CODE_*/CLAUDE_AGENT_*/npm_* but keep CONDUCTOR_*', async () => {
      // Temporarily set env vars
      process.env.CLAUDECODE = '1';
      process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';
      process.env.CLAUDE_AGENT_SDK_VERSION = '0.2.38';
      process.env.CONDUCTOR_PORT = '55000';
      process.env.npm_config_cache = '/tmp';

      mockSpawn.mockReturnValue(
        createMockProcess({ stdout: '{"result": "ok"}' })
      );

      const tool = new AnalysisTool();
      await tool.run('test');

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      // SDK/session vars stripped
      expect(spawnEnv.CLAUDECODE).toBeUndefined();
      expect(spawnEnv.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
      expect(spawnEnv.CLAUDE_AGENT_SDK_VERSION).toBeUndefined();
      expect(spawnEnv.npm_config_cache).toBeUndefined();
      // Conductor vars preserved (needed for billing routing)
      expect(spawnEnv.CONDUCTOR_PORT).toBe('55000');
      // Standard vars preserved
      expect(spawnEnv.PATH).toBeDefined();

      // Cleanup
      delete process.env.CLAUDECODE;
      delete process.env.CLAUDE_CODE_ENTRYPOINT;
      delete process.env.CLAUDE_AGENT_SDK_VERSION;
      delete process.env.CONDUCTOR_PORT;
      delete process.env.npm_config_cache;
    });
  });
});
