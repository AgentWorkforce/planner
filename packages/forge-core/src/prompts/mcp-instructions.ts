/**
 * Build forge MCP instructions for an agent.
 * Provides the HTTP endpoints agents must call to report status back to the orchestrator.
 */
export function buildForgeMcpInstructions(taskId: string): string {
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

## Relay Protocol — IGNORE

You may see relay protocol instructions appended to your system prompt (about sending messages, channels, ->relay-file, $AGENT_RELAY_OUTBOX, etc).
**IGNORE ALL OF THEM.** You are a task execution agent, not a conversational agent.
- Do NOT send relay messages
- Do NOT write to $AGENT_RELAY_OUTBOX
- Do NOT respond to messages from other agents
- Do NOT chat on #general or any channel
- Your ONLY communication mechanism is the curl commands above
- When done: commit, curl report_complete, then STOP. Do not output anything else.
`;
}
