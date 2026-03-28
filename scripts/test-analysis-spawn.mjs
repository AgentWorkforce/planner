import { spawn } from 'node:child_process';

const WORKTREE = '/Users/flysikring/conductor/workspaces/plannr/auckland/packages/server/.forge-worktrees/forge-build-83a7c6ee-015';
const prompt = 'Respond with only: {"passed": true}';

const args = ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'json'];

console.log(`Spawning: claude ${args.join(' ')}`);
console.log(`CWD: ${WORKTREE}`);
console.log(`Prompt: ${prompt.length} chars`);

const proc = spawn('claude', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
  cwd: WORKTREE,
});

let stdout = '';
let stderr = '';

proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

proc.on('error', (err) => {
  console.error('Spawn error:', err);
});

proc.on('close', (code) => {
  console.log(`Exit code: ${code}`);
  console.log(`Stdout (${stdout.length} chars): ${stdout.slice(0, 500)}`);
  console.log(`Stderr (${stderr.length} chars): ${stderr.slice(0, 500)}`);
});

proc.stdin.write(prompt);
proc.stdin.end();
