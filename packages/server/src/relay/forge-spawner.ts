/**
 * Forge Agent Spawner
 *
 * Wraps relay client spawn/release functions into forge-core's SpawnTaskFn interface.
 * This bridges the relay transport layer with forge's execution layer.
 */

import { spawnAgent, releaseAgent, isConnected } from './client.js';
import type {
  SpawnTaskFn,
  SpawnTaskOptions,
  SpawnTaskResult,
  OnAgentExitedFn,
  SpawnGateAgentFn,
  SpawnGateOptions,
  SpawnGateResult,
} from '../../../forge-core/src/services/agent-spawner.js';
import type { TerminateAgentFn } from '../../../forge-core/src/services/recovery.js';

/**
 * Build forge MCP instructions for an agent.
 * Provides the HTTP endpoints agents must call to report status back to the orchestrator.
 */
function buildForgeMcpInstructions(taskId: string): string {
  const port = process.env.PORT || '3001';
  const baseUrl = `http://localhost:${port}/api/forge`;

  return `
## Status Reporting — CRITICAL

You MUST report your status by running curl commands in bash.
Do NOT use any tool/function calls for reporting — use ONLY the curl commands below.
Do NOT call \`report_agent_status\` or any other tool — that does not exist.

### When you finish (REQUIRED):

\`\`\`bash
curl -s -X POST ${baseUrl}/mcp/tools/call -H "Content-Type: application/json" -d '{"name":"report_complete","arguments":{"task_id":"${taskId}","notes":"Brief summary of what was done"}}'
\`\`\`

### During long tasks (optional):

\`\`\`bash
curl -s -X POST ${baseUrl}/mcp/tools/call -H "Content-Type: application/json" -d '{"name":"report_progress","arguments":{"task_id":"${taskId}","progress_pct":50,"status_message":"Halfway done"}}'
\`\`\`

### If you cannot proceed:

\`\`\`bash
curl -s -X POST ${baseUrl}/mcp/tools/call -H "Content-Type: application/json" -d '{"name":"report_blocked","arguments":{"task_id":"${taskId}","reason":"Why you are blocked"}}'
\`\`\`

**IMPORTANT:** You MUST run the \`report_complete\` curl command when you finish. The orchestrator is waiting for it.
`;
}

/**
 * Build execution prompt from step details.
 * Keeps prompt simple — advanced prompt engineering is a separate concern.
 */
