/**
 * Cluster Assignment Prompt Templates
 *
 * This module defines the system and user prompt templates used to instruct Haiku
 * to assign signals to existing clusters or recommend creating new clusters.
 *
 * The prompts include:
 * - Clear task definition and output schema
 * - Guidelines for cluster assignment vs. new cluster creation
 * - Structured output format using ClusterAssignmentDecision
 *
 * ## Usage Example
 *
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import {
 *   CLUSTER_ASSIGNMENT_SYSTEM_PROMPT,
 *   CLUSTER_ASSIGNMENT_TOOL,
 *   createClusterAssignmentUserPrompt,
 *   ClusterAssignmentDecisionSchema,
 * } from './cluster-assignment-prompt.js';
 *
 * const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * async function assignToCluster(
 *   signal: { summary: string; keywords: string[]; aspects?: string[] },
 *   existingClusters: Array<{ id: string; label: string; summary: string }>
 * ): Promise<ClusterAssignmentDecision> {
 *   const userPrompt = createClusterAssignmentUserPrompt({
 *     signal,
 *     existingClusters,
 *     greenhouseName: 'Product Feedback',
 *   });
 *
 *   // Use tool_use for guaranteed structured output
 *   const response = await anthropic.messages.create({
 *     model: 'claude-haiku-4-5-20251001',
 *     max_tokens: 1024,
 *     system: CLUSTER_ASSIGNMENT_SYSTEM_PROMPT,
 *     tools: [CLUSTER_ASSIGNMENT_TOOL as any],
 *     messages: [{ role: 'user', content: userPrompt }],
 *   });
 *
 *   // Extract tool_use content from response
 *   const toolUseContent = response.content.find(
 *     (block: any) => block.type === 'tool_use'
 *   );
 *   if (!toolUseContent || (toolUseContent as any).type !== 'tool_use') {
 *     throw new Error('Expected tool_use response from model');
 *   }
 *
 *   // Parse and validate with Zod schema (already structured by tool_use)
 *   const decision = ClusterAssignmentDecisionSchema.parse((toolUseContent as any).input);
 *   return decision;
 * }
 * ```
 */

import { z } from 'zod';

/**
 * Cluster assignment decision schema
 *
 * Haiku must return either:
 * - An existing cluster_id to assign the signal to
 * - A recommendation to create a new cluster with proposed name and summary
 */
export const ClusterAssignmentDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    cluster_id: z.string().describe('ID of the existing cluster to assign this signal to'),
    reasoning: z.string().describe('Brief explanation of why this cluster is the best match'),
    confidence: z.number().min(0).max(1).describe('Confidence score 0-1 for this assignment'),
    also_related: z
      .array(z.string())
      .optional()
      .describe('Optional: Other cluster IDs this signal is secondarily related to'),
  }),
  z.object({
    action: z.literal('create_new'),
    cluster_name: z.string().describe('Proposed name for the new cluster (3-6 word noun phrase)'),
    cluster_summary: z.string().describe('Brief summary of what this new cluster represents'),
    reasoning: z.string().describe('Explanation of why a new cluster is needed'),
    confidence: z.number().min(0).max(1).describe('Confidence score 0-1 for this recommendation'),
  }),
]);

export type ClusterAssignmentDecision = z.infer<typeof ClusterAssignmentDecisionSchema>;

/**
 * Tool definition for cluster assignment with JSON schema structured output
 * Uses tool_use to guarantee the API returns valid JSON conforming to the schema
 *
 * This ensures reliable structured output without manual JSON parsing or validation failures.
 */
export const CLUSTER_ASSIGNMENT_TOOL = {
  name: 'assign_signal_to_cluster',
  description:
    'Assign a signal to an existing cluster or recommend creating a new cluster based on thematic analysis',
  input_schema: {
    type: 'object' as const,
    oneOf: [
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['assign'],
            description: 'Action to take: assign signal to existing cluster',
          },
          cluster_id: {
            type: 'string',
            description: 'ID of the existing cluster to assign this signal to',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of why this cluster is the best match',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score 0-1 for this assignment',
          },
          also_related: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Other cluster IDs this signal is secondarily related to',
          },
        },
        required: ['action', 'cluster_id', 'reasoning', 'confidence'],
      },
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create_new'],
            description: 'Action to take: create a new cluster',
          },
          cluster_name: {
            type: 'string',
            description: 'Proposed name for the new cluster (3-6 word noun phrase)',
          },
          cluster_summary: {
            type: 'string',
            description: 'Brief summary of what this new cluster represents',
          },
          reasoning: {
            type: 'string',
            description: 'Explanation of why a new cluster is needed',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score 0-1 for this recommendation',
          },
        },
        required: ['action', 'cluster_name', 'cluster_summary', 'reasoning', 'confidence'],
      },
    ],
  },
};

/**
 * System prompt: Instructs Haiku on cluster assignment task
 *
 * This prompt establishes:
 * - The role as a product theme analyst using grounded theory
 * - The decision framework (assign vs. create new)
 * - Quality expectations for classification
 */
