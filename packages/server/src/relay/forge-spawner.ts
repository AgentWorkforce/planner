/**
 * Forge Agent Spawner
 *
 * Wraps relay client spawn/release functions into forge-core's SpawnTaskFn interface.
 * This bridges the relay transport layer with forge's execution layer.
 */

import { spawnAgent, releaseAgent, isConnected, getClient } from './client.js';
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
 * Context section for priority-based pruning
 */
interface ContextSection {
  key: string;
  data: Record<string, unknown>;
  priority: number; // lower = more important, never dropped
  label: string;
  sizeChars: number;
}

/**
 * Build context sections with priority-based size management.
 * Ensures specification is always included fully, then prunes lower-priority
 * sections (planUnderstanding first, then planContext) to stay within budget.
 */
function buildContextSections(options: SpawnTaskOptions): {
  sections: string;
  log: string;
} {
  const maxChars = parseInt(process.env.FORGE_MAX_PROMPT_CONTEXT_CHARS || '12000', 10);
  const compactThreshold = 2000; // Switch to compact JSON above this size

  // Collect all sections with priorities
  const sections: ContextSection[] = [];

  // Priority 0: specification (NEVER dropped)
  if (options.specification && Object.keys(options.specification).length > 0) {
    const prettyJson = JSON.stringify(options.specification, null, 2);
    sections.push({
      key: 'specification',
      data: options.specification,
      priority: 0,
      label: 'Specification',
      sizeChars: prettyJson.length,
    });
  }

  // Priority 2: planContext (dropped second, after filtering by scope)
  if (options.planContext && Object.keys(options.planContext).length > 0) {
    const prettyJson = JSON.stringify(options.planContext, null, 2);
    sections.push({
      key: 'planContext',
      data: options.planContext,
      priority: 2,
      label: 'Architecture Context',
      sizeChars: prettyJson.length,
    });
  }

  // Priority 3: planUnderstanding (dropped first, least critical)
  if (options.planUnderstanding && Object.keys(options.planUnderstanding).length > 0) {
    const prettyJson = JSON.stringify(options.planUnderstanding, null, 2);
    sections.push({
      key: 'planUnderstanding',
      data: options.planUnderstanding,
      priority: 3,
      label: 'Codebase Understanding',
      sizeChars: prettyJson.length,
    });
  }

  // Calculate total size
  let totalSize = sections.reduce((sum, s) => sum + s.sizeChars, 0);
  const reductions: string[] = [];

  // If over budget, apply reductions in priority order
  if (totalSize > maxChars) {
    // Sort by priority (higher priority value = less important)
    const sortedSections = [...sections].sort((a, b) => b.priority - a.priority);

    for (const section of sortedSections) {
      if (totalSize <= maxChars || section.priority === 0) {
        break; // Within budget or hit specification (never drop)
      }

      // Try filtering planContext by scope first
      if (section.key === 'planContext' && options.scope) {
        const scopeKeys = Object.keys(section.data).filter(
          (key) =>
            key.toLowerCase().includes(options.scope!.toLowerCase()) ||
            key === 'shared' ||
            key === 'common'
        );

        if (scopeKeys.length > 0 && scopeKeys.length < Object.keys(section.data).length) {
          const filtered: Record<string, unknown> = {};
          for (const key of scopeKeys) {
            filtered[key] = section.data[key];
          }
          const oldSize = section.sizeChars;
          const newJson = JSON.stringify(filtered, null, 2);
          section.data = filtered;
          section.sizeChars = newJson.length;
          totalSize = totalSize - oldSize + section.sizeChars;
          reductions.push(
            `filtered planContext by scope (${oldSize} → ${section.sizeChars} chars)`
          );
          continue;
        }
      }

      // Drop the section entirely
      reductions.push(`dropped ${section.key} (${section.sizeChars} chars)`);
      totalSize -= section.sizeChars;
      section.sizeChars = 0; // Mark as dropped
    }
  }

  // Compact large sections (switch to non-pretty JSON)
  const compacted: string[] = [];
  for (const section of sections) {
    if (section.sizeChars > 0 && section.sizeChars > compactThreshold) {
      const compactJson = JSON.stringify(section.data);
      const savedChars = section.sizeChars - compactJson.length;
      if (savedChars > 0) {
        compacted.push(`compacted ${section.key} (${section.sizeChars} → ${compactJson.length} chars)`);
        totalSize -= savedChars;
        section.sizeChars = compactJson.length;
        // Mark for compact rendering (we'll check this when building output)
        (section as ContextSection & { compact?: boolean }).compact = true;
      }
    }
  }

  // Build output sections
  let output = '';

  for (const section of sections) {
    if (section.sizeChars === 0) continue; // Dropped

    const useCompact = (section as ContextSection & { compact?: boolean }).compact;
    const json = useCompact
      ? JSON.stringify(section.data)
      : JSON.stringify(section.data, null, 2);

    if (section.key === 'specification') {
      output += `
## Specification

IMPORTANT: Follow these implementation details exactly. This tells you which files to create/modify, what patterns to use, and architectural decisions to follow.

\`\`\`json
${json}
\`\`\`
`;
    } else if (section.key === 'planContext') {
      output += `
## Architecture Context

These are plan-level design decisions, type definitions, and patterns that apply to this task.

\`\`\`json
${json}
\`\`\`
`;
    } else if (section.key === 'planUnderstanding') {
      output += `
## Codebase Understanding

Observations about the existing codebase that are relevant to this task.

\`\`\`json
${json}
\`\`\`
`;
    }
  }

  // Build log message
  let log = '';
  if (reductions.length > 0 || compacted.length > 0) {
    const actions = [...reductions, ...compacted];
    log = `[forge-spawner] Prompt context reduced: ${actions.join(', ')}. Total: ${totalSize}/${maxChars} chars`;
  }

  return { sections: output, log };
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
## REQUIRED: Commit Before Reporting

You MUST commit your changes BEFORE calling report_complete. The orchestrator tracks work by commits.

\`\`\`bash
git add -A && git commit -m "[forge:${options.taskId}] Brief description of what was implemented"
\`\`\`

The commit message MUST start with \`[forge:${options.taskId}]\`. After committing, call \`report_complete\`.
**If you skip the commit, your work may be lost.**

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

  // Build context sections with smart size management
  const { sections, log } = buildContextSections(options);
  if (log) {
    console.log(log);
  }
  prompt += sections;

  // Check if this is a retry after TASK_POST failure
  const spec = options.specification as Record<string, unknown> | undefined;
  const retryContext = spec?.retry_context as {
    failure_reason?: string;
    severity?: 'fix_issues' | 'clean_restart';
    findings?: Record<string, unknown>;
    attempt?: number;
  } | undefined;

  if (retryContext) {
    const { failure_reason, severity, attempt } = retryContext;
    prompt += `\n## Previous Attempt Failed\n\n`;
    prompt += `This is retry attempt ${(attempt ?? 0) + 1}. The previous attempt failed with:\n\n`;
    prompt += `**Reason**: ${failure_reason || 'Quality gate failure'}\n\n`;

    if (severity === 'clean_restart') {
      prompt += `**Severity**: CLEAN RESTART — The previous approach was fundamentally wrong.\n\n`;
      prompt += `Your task:\n`;
      prompt += `1. Start fresh with a different approach\n`;
      prompt += `2. Avoid the same mistakes from the previous attempt\n`;
      prompt += `3. The previous commit will be reverted — don't build on it\n\n`;
    } else {
      prompt += `**Severity**: FIX ISSUES — The commit is mostly correct but has specific problems.\n\n`;
      prompt += `Your task:\n`;
      prompt += `1. Fix the specific issues listed above\n`;
      prompt += `2. Build on the existing code — don't rewrite from scratch\n`;
      prompt += `3. Focus on addressing the failure reason\n\n`;
    }
  } else {
    // Check if this task should be in verify-only mode (code already exists from a previous build)
    // Note: orchestrator already extracts task-specific guidance from fullPrep.task_guidance[step_id]
    // and passes it flattened in prepFindings.task_guidance
    const prepTaskGuidance = (options.prepFindings as Record<string, unknown> | undefined)?.task_guidance as Record<string, unknown> | undefined;
    const isVerifyOnly = spec?.verify_only
      || prepTaskGuidance?.already_implemented;

    if (isVerifyOnly) {
      prompt += `\n## MODE: VERIFY ONLY\n\n`;
      prompt += `This task's code was already implemented by a previous build. Your job:\n`;
      prompt += `1. READ the existing implementation and check it against the acceptance criteria\n`;
      prompt += `2. FIX any gaps, bugs, or missing edge cases\n`;
      prompt += `3. Do NOT rewrite from scratch — extend what exists\n`;
      prompt += `4. Do NOT add tests — test coverage is planned separately\n`;
      prompt += `5. If everything looks good, commit a no-op or small improvement and report complete\n\n`;
    }

    // Handle already_built_hint with softer guidance
    if (!isVerifyOnly && spec?.already_built_hint) {
      prompt += `\n**Note:** A similar task was completed in a prior build. Check if code already exists before implementing from scratch.\n\n`;
    }
  }

  if (options.prepFindings && Object.keys(options.prepFindings).length > 0) {
    const prep = options.prepFindings as Record<string, unknown>;
    const maxChars = parseInt(process.env.FORGE_MAX_PROMPT_CONTEXT_CHARS || '12000', 10);

    // Scope boundary — always include (critical for correctness)
    const scopeBoundary = prep.scope_boundary as { owned_paths?: string[]; do_not_touch?: string[] } | undefined;
    if (scopeBoundary?.do_not_touch && scopeBoundary.do_not_touch.length > 0) {
      prompt += `
## Scope Boundary — IMPORTANT

You MUST NOT modify files outside your scope. Off-limits paths:
${scopeBoundary.do_not_touch.map((f: string) => `- ${f}`).join('\n')}
`;
    }

    // Task-specific guidance from PREP (priority: task_guidance > existing_patterns > warnings)
    const taskGuidance = prep.task_guidance;
    const existingPatterns = prep.existing_patterns;
    const warnings = prep.warnings as string[] | undefined;

    // Calculate prep section sizes
    const taskGuidanceSize = taskGuidance ? JSON.stringify(taskGuidance, null, 2).length : 0;
    const existingPatternsSize = existingPatterns ? JSON.stringify(existingPatterns, null, 2).length : 0;

    // Budget check - if we need to reduce, drop in priority order
    let includeTaskGuidance = !!taskGuidance;
    let includeExistingPatterns = !!existingPatterns;
    let includeWarnings = !!warnings;

    const totalPrepSize = taskGuidanceSize + existingPatternsSize;
    if (totalPrepSize > maxChars * 0.3) {
      // If prep findings alone would use >30% of budget, apply reductions
      // Keep task_guidance and scope_boundary (most critical)
      // Drop existing_patterns if needed
      if (existingPatternsSize > maxChars * 0.15) {
        includeExistingPatterns = false;
        console.log(
          `[forge-spawner] Dropped prepFindings.existing_patterns (${existingPatternsSize} chars) to stay within budget`
        );
      }
      // Drop warnings if prep is still large
      if (taskGuidanceSize + (includeExistingPatterns ? existingPatternsSize : 0) > maxChars * 0.25) {
        includeWarnings = false;
        console.log('[forge-spawner] Dropped prepFindings.warnings to stay within budget');
      }
    }

    if (includeTaskGuidance || includeExistingPatterns) {
      prompt += `\n## Preparation Analysis\n\n`;
      if (includeExistingPatterns && existingPatterns) {
        prompt += `**Existing patterns to follow:**\n\`\`\`json\n${JSON.stringify(existingPatterns, null, 2)}\n\`\`\`\n\n`;
      }
      if (includeTaskGuidance && taskGuidance) {
        prompt += `**Task guidance:**\n\`\`\`json\n${JSON.stringify(taskGuidance, null, 2)}\n\`\`\`\n`;
      }
    }

    if (includeWarnings && warnings && warnings.length > 0) {
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

  // Build CLI command with model selection
  // Map model names (haiku, sonnet, opus) to full model IDs
  const modelMap: Record<string, string> = {
    'haiku': 'claude-haiku-4-5-20251001',
    'sonnet': 'claude-sonnet-4-5-20250929',
    'opus': 'claude-opus-4-6',
  };

  // If model is specified, append --model flag to CLI
  let cli = options.cli;
  if (options.model) {
    const modelId = modelMap[options.model] || options.model;
    cli = `${cli} --model ${modelId}`;
  }

  const result = await spawnAgent({
    name: agentName,
    cli,
    task,
    cwd: options.workspacePath || process.cwd(),
  });

  if (!result.success) {
    throw new Error(`Failed to spawn agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  const agentId = result.name || agentName;

  // Warn if PID is not available — timeout is the only safety net
  if (!result.pid) {
    console.warn(
      `[forge-spawner] WARNING: No PID returned for agent ${agentId} — timeout is the only safety net`
    );
  }

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

      // Deregister from relay registry on process exit (catches zombies that weren't released)
      const relayClient = getClient();
      if (relayClient) {
        relayClient.removeAgent(agentId, { removeMessages: true }).catch(() => {
          // Best-effort — agent may already be deregistered via releaseAgent path
        });
      }
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

  // Build CLI command with model selection (same mapping as spawnForgeTask)
  const modelMap: Record<string, string> = {
    'haiku': 'claude-haiku-4-5-20251001',
    'sonnet': 'claude-sonnet-4-5-20250929',
    'opus': 'claude-opus-4-6',
  };

  // If model is specified, append --model flag to CLI
  let cli = options.cli || 'claude';
  if (options.model) {
    const modelId = modelMap[options.model] || options.model;
    cli = `${cli} --model ${modelId}`;
  }

  const result = await spawnAgent({
    name: agentName,
    cli,
    task,
    cwd: options.cwd || process.cwd(),
  });

  if (!result.success) {
    throw new Error(`Failed to spawn gate agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  const agentId = result.name || agentName;

  console.log(`[forge-spawner] Spawned gate agent ${agentId} for gate ${options.gateId}`);

  // Warn if PID is not available — timeout is the only safety net
  if (!result.pid) {
    console.warn(
      `[forge-spawner] WARNING: No PID returned for gate agent ${agentId} — timeout is the only safety net`
    );
  }

  // Monitor the agent process for exit if callback provided and PID available
  if (onExited && result.pid) {
    monitorPid(result.pid, (exitCode) => {
      console.log(`[forge-spawner] Gate agent ${agentId} (PID ${result.pid}) exited`);
      onExited(exitCode);

      // Deregister gate agent from relay registry on exit
      const relayClient = getClient();
      if (relayClient) {
        relayClient.removeAgent(agentId, { removeMessages: true }).catch(() => {
          // Best-effort cleanup
        });
      }
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
