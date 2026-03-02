/**
 * GateManager — orchestrates the pause/unpause dance for human approval gates.
 *
 * When a plan step has a gate, the GateManager listens for the corresponding
 * step:completed event, pauses the WorkflowRunner, creates a Gate record in
 * storage, and emits a gate:pending event so the UI can surface the checkpoint.
 *
 * Approve → unpauses the runner, allowing subsequent steps to proceed.
 * Reject → aborts the runner entirely.
 */

import { EventEmitter } from 'node:events';
import type { WorkflowRunner, WorkflowEvent } from '@agent-relay/sdk/workflows';
import type { ForgeNextStorage } from './storage/interface.js';
import type { Gate } from './types.js';

// ---------------------------------------------------------------------------
// Gate step configuration
// ---------------------------------------------------------------------------

/** Configuration stored per gated step. */
interface GateStepConfig {
  /** Human-readable step title, used as gate.step_name. */
  step_name: string;
  approver_role?: string;
}

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

interface GateManagerEvents {
  'gate:pending': [payload: { gate: Gate; runId: string }];
  'gate:approved': [payload: { gate: Gate; runId: string }];
  'gate:rejected': [payload: { gate: Gate; runId: string }];
}

// ---------------------------------------------------------------------------
// GateManager
// ---------------------------------------------------------------------------

export class GateManager extends EventEmitter<GateManagerEvents> {
  private readonly storage: ForgeNextStorage;
  private runner: WorkflowRunner | null = null;

  /** The forge run ID — NOT the relay internal run ID. */
  private forgeRunId: string | null = null;

  /**
   * Maps step_id → gate configuration.
   * step_id here is the relay workflow step name (equals plan step_id from compiler).
   */
  private gateSteps: Map<string, GateStepConfig> = new Map();

  /** Unsubscribe handle returned by runner.on(). Cleared in reset(). */
  private unsubscribe: (() => void) | null = null;

  constructor(storage: ForgeNextStorage) {
    super();
    this.storage = storage;
  }

  /**
   * Set the forge run ID for this execution. Must be called before bind().
   * Gate records and emitted events use this ID (not the relay internal ID).
   */
  setForgeRunId(runId: string): void {
    this.forgeRunId = runId;
  }

  /**
   * Register which steps have gates. Must be called after compilation and
   * before bind(). The map key is the step_id (= relay workflow step name).
   */
  setGateSteps(gates: Map<string, GateStepConfig>): void {
    this.gateSteps = new Map(gates);
  }

  /**
   * Bind to a WorkflowRunner instance. Must be called before execution starts.
   * Subscribes to runner events to detect gate triggers.
   */
  bind(runner: WorkflowRunner): void {
    // Clean up any prior subscription before binding a new runner.
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.runner = runner;

    this.unsubscribe = runner.on((event: WorkflowEvent) => {
      if (event.type !== 'step:completed') return;

      const gateConfig = this.gateSteps.get(event.stepName);
      if (!gateConfig) return;

      this._handleGateTrigger(event.runId, event.stepName, gateConfig);
    });
  }

  /**
   * Approve a pending gate. Unpauses the runner to continue execution.
   *
   * @throws {Error} If the gate is not found or is not in a pending state.
   */
  async approveGate(gateId: string, approver?: string, note?: string): Promise<Gate> {
    const gate = this.storage.getGate(gateId);

    if (!gate) {
      throw new Error(`Gate not found: ${gateId}`);
    }

    if (gate.status !== 'pending') {
      throw new Error(
        `Cannot approve gate ${gateId}: gate is already in '${gate.status}' state`,
      );
    }

    const now = new Date().toISOString();

    this.storage.updateGate(gateId, {
      status: 'approved',
      approver: approver ?? null,
      decision_note: note ?? null,
      decided_at: now,
    });

    const updated: Gate = {
      ...gate,
      status: 'approved',
      approver: approver ?? null,
      decision_note: note ?? null,
      decided_at: now,
    };

    if (this.runner) {
      this.runner.unpause();
    }

    this.emit('gate:approved', { gate: updated, runId: gate.run_id });

    return updated;
  }

  /**
   * Reject a pending gate. Aborts the runner entirely.
   *
   * @throws {Error} If the gate is not found or is not in a pending state.
   */
  async rejectGate(gateId: string, approver?: string, note?: string): Promise<Gate> {
    const gate = this.storage.getGate(gateId);

    if (!gate) {
      throw new Error(`Gate not found: ${gateId}`);
    }

    if (gate.status !== 'pending') {
      throw new Error(
        `Cannot reject gate ${gateId}: gate is already in '${gate.status}' state`,
      );
    }

    const now = new Date().toISOString();

    this.storage.updateGate(gateId, {
      status: 'rejected',
      approver: approver ?? null,
      decision_note: note ?? null,
      decided_at: now,
    });

    const updated: Gate = {
      ...gate,
      status: 'rejected',
      approver: approver ?? null,
      decision_note: note ?? null,
      decided_at: now,
    };

    if (this.runner) {
      this.runner.abort();
    }

    this.emit('gate:rejected', { gate: updated, runId: gate.run_id });

    return updated;
  }

  /**
   * Reset for a new run. Clears the runner binding and gate configuration.
   * Call this between runs to avoid stale state.
   */
  reset(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.runner = null;
    this.forgeRunId = null;
    this.gateSteps.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Called synchronously from the runner event listener when a gated step
   * completes. Pauses the runner, persists the gate record, and emits
   * the gate:pending event.
   *
   * This runs inside the runner's event callback — keep it synchronous and
   * side-effect-free beyond storage writes and event emission.
   */
  private _handleGateTrigger(
    _relayRunId: string,
    stepId: string,
    config: GateStepConfig,
  ): void {
    if (!this.forgeRunId) {
      console.error('[gate-manager] Gate triggered but no forge run ID set — skipping');
      return;
    }

    if (this.runner) {
      this.runner.pause();
    }

    const gate: Gate = {
      id: crypto.randomUUID(),
      run_id: this.forgeRunId,
      step_id: stepId,
      step_name: config.step_name,
      status: 'pending',
      approver: null,
      decision_note: null,
      created_at: new Date().toISOString(),
      decided_at: null,
    };

    this.storage.createGate(gate);

    this.emit('gate:pending', { gate, runId: this.forgeRunId });
  }
}