function buildTaskPrompt(options: SpawnTaskOptions): string {
  let prompt = `You are executing a task from a Forge orchestration run.
`;

  // MCP reporting instructions go FIRST — this is the most critical thing for the agent to follow
  prompt += buildForgeMcpInstructions(options.taskId);

  prompt += `
## Task Details

**Task ID:** ${options.taskId}
**Run ID:** ${options.runId}
**Step Title:** ${options.stepTitle}
`;

  if (options.stepDescription) {
    prompt += `
**Description:**
${options.stepDescription}
`;
  }

  if (options.workspacePath) {
    prompt += `
**Workspace:** ${options.workspacePath}
You MUST work in this directory. Start by changing to it: \`cd ${options.workspacePath}\`
`;
  }

  if (options.targetPath) {
    prompt += `
**Target Directory:** ${options.targetPath}
All new files MUST be created under this directory relative to the workspace root.
Do NOT create new package directories — work within the existing structure.
`;
  }

  if (options.scope) {
    prompt += `
**Scope:** ${options.scope}
`;
  }

  if (options.ownerRole) {
    prompt += `
**Role:** ${options.ownerRole}
`;
  }

  if (options.acceptanceCriteria && options.acceptanceCriteria.length > 0) {
    prompt += `
## Acceptance Criteria

`;
    for (const criterion of options.acceptanceCriteria) {
      const type = criterion.type ? ` (${criterion.type})` : '';
      prompt += `- ${criterion.description}${type}\n`;
    }
  }

  if (options.specification && Object.keys(options.specification).length > 0) {
    prompt += `
## Specification

IMPORTANT: Follow these implementation details exactly. This tells you which files to create/modify, what patterns to use, and architectural decisions to follow.

\`\`\`json
${JSON.stringify(options.specification, null, 2)}
\`\`\`
`;
  }

  if (options.planContext && Object.keys(options.planContext).length > 0) {
    prompt += `
## Architecture Context

These are plan-level design decisions, type definitions, and patterns that apply to this task.

\`\`\`json
${JSON.stringify(options.planContext, null, 2)}
\`\`\`
`;
  }

  if (options.planUnderstanding && Object.keys(options.planUnderstanding).length > 0) {
    prompt += `
## Codebase Understanding

Observations about the existing codebase that are relevant to this task.

\`\`\`json
${JSON.stringify(options.planUnderstanding, null, 2)}
\`\`\`
`;
  }

  if (options.prepFindings && Object.keys(options.prepFindings).length > 0) {
    const prep = options.prepFindings as Record<string, unknown>;

    // Scope boundary — clear constraint for scope drift prevention
    const scopeBoundary = prep.scope_boundary as { owned_paths?: string[]; do_not_touch?: string[] } | undefined;
    if (scopeBoundary?.do_not_touch && scopeBoundary.do_not_touch.length > 0) {
      prompt += `
## Scope Boundary — IMPORTANT

You MUST NOT modify files outside your scope. Off-limits paths:
${scopeBoundary.do_not_touch.map((f: string) => `- ${f}`).join('\n')}
`;
    }

    // Task-specific guidance from PREP (already extracted per-task by orchestrator)
    const taskGuidance = prep.task_guidance;
    const existingPatterns = prep.existing_patterns;
    const warnings = prep.warnings as string[] | undefined;

    if (taskGuidance || existingPatterns) {
      prompt += `\n## Preparation Analysis\n\n`;
      if (existingPatterns) {
        prompt += `**Existing patterns to follow:**\n\`\`\`json\n${JSON.stringify(existingPatterns, null, 2)}\n\`\`\`\n\n`;
      }
      if (taskGuidance) {
        prompt += `**Task guidance:**\n\`\`\`json\n${JSON.stringify(taskGuidance, null, 2)}\n\`\`\`\n`;
      }
    }

    if (warnings && warnings.length > 0) {
      prompt += `\n**Warnings:** ${warnings.join('; ')}\n`;
    }
  }

  prompt += `
## Commit Convention — REQUIRED

When you have finished your implementation and verified it meets the acceptance criteria,
you MUST commit your changes BEFORE reporting completion:

\`\`\`bash
git add -A
git commit -m "[forge:${options.taskId}] Brief description of what was implemented"
\`\`\`

The commit message MUST start with \`[forge:${options.taskId}]\` — this marker lets the
orchestrator identify exactly which files you changed for per-task verification.

If your work spans multiple logical commits, each MUST include the \`[forge:${options.taskId}]\` marker.

Do NOT push — just commit locally. After committing, call \`report_complete\`.

## Instructions

1. Understand the task and acceptance criteria
2. Execute the required work
3. Verify acceptance criteria are met
4. Report completion using the forge MCP endpoint below

**Important:** You are part of an orchestrated workflow. Focus on your specific task and acceptance criteria. Do not attempt to modify the overall plan or execute other tasks.
`;

  prompt += `Begin by acknowledging the task and outlining your approach. When you are done: (1) git add and commit with the [forge:${options.taskId}] marker, then (2) call report_complete as shown at the top of this prompt. Both steps are REQUIRED.`;

  return prompt;
}

/**
 * Build quality gate agent prompt.
 * Wraps the analysis task with MCP instructions for reporting findings.
 */
function buildGateAgentPrompt(gateId: string, analysisPrompt: string): string {
  const port = process.env.PORT || '3001';
  const baseUrl = `http://localhost:${port}/api/forge`;

  return `You are a quality gate agent. Work fast — you have 60-90 seconds.

## Efficiency Rules

- Use Glob to find files by pattern, NOT by reading directories
- Use Grep to search for symbols/patterns across files
- Read file outlines first (small sections), not entire files
- Search for specific function/type names instead of scanning line by line
- Target: complete analysis in under 60 seconds

## Your Task

${analysisPrompt}

## Reporting Results — REQUIRED

When done, write findings to a temp file and curl it (avoids shell quoting issues):

\`\`\`bash
cat > /tmp/gate-${gateId.slice(0, 8)}.json << 'GATE_EOF'
{
  "name": "report_gate_result",
  "arguments": {
    "gate_id": "${gateId}",
    "findings": <YOUR_JSON_FINDINGS>
  }
}
GATE_EOF
curl -s -X POST ${baseUrl}/mcp/tools/call -H "Content-Type: application/json" -d @/tmp/gate-${gateId.slice(0, 8)}.json
\`\`\`

- gate_id: ${gateId}
- findings: JSON object matching the output schema in your task above
- Do NOT call report_complete (that's for task agents)
- ALWAYS write JSON to file first, then curl with -d @file (complex JSON breaks inline curl)
- The orchestrator is waiting — report as soon as you have findings`;
}

