import type { Verification, VerificationResult } from './schema.js';
import { ScriptVerifier } from './script.js';
import { TestVerifier } from './test.js';

export class VerificationRouter {
  private readonly scriptVerifier = new ScriptVerifier();
  private readonly testVerifier = new TestVerifier();

  async verify(verification: Verification, workspacePath: string): Promise<VerificationResult> {
    switch (verification.type) {
      case 'script':
        return this.scriptVerifier.verify(verification, workspacePath);

      case 'test':
        return this.testVerifier.verify(verification, workspacePath);

      case 'http':
        return {
          passed: false,
          details: 'HTTP verification not yet implemented.',
        };

      case 'file':
        return {
          passed: false,
          details: 'File verification not yet implemented.',
        };

      default:
        return {
          passed: false,
          details: `Unknown verification type: ${(verification as { type: string }).type}`,
        };
    }
  }
}
