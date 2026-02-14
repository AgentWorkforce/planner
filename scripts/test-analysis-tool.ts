import { AnalysisTool } from '../packages/forge-core/src/services/analysis-tool.js';

async function main() {
  const tool = new AnalysisTool({ cli: 'claude' });

  console.log('Testing AnalysisTool with claude -p ...');

  try {
    const result = await tool.run('Respond with exactly one word: PING', {
      model: 'haiku',
      timeoutMs: 30000,
    });

    console.log('Output:', result.output.trim());
    console.log('Parsed:', result.parsed);
    console.log('Duration:', result.durationMs, 'ms');
    console.log('Model:', result.model);

    if (result.output.includes('PING')) {
      console.log('\nSUCCESS: AnalysisTool pipe mode works');
    } else {
      console.log('\nWARNING: Output did not contain PING, but call succeeded');
    }
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
