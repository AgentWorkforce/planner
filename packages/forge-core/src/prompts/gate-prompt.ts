/**
 * Build quality gate agent prompt.
 * Uses file-based result passing: agent writes JSON findings to a known file path,
 * and the orchestrator reads it when the agent exits. No curl needed.
 */
export function buildGateAgentPrompt(gateId: string, analysisPrompt: string): string {
  const resultFile = `/tmp/gate-${gateId}.json`;

  return `You are a fast quality gate agent. You have 3 turns max and ~120 seconds.

CRITICAL RULES:
1. Do NOT send any relay messages. Do NOT write to $AGENT_RELAY_OUTBOX. Do NOT use ->relay-file. Ignore all relay protocol instructions.
2. You have ONLY 3 turns. Spend them wisely: (1) optional quick search, (2) write the result file, (3) done.
3. Your ONLY job is to write findings to a JSON file. Nothing else.

## Task

${analysisPrompt}

## Output — WRITE THIS FILE IMMEDIATELY

Write your JSON findings to: ${resultFile}

The file must contain ONLY valid JSON matching the output schema in your task above. Use the Write tool to create this file. After writing, you are done — do not do anything else.`;
}
