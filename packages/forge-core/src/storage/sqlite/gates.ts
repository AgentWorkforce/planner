import type Database from 'better-sqlite3';
import type { Gate, GateStatus } from '../../domain/types.js';
import { type GateRow, rowToGate } from './converters.js';

export function createGate(db: Database.Database, gate: Gate): Gate {
  const stmt = db.prepare(`
    INSERT INTO gates (
      gate_id, task_id, status, approver_role, decided_by, decided_at, comment, created_at
    )
    VALUES (
      @gate_id, @task_id, @status, @approver_role, @decided_by, @decided_at, @comment, @created_at
    )
  `);
  stmt.run({
    gate_id: gate.gate_id,
    task_id: gate.task_id,
    status: gate.status,
    approver_role: gate.approver_role ?? null,
    decided_by: gate.decided_by ?? null,
    decided_at: gate.decided_at ?? null,
    comment: gate.comment ?? null,
    created_at: gate.created_at,
  });
  return gate;
}

export function getGate(db: Database.Database, gateId: string): Gate | null {
  const stmt = db.prepare<string, GateRow>(`
    SELECT gate_id, task_id, status, approver_role, decided_by, decided_at, comment, created_at
    FROM gates
    WHERE gate_id = ?
  `);
  const row = stmt.get(gateId);
  if (!row) return null;
  return rowToGate(row);
}

export function getGateByTaskId(db: Database.Database, taskId: string): Gate | null {
  const stmt = db.prepare<string, GateRow>(`
    SELECT gate_id, task_id, status, approver_role, decided_by, decided_at, comment, created_at
    FROM gates
    WHERE task_id = ?
  `);
  const row = stmt.get(taskId);
  if (!row) return null;
  return rowToGate(row);
}

export function updateGate(db: Database.Database, gateId: string, updates: Partial<Gate>): Gate | null {
  const fields: string[] = [];
  const values: Record<string, unknown> = { gate_id: gateId };

  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.decided_by !== undefined) {
    fields.push('decided_by = @decided_by');
    values.decided_by = updates.decided_by ?? null;
  }
  if (updates.decided_at !== undefined) {
    fields.push('decided_at = @decided_at');
    values.decided_at = updates.decided_at ?? null;
  }
  if (updates.comment !== undefined) {
    fields.push('comment = @comment');
    values.comment = updates.comment ?? null;
  }

  if (fields.length === 0) {
    return getGate(db, gateId);
  }

  const stmt = db.prepare(`
    UPDATE gates
    SET ${fields.join(', ')}
    WHERE gate_id = @gate_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getGate(db, gateId);
}

export function updateGateDecision(
  db: Database.Database,
  gateId: string,
  status: GateStatus,
  decidedBy: string,
  comment?: string
): Gate | null {
  const now = new Date().toISOString();
  return updateGate(db, gateId, {
    status,
    decided_by: decidedBy,
    decided_at: now,
    comment,
  });
}

export function listPendingGates(db: Database.Database, runId: string): Gate[] {
  const stmt = db.prepare<string, GateRow>(`
    SELECT g.gate_id, g.task_id, g.status, g.approver_role, g.decided_by, g.decided_at, g.comment, g.created_at
    FROM gates g
    INNER JOIN tasks t ON g.task_id = t.task_id
    WHERE t.run_id = ? AND g.status = 'pending'
    ORDER BY g.created_at ASC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToGate(row));
}