export const CLUSTER_ASSIGNMENT_SYSTEM_PROMPT = `You are an expert product theme analyst trained in grounded theory and signal clustering.

Your task is to analyze a new signal (already extracted and summarized) and determine whether it belongs to an existing cluster or represents a new theme that should become its own cluster.

## Grounded Theory Principles

1. **Themes emerge from data** - clusters are not predefined categories but patterns that naturally arise from signal content
2. **Conceptual coherence** - signals in a cluster should share core concepts, not just keywords
3. **Actionable grouping** - clusters should represent themes that product teams can act on as a unit

## Decision Framework

You must return a ClusterAssignmentDecision object with one of two actions:

### Action: "assign"
Use when the signal clearly belongs to an existing cluster.

Output schema:
{
  "action": "assign",
  "cluster_id": "uuid-of-cluster",
  "reasoning": "Brief explanation of why this cluster is the best match",
  "confidence": 0.0-1.0,
  "also_related": ["optional-other-cluster-ids"]  // if signal touches multiple themes
}

**When to assign:**
- Signal shares core concepts with an existing cluster
- Signal represents an instance, variation, or extension of an existing theme
- Signal would add meaningful context to the existing cluster
- Even if keywords differ, the underlying theme/need is the same

**Confidence scoring for assignments:**
- **0.9-1.0**: Strong conceptual match, clear fit, no ambiguity
- **0.7-0.9**: Good match with minor differences, confident assignment
- **0.5-0.7**: Reasonable fit but some ambiguity or overlap with other clusters
- **0.3-0.5**: Weak match, consider if a new cluster might be better
- **0.0-0.3**: Poor fit, should probably create a new cluster instead

### Action: "create_new"
Use when the signal represents a distinct theme not covered by existing clusters.

Output schema:
{
  "action": "create_new",
  "cluster_name": "Concise theme name (3-6 words)",
  "cluster_summary": "Brief description of what this new cluster represents",
  "reasoning": "Explanation of why a new cluster is needed",
  "confidence": 0.0-1.0
}

**When to create new:**
- Signal introduces a genuinely new theme, concern, or opportunity not present in existing clusters
- Signal is conceptually distinct from all existing clusters
- Forcing assignment to an existing cluster would dilute its thematic coherence
- The signal represents the start of a potentially important new pattern

**Cluster naming guidelines:**
- Use a concise noun phrase (3-6 words) that a product manager would recognize
- Focus on the user need, experience, or outcome rather than solution details
- Examples: "API reliability concerns", "Mobile onboarding friction", "Enterprise SSO requests"
- Avoid: generic terms ("Issues", "Feedback"), solution names ("Add feature X")

**Confidence scoring for new clusters:**
- **0.9-1.0**: Clearly distinct theme, no overlap with existing clusters
- **0.7-0.9**: Likely new theme but some conceptual adjacency to existing clusters
- **0.5-0.7**: Borderline - could be new or could stretch to fit existing cluster
- **0.3-0.5**: Uncertain - probably better to assign to existing cluster
- **0.0-0.3**: Weak case for new cluster, should assign instead

## Quality Standards

1. **Thematic coherence**: Prioritize conceptual similarity over keyword matching
2. **User perspective**: Think from the perspective of someone scanning cluster themes to understand customer needs
3. **Avoid over-clustering**: Don't create new clusters for every slight variation; themes should have meaningful volume potential
4. **Avoid under-clustering**: Don't force unrelated signals together just to keep cluster count low
5. **Consistency**: Similar signals should consistently land in the same cluster

## Output Format

Always return valid JSON matching the ClusterAssignmentDecision schema (discriminated union on "action" field). Do not include markdown formatting, code blocks, or explanatory text outside the JSON object.`;

/**
 * User prompt template: Provides signal data and existing clusters for classification
 *
 * This prompt includes:
 * - The extracted signal summary, keywords, and aspects
 * - List of existing clusters with their names and summaries
 * - Explicit instructions to return JSON
 */
