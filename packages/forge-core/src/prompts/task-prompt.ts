import { buildForgeMcpInstructions } from './mcp-instructions.js';
import type { SpawnTaskOptions } from '../services/agent-spawner.js';

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
export function buildContextSections(options: SpawnTaskOptions): {
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
export function buildTaskPrompt(options: SpawnTaskOptions): string {
  let prompt = `You are executing a task from a Forge orchestration run.
`;

  // MCP reporting instructions go FIRST — this is the most critical thing for the agent to follow
  prompt += buildForgeMcpInstructions(options.taskId);

  prompt += `
## REQUIRED: Commit Before Reporting

You MUST commit your changes BEFORE calling report_complete. The orchestrator tracks work by commits.

\`\`\`bash
git add <files you changed> && git commit -m "[forge:${options.taskId}] Brief description of what was implemented"
\`\`\`

**Rules:**
- Only stage files you created or modified — do NOT use \`git add -A\` or \`git add .\` (other agents may be working in parallel).
- The commit message MUST start with \`[forge:${options.taskId}]\` — this marker lets the orchestrator identify your changes.
- If your work spans multiple commits, each MUST include the \`[forge:${options.taskId}]\` marker.
- Do NOT push — just commit locally. After committing, call \`report_complete\`.
- **If you skip the commit, your work may be lost.**

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
## Instructions

1. Understand the task and acceptance criteria
2. Execute the required work
3. Verify acceptance criteria are met
4. Commit with the \`[forge:${options.taskId}]\` marker (see rules at the top)
5. Call \`report_complete\` as shown at the top of this prompt

**Important:** You are part of an orchestrated workflow. Focus on your specific task and acceptance criteria. Do not attempt to modify the overall plan or execute other tasks.
`;

  prompt += `Begin by acknowledging the task and outlining your approach. When done: commit with the [forge:${options.taskId}] marker, then call report_complete. Both steps are REQUIRED.`;

  return prompt;
}
