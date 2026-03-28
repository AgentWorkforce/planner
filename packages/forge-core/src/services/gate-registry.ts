/**
 * Gate Result Registry — In-Memory Promise Coordination
 *
 * Coordinates quality gate results between AnalysisTool (spawns agent)
 * and MCP handler (receives findings via report_gate_result tool).
 *
 * Flow:
 * 1. AnalysisTool calls createGate() → returns Promise<GateResult>
 * 2. Quality gate agent completes analysis, calls report_gate_result MCP tool
 * 3. MCP handler calls resolveGate() → resolves the Promise
 * 4. AnalysisTool receives findings and continues execution
 */

export interface GateResult {
  findings: Record<string, unknown>;
  durationMs: number;
}

interface PendingGate {
  resolve: (result: GateResult) => void;
  reject: (error: Error) => void;
  createdAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
  onTimeout?: () => void;
}

export class GateResultRegistry {
  private pending = new Map<string, PendingGate>();

  /**
   * Creates a gate entry and returns a Promise that resolves when
   * resolveGate() is called or rejects on timeout.
   */
  createGate(gateId: string, timeoutMs: number, onTimeout?: () => void): Promise<GateResult> {
    // Clean up existing gate if present (shouldn't happen, but defensive)
    if (this.pending.has(gateId)) {
      this.rejectGate(gateId, 'Gate recreated before previous resolved');
    }

    return new Promise<GateResult>((resolve, reject) => {
      const createdAt = Date.now();

      const timeoutHandle = setTimeout(() => {
        const gate = this.pending.get(gateId);
        this.pending.delete(gateId);
        reject(new Error(`Quality gate timed out after ${timeoutMs}ms`));
        // Fire cleanup callback (e.g., terminate the gate agent to stop wasting credits)
        if (gate?.onTimeout) gate.onTimeout();
      }, timeoutMs);

      this.pending.set(gateId, {
        resolve,
        reject,
        createdAt,
        timeoutHandle,
        onTimeout,
      });
    });
  }

  /**
   * Resolves a pending gate with findings.
   * Returns true if gate was found and resolved, false otherwise.
   */
  resolveGate(gateId: string, findings: Record<string, unknown>): boolean {
    const gate = this.pending.get(gateId);
    if (!gate) {
      return false;
    }

    clearTimeout(gate.timeoutHandle);
    this.pending.delete(gateId);

    const durationMs = Date.now() - gate.createdAt;
    gate.resolve({ findings, durationMs });

    return true;
  }

  /**
   * Rejects a pending gate with an error reason.
   * Returns true if gate was found and rejected, false otherwise.
   */
  rejectGate(gateId: string, reason: string): boolean {
    const gate = this.pending.get(gateId);
    if (!gate) {
      return false;
    }

    clearTimeout(gate.timeoutHandle);
    this.pending.delete(gateId);

    gate.reject(new Error(reason));

    return true;
  }

  /**
   * Check if a gate is currently pending.
   */
  hasPendingGate(gateId: string): boolean {
    return this.pending.has(gateId);
  }

  /**
   * Shutdown the registry, rejecting all pending gates.
   */
  shutdown(): void {
    this.pending.forEach((gate, gateId) => {
      clearTimeout(gate.timeoutHandle);
      gate.reject(new Error('Gate registry shutdown'));
    });
    this.pending.clear();
  }
}
