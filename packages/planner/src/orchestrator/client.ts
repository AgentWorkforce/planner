import type { ExecutionStatus } from '../domain/compute-attention.js';

/**
 * Configuration for the orchestrator client.
 */
interface OrchestratorClientConfig {
  /** Base URL for the orchestrator service */
  baseUrl?: string;
  /** Timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
}

/**
 * Gets the orchestrator URL from environment.
 * Returns undefined if not configured.
 */
function getOrchestratorUrl(): string | undefined {
  return process.env.ORCHESTRATOR_URL;
}

/**
 * Fetches execution status for multiple plans in a single batch request.
 * Returns a Map where key is plan_id, value is ExecutionStatus or null.
 *
 * On orchestrator error or timeout, returns empty Map (no exceptions thrown).
 * This allows the caller to gracefully degrade when orchestrator is unavailable.
 *
 * @param planIds - Array of plan IDs to fetch execution status for
 * @param config - Optional configuration overrides
 * @returns Map of plan_id to ExecutionStatus (or null if no execution)
 */
export async function getExecutionStatusBatch(
  planIds: string[],
  config: OrchestratorClientConfig = {}
): Promise<Map<string, ExecutionStatus | null>> {
  const baseUrl = config.baseUrl ?? getOrchestratorUrl();
  const timeoutMs = config.timeoutMs ?? 5000;

  // Return empty map if orchestrator not configured
  if (!baseUrl) {
    return new Map();
  }

  // Return empty map if no plan IDs
  if (planIds.length === 0) {
    return new Map();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/executions/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan_ids: planIds }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[orchestrator] Batch execution status request failed: ${response.status} ${response.statusText}`
      );
      return new Map();
    }

    const data = (await response.json()) as {
      executions: Array<{
        plan_id: string;
        execution: ExecutionStatus | null;
      }>;
    };

    const result = new Map<string, ExecutionStatus | null>();
    for (const item of data.executions) {
      result.set(item.plan_id, item.execution);
    }

    return result;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        console.warn(`[orchestrator] Batch execution status request timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`[orchestrator] Batch execution status request failed: ${err.message}`);
      }
    }
    return new Map();
  }
}
