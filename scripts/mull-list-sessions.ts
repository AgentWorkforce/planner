import { RelayDaemonAdapter } from "../packages/mull/src/adapters/implementations/relay-daemon-adapter.js";

async function main() {
  const adapter = new RelayDaemonAdapter({ dataDir: ".agent-relay" });
  const sessions = await adapter.listSessions();
  console.log(`Total sessions: ${sessions.length}`);

  // Try first 200 sessions to find ones with content
  const results: Array<{ id: string; messages: number }> = [];

  for (const s of sessions.slice(0, 200)) {
    const entries = await adapter.read(s.sessionId);
    if (entries.length > 5) {
      results.push({ id: s.sessionId, messages: entries.length });
    }
  }

  results.sort((a, b) => b.messages - a.messages);
  console.log(`\nSessions with >5 messages (found ${results.length}):`);
  for (const r of results.slice(0, 25)) {
    console.log(`  ${r.id}: ${r.messages} entries`);
  }
}

main().catch(console.error);
