import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error } from '../types.js';

// ============================================
// Schema
// ============================================

export const ReportGateResultSchema = z.object({
  gate_id: z.string().min(1),
  findings: z.record(z.unknown()),
});

export type ReportGateResultArgs = z.infer<typeof ReportGateResultSchema>;

// ============================================
// Tool Definition
// ============================================

export const reportGateResultTool: ToolDefinition = {
  name: 'report_gate_result',
  description:
    'Reports findings from a quality gate analysis. Used by quality gate agents to submit their analysis results.',
  inputSchema: {
    type: 'object',
    properties: {
      gate_id: {
        type: 'string',
        description: 'The unique identifier of the quality gate',
      },
      findings: {
        type: 'object',
        description: 'Analysis findings as structured data (criteria checks, metrics, issues found, etc.)',
      },
    },
    required: ['gate_id', 'findings'],
  },
};

// ============================================
// Result Type
// ============================================

export interface ReportGateResultResult {
  gate_id: string;
  findings_received: boolean;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleReportGateResult(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<ReportGateResultResult> {
  // Validate arguments
  const parseResult = ReportGateResultSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { gate_id, findings } = parseResult.data;

  // Check if gateRegistry is available
  if (!context.gateRegistry) {
    return error('Gate registry not available in context');
  }

  // Resolve the gate with findings
  const resolved = context.gateRegistry.resolveGate(gate_id, findings);
  if (!resolved) {
    return error(`Quality gate not found or already resolved: ${gate_id}`);
  }

  const timestamp = new Date().toISOString();

  return success({
    gate_id,
    findings_received: true,
    timestamp,
  });
}