/**
 * Monitor a process by PID. Polls until the process exits, then fires the callback.
 * Uses kill(pid, 0) which sends no signal but checks if the process exists.
 */
function monitorPid(
  pid: number,
  onExited: (exitCode: number | null) => void,
  pollMs = 3000
): NodeJS.Timeout {
  const interval = setInterval(() => {
    try {
      process.kill(pid, 0); // Check if process exists (sends no signal)
    } catch {
      // Process is dead
      clearInterval(interval);
      // We can't get the real exit code from kill(pid, 0),
      // so we pass null — the orchestrator decides based on task state
      onExited(null);
    }
  }, pollMs);
  return interval;
}

/**
 * Spawn a task execution agent via relay daemon.
 * Maps SpawnTaskOptions → relay spawn options.
 * Optionally monitors the spawned PID and fires onExited when it dies.
 */
export const spawnForgeTask: SpawnTaskFn = async (
  options: SpawnTaskOptions,
  onExited?: OnAgentExitedFn
): Promise<SpawnTaskResult> => {
  const agentName = `Worker-${options.taskId.slice(0, 8)}`;
  const task = buildTaskPrompt(options);

  const result = await spawnAgent({
    name: agentName,
    cli: options.cli,
    task,
    cwd: options.workspacePath || process.cwd(),
  });

  if (!result.success) {
    throw new Error(`Failed to spawn agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  const agentId = result.name || agentName;

  // Monitor the agent process for exit if callback provided and PID available
  if (onExited && result.pid) {
    monitorPid(result.pid, (exitCode) => {
      console.log(`[forge-spawner] Agent ${agentId} (PID ${result.pid}) exited`);
      onExited({
        taskId: options.taskId,
        agentId,
        pid: result.pid!,
        exitCode,
      });
    });
  }

  return {
    agentId,
    pid: result.pid,
  };
};

/**
 * Terminate a forge task agent via relay daemon.
 * Maps agentId → relay release.
 */
export const terminateForgeAgent: TerminateAgentFn = async (agentId: string): Promise<void> => {
  const result = await releaseAgent(agentId);

  if (!result.success) {
    // Log but don't throw — agent might already be terminated
    console.error(`[forge-spawner] Failed to release agent ${agentId}: ${result.error || 'Unknown error'}`);
  }
};

/**
 * Spawn a quality gate analysis agent via relay daemon.
 * These are lighter-weight agents that perform analysis and report findings via MCP.
 */
export const spawnGateAgent: SpawnGateAgentFn = async (
  options: SpawnGateOptions,
  onExited?: (exitCode: number | null) => void
): Promise<SpawnGateResult> => {
  const agentName = `Gate-${options.gateId.slice(0, 8)}`;
  const task = buildGateAgentPrompt(options.gateId, options.prompt);

  const result = await spawnAgent({
    name: agentName,
    cli: options.cli || 'claude',
    task,
    cwd: options.cwd || process.cwd(),
  });

  if (!result.success) {
    throw new Error(`Failed to spawn gate agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  const agentId = result.name || agentName;

  console.log(`[forge-spawner] Spawned gate agent ${agentId} for gate ${options.gateId}`);

  // Monitor the agent process for exit if callback provided and PID available
  if (onExited && result.pid) {
    monitorPid(result.pid, (exitCode) => {
      console.log(`[forge-spawner] Gate agent ${agentId} (PID ${result.pid}) exited`);
      onExited(exitCode);
    });
  }

  return {
    agentId,
    pid: result.pid,
  };
};

/**
 * Check if the forge spawner is available (relay connected).
 */
export function isForgeSpawnerAvailable(): boolean {
  return isConnected();
}