export function createClusterAssignmentUserPrompt(options: {
  signal: {
    summary: string;
    keywords: string[];
    aspects?: string[];
    entities?: Array<{ name: string; type: string }>;
  };
  existingClusters: Array<{
    id: string;
    label: string;
    summary: string;
    signal_count?: number;
  }>;
  greenhouseName?: string;
}): string {
  const { signal, existingClusters, greenhouseName = 'this greenhouse' } = options;

  // Format signal aspects and entities if provided
  const aspectsSection = signal.aspects?.length
    ? `- **Aspects:** ${signal.aspects.join(', ')}`
    : '';

  const entitiesSection = signal.entities?.length
    ? `- **Key Entities:** ${signal.entities.map(e => `${e.name} (${e.type})`).join(', ')}`
    : '';

  // Format existing clusters list
  const clustersSection =
    existingClusters.length === 0
      ? 'No existing clusters. This would be the first cluster.'
      : existingClusters
          .map((c, idx) => {
            const signalCountInfo = c.signal_count ? ` (${c.signal_count} signals)` : '';
            return `${idx + 1}. **${c.label}** (ID: \`${c.id}\`)${signalCountInfo}
   Summary: ${c.summary}`;
          })
          .join('\n\n');

  return `Analyze the following signal and determine whether it should be assigned to an existing cluster or if a new cluster should be created.

## Signal to Classify

**Greenhouse:** ${greenhouseName}

**Summary:** ${signal.summary}

**Keywords:** ${signal.keywords.join(', ')}
${aspectsSection}
${entitiesSection}

## Existing Clusters

${clustersSection}

## Instructions

Based on the signal content and existing clusters, return a ClusterAssignmentDecision:
- If the signal clearly fits an existing cluster, return action "assign" with the cluster_id and your reasoning
- If the signal represents a new distinct theme, return action "create_new" with a proposed cluster name and summary

Consider:
1. Conceptual similarity (not just keyword overlap)
2. Whether the signal extends an existing theme or introduces a new one
3. The user perspective - would grouping this signal help product teams understand customer needs?

Return ONLY the JSON object, no additional text or formatting.`;
}

/**
 * Example cluster assignments for testing and documentation
 */
export const CLUSTER_ASSIGNMENT_EXAMPLES = [
  {
    input: {
      signal: {
        summary: 'User reported slow API response times when generating reports during peak hours',
        keywords: ['API performance', 'slow response', 'reports', 'peak hours', 'latency'],
        aspects: ['system performance', 'user experience', 'scalability'],
      },
      existingClusters: [
        {
          id: 'cluster-001',
          label: 'API reliability concerns',
          summary: 'Customers experiencing API timeouts, failed requests, and inconsistent response times',
          signal_count: 7,
        },
        {
          id: 'cluster-002',
          label: 'Mobile app performance',
          summary: 'Mobile app users reporting crashes, slow loading, and UI lag',
          signal_count: 4,
        },
        {
          id: 'cluster-003',
          label: 'Enterprise SSO integration',
          summary: 'Enterprise customers requesting SAML, Okta, and Azure AD integration',
          signal_count: 3,
        },
      ],
      greenhouseName: 'Product Reliability',
    },
    output: {
      action: 'assign' as const,
      cluster_id: 'cluster-001',
      reasoning:
        'This signal shares the core theme of API reliability issues with cluster-001. While it specifically mentions report generation and peak hours, the underlying concern is API performance and reliability, which is the focus of cluster-001. The signal would add valuable temporal context (peak hours) to the existing cluster.',
      confidence: 0.88,
    },
  },
  {
    input: {
      signal: {
        summary:
          'Customer requesting ability to customize dashboard widgets and rearrange layout to match their workflow',
        keywords: ['dashboard customization', 'widget configuration', 'layout', 'workflow', 'personalization'],
        aspects: ['user experience', 'flexibility', 'workflow optimization'],
      },
      existingClusters: [
        {
          id: 'cluster-001',
          label: 'API reliability concerns',
          summary: 'Customers experiencing API timeouts, failed requests, and inconsistent response times',
          signal_count: 7,
        },
        {
          id: 'cluster-002',
          label: 'Mobile app performance',
          summary: 'Mobile app users reporting crashes, slow loading, and UI lag',
          signal_count: 4,
        },
        {
          id: 'cluster-003',
          label: 'Enterprise SSO integration',
          summary: 'Enterprise customers requesting SAML, Okta, and Azure AD integration',
          signal_count: 3,
        },
      ],
      greenhouseName: 'Product Features',
    },
    output: {
      action: 'create_new' as const,
      cluster_name: 'Dashboard customization and personalization',
      cluster_summary:
        'Customers wanting to customize dashboard layouts, configure widgets, and personalize their workspace to match individual workflows',
      reasoning:
        'This signal represents a distinct theme (UI customization and personalization) not covered by any existing clusters. Cluster-001 and cluster-002 focus on performance/reliability, while cluster-003 is about authentication. The customization theme has enough conceptual weight to warrant its own cluster rather than being forced into an existing category.',
      confidence: 0.92,
    },
  },
  {
    input: {
      signal: {
        summary:
          'First signal received for this greenhouse - customer reported confusion about how to export data to CSV',
        keywords: ['data export', 'CSV', 'confusion', 'documentation'],
        aspects: ['user experience', 'data access', 'onboarding'],
      },
      existingClusters: [],
      greenhouseName: 'Customer Feedback',
    },
    output: {
      action: 'create_new' as const,
      cluster_name: 'Data export and integration',
      cluster_summary: 'Customers needing to export or integrate data with external tools and workflows',
      reasoning:
        'No existing clusters in this greenhouse. Creating the first cluster with a theme focused on data export and integration capabilities. The cluster name is intentionally slightly broader than the single signal to allow for related signals about data access patterns.',
      confidence: 0.95,
    },
  },
];
