/**
 * MCP tool definitions for Cultivate
 *
 * Exposes cultivate data (greenhouses, clusters, signals, profiles) and
 * AI-powered generation (PRD, reports, recommendations) via the MCP protocol.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const CULTIVATE_TOOLS: ToolDefinition[] = [
  {
    name: 'cultivate_list_greenhouses',
    description: 'List all signal greenhouses with source counts',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'cultivate_list_clusters',
    description: 'List clusters for a greenhouse, sorted by signal count descending',
    inputSchema: {
      type: 'object',
      properties: {
        greenhouse_id: { type: 'string', description: 'Greenhouse ID' },
      },
      required: ['greenhouse_id'],
    },
  },
  {
    name: 'cultivate_get_cluster',
    description:
      'Get cluster detail with signals, extractions, quality scores, demand score, and sentiment',
    inputSchema: {
      type: 'object',
      properties: {
        cluster_id: { type: 'string', description: 'Cluster ID' },
      },
      required: ['cluster_id'],
    },
  },
  {
    name: 'cultivate_list_signals',
    description: 'List signals with optional filters (greenhouse, intent, cluster)',
    inputSchema: {
      type: 'object',
      properties: {
        greenhouse_id: { type: 'string', description: 'Filter by greenhouse ID' },
        intent: { type: 'string', description: 'Filter by intent classification' },
        cluster_id: { type: 'string', description: 'Filter by cluster ID' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'cultivate_get_recommendations',
    description: 'Get AI-generated recommendations for a greenhouse',
    inputSchema: {
      type: 'object',
      properties: {
        greenhouse_id: { type: 'string', description: 'Greenhouse ID' },
      },
      required: ['greenhouse_id'],
    },
  },
  {
    name: 'cultivate_generate_prd',
    description: 'Generate a PRD document from a cluster',
    inputSchema: {
      type: 'object',
      properties: {
        cluster_id: { type: 'string', description: 'Cluster ID to generate PRD for' },
        greenhouse_id: {
          type: 'string',
          description: 'Greenhouse the cluster belongs to',
        },
      },
      required: ['cluster_id', 'greenhouse_id'],
    },
  },
  {
    name: 'cultivate_generate_report',
    description: 'Generate a synthesis report for a greenhouse',
    inputSchema: {
      type: 'object',
      properties: {
        greenhouse_id: { type: 'string', description: 'Greenhouse ID' },
      },
      required: ['greenhouse_id'],
    },
  },
  {
    name: 'cultivate_list_profiles',
    description: 'List author profiles with optional segment filter',
    inputSchema: {
      type: 'object',
      properties: {
        greenhouse_id: { type: 'string', description: 'Greenhouse ID' },
        segment: { type: 'string', description: 'Filter by ICP segment label' },
      },
      required: ['greenhouse_id'],
    },
  },
];
