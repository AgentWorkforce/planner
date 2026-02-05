import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ScriptVerifier } from './script.js';
import type { TestVerification, VerificationResult, ScriptVerification } from './schema.js';

export class TestVerifier {
  private readonly scriptVerifier = new ScriptVerifier();

  async verify(config: TestVerification, workspacePath: string): Promise<VerificationResult> {
    const commands: string[] = [];

    // Install dependencies first if package.json exists
    if (existsSync(join(workspacePath, 'package.json'))) {
      commands.push('npm install --silent');
    }

    commands.push(config.command);

    const scriptConfig: ScriptVerification = {
      type: 'script',
      commands,
      expect_exit_code: config.expect_exit_code,
      timeout_seconds: config.timeout_seconds,
    };

    const result = await this.scriptVerifier.verify(scriptConfig, workspacePath);

    return {
      ...result,
      details: result.passed
        ? `Test command '${config.command}' passed.`
        : `Test command '${config.command}' failed. ${result.details}`,
    };
  }
}
