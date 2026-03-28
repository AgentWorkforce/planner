/**
 * MCP tool call handler for Cultivate
 *
 * Dispatches tool calls to existing storage methods and scoring utilities.
 * AI-dependent tools (recommendations, PRD, report) return redirect messages
 * since they require an active Anthropic client, which is managed by the
 * corresponding HTTP API endpoints.
 */

import type { CultivateStorage } from '../storage/interface.js';
import { computeDemandScore } from '../scoring/demand.js';

// ============================================
// Response helpers
// ============================================

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function success(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ============================================
// Handler
// ============================================

/**
 * Handle a single MCP tool call by dispatching to the appropriate storage method.
 *
 * @param storage  - CultivateStorage instance
 * @param toolName - Name of the tool being invoked
 * @param args     - Validated arguments from the MCP client
 * @returns ToolResult with JSON-serialised content
 */
export async function handleToolCall(
  storage: CultivateStorage,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    // ------ Data-only tools (direct storage delegation) ------

    case 'cultivate_list_greenhouses': {
      const greenhouses = await storage.listGreenhouses();
      return success(greenhouses);
    }

    case 'cultivate_list_clusters': {
      const greenhouseId = args.greenhouse_id as string;
      if (!greenhouseId) return error('greenhouse_id is required');
      const clusters = await storage.listClustersByGreenhouse(greenhouseId);
      // Sort by signal count descending for most-active-first ordering
      clusters.sort((a, b) => b.signal_count - a.signal_count);
      return success(clusters);
    }

    case 'cultivate_get_cluster': {
      const clusterId = args.cluster_id as string;
      if (!clusterId) return error('cluster_id is required');

      const cluster = await storage.getClusterById(clusterId);
      if (!cluster) return error('Cluster not found');

      // Load signals belonging to this cluster
      const signals = await storage.listSignals({
        cluster_id: cluster.id,
        limit: 100,
        offset: 0,
      });

      // Enrich each signal with its extraction data
      const signalsWithExtractions = await Promise.all(
        signals.map(async (s) => {
          const extraction = await storage.getExtractionBySignalId(s.id);
          return { ...s, extraction };
        }),
      );

      // Compute demand score from signals + cluster velocity
      const demand = computeDemandScore(signalsWithExtractions, cluster);

      return success({ ...cluster, signals: signalsWithExtractions, demand });
    }

    case 'cultivate_list_signals': {
      const signals = await storage.listSignals({
        greenhouse_id: args.greenhouse_id as string | undefined,
        intent: args.intent as string | undefined,
        cluster_id: args.cluster_id as string | undefined,
        limit: Math.min(Math.max(1, typeof args.limit === 'number' ? args.limit : 50), 100),
        offset: 0,
      });
      return success(signals);
    }

    case 'cultivate_list_profiles': {
      const greenhouseId = args.greenhouse_id as string;
      if (!greenhouseId) return error('greenhouse_id is required');

      const profiles = await storage.listProfiles({
        greenhouse_id: greenhouseId,
        segment: args.segment as string | undefined,
        limit: 100,
        offset: 0,
      });
      return success(profiles);
    }

    // ------ AI-dependent tools (redirect to HTTP endpoints) ------

    case 'cultivate_get_recommendations': {
      return success({
        message:
          'Recommendations require AI service — use GET /api/cultivate/recommendations?greenhouse_id=<id> directly',
      });
    }

    case 'cultivate_generate_prd': {
      return success({
        message:
          'PRD generation requires AI service — use POST /api/cultivate/prd/generate with { cluster_id, greenhouse_id } directly',
      });
    }

    case 'cultivate_generate_report': {
      return success({
        message:
          'Report generation requires AI service — use POST /api/cultivate/reports/generate with { greenhouse_id } directly',
      });
    }

    default:
      return error(`Unknown tool: ${toolName}`);
  }
}
