# Cluster Assignment Prompt Design

## Overview

The cluster assignment system uses Claude Haiku to intelligently assign incoming signals to existing thematic clusters or recommend creating new clusters. This document describes the prompt design, structured output mechanism, and decision framework.

## Architecture

### Components

1. **System Prompt** (`CLUSTER_ASSIGNMENT_SYSTEM_PROMPT`)
   - Establishes the role: product theme analyst using grounded theory
   - Defines decision framework (assign vs. create new)
   - Provides quality standards for classification

2. **User Prompt Template** (`createClusterAssignmentUserPrompt`)
   - Formats signal data (summary, keywords, aspects, entities)
   - Lists existing clusters with labels and summaries
   - Includes greenhouse context for isolation

3. **Structured Output Tool** (`CLUSTER_ASSIGNMENT_TOOL`)
   - JSON schema for guaranteed response shape
   - Discriminated union on `action` field
   - Two action types: `assign` | `create_new`

4. **Validation Schema** (`ClusterAssignmentDecisionSchema`)
   - Zod schema matching the tool definition
   - Type-safe validation of LLM responses
   - Runtime guarantee of correct structure

## Structured Output Design

### Why Tool-Based Structured Output?

The implementation uses Anthropic's tool calling mechanism to **guarantee response shape**:

```typescript
response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: CLUSTER_ASSIGNMENT_SYSTEM_PROMPT,
  tools: [CLUSTER_ASSIGNMENT_TOOL],  // ← Enforces structure
  messages: [{ role: 'user', content: userPrompt }],
});
```

**Benefits:**
- **Guaranteed structure**: Model must return data matching the tool schema
- **No parsing errors**: No manual JSON parsing from freeform text
- **Type safety**: Direct mapping to TypeScript types
- **Reliability**: Eliminates "JSON in markdown" or malformed response issues

### Response Structure

The tool guarantees one of two response shapes:

#### Action: `assign`
```typescript
{
  action: "assign",
  cluster_id: "uuid-of-existing-cluster",
  reasoning: "Brief explanation of why this cluster fits",
  confidence: 0.88,  // 0.0-1.0
  also_related?: ["other-cluster-id"]  // Optional: secondary relationships
}
```

#### Action: `create_new`
```typescript
{
  action: "create_new",
  cluster_name: "Concise theme name (3-6 words)",
  cluster_summary: "Brief description of the new cluster",
  reasoning: "Explanation of why a new cluster is needed",
  confidence: 0.92  // 0.0-1.0
}
```

## Decision Framework

### Grounded Theory Principles

The system prompt instructs Haiku to apply grounded theory clustering:

1. **Themes emerge from data** - Clusters are not predefined categories but patterns that naturally arise
2. **Conceptual coherence** - Signals should share core concepts, not just keywords
3. **Actionable grouping** - Clusters represent themes that product teams can act on as a unit

### Assignment Criteria

**When to assign to existing cluster:**
- Signal shares core concepts with existing cluster
- Signal represents an instance/variation of an existing theme
- Signal adds meaningful context to existing cluster
- Underlying need is the same even if keywords differ

**When to create new cluster:**
- Signal introduces genuinely new theme not present in existing clusters
- Signal is conceptually distinct from all existing clusters
- Forcing assignment would dilute thematic coherence
- Signal represents start of potentially important new pattern

### Confidence Scoring

The model provides confidence scores (0.0-1.0) for transparency:

**For assignments:**
- **0.9-1.0**: Strong conceptual match, clear fit
- **0.7-0.9**: Good match with minor differences
- **0.5-0.7**: Reasonable fit but some ambiguity
- **0.3-0.5**: Weak match, consider new cluster
- **0.0-0.3**: Poor fit, should create new

**For new clusters:**
- **0.9-1.0**: Clearly distinct theme
- **0.7-0.9**: Likely new with some adjacency
- **0.5-0.7**: Borderline decision
- **0.3-0.5**: Uncertain, probably assign
- **0.0-0.3**: Weak case, should assign instead

## Greenhouse Isolation

The system enforces **strict Greenhouse isolation**:

1. Only fetches clusters belonging to the target `greenhouse_id`
2. Never mixes signals from different greenhouses
3. Validates returned `cluster_id` belongs to target greenhouse
4. Throws error on isolation violations

This ensures:
- Thematic coherence per greenhouse topic
- No cross-contamination between unrelated signal streams
- Predictable clustering behavior per domain

## Input Data

### Signal Extraction Data

The prompt receives the following from the extraction tier:

```typescript
{
  summary: string;           // High-level summary of the signal
  keywords: string[];        // Key terms and concepts
  aspects?: string[];        // Thematic aspects (optional)
  entities?: Array<{         // Named entities (optional)
    name: string;
    type: string;
  }>;
}
```

### Existing Clusters

For context, the prompt includes all existing clusters in the greenhouse:

```typescript
{
  id: string;           // UUID for assignment
  label: string;        // Human-readable cluster name
  summary: string;      // AI-generated cluster description
  signal_count?: number; // Number of signals (optional)
}
```

### Greenhouse Context

The `greenhouseName` provides topical context:
- "Product Feedback"
- "Customer Support Tickets"
- "Feature Requests"
- etc.

This helps Haiku understand the domain for better thematic alignment.

## Quality Standards

The system prompt enforces these quality expectations:

1. **Thematic coherence**: Prioritize conceptual similarity over keyword matching
2. **User perspective**: Think from the perspective of someone scanning cluster themes
3. **Avoid over-clustering**: Don't create new clusters for every slight variation
4. **Avoid under-clustering**: Don't force unrelated signals together
5. **Consistency**: Similar signals should consistently land in the same cluster

## Error Handling

All clustering failures are wrapped in `SignalProcessingError` for BullMQ:

```typescript
try {
  decision = ClusterAssignmentDecisionSchema.parse(toolUseBlock.input);
} catch (parseError) {
  throw new SignalProcessingError('tier3-clustering', signal_id, cause);
}
```

**Error scenarios:**
- API errors (network, auth, rate limits)
- Unexpected response format (no tool_use block)
- Schema validation failures
- Cluster isolation violations

BullMQ worker catches these for retry and dead-letter routing.

## Examples

### Example 1: Assign to Existing Cluster

**Input:**
- Signal: "User reported slow API response times when generating reports during peak hours"
- Keywords: ['API performance', 'slow response', 'reports', 'peak hours', 'latency']
- Existing: "API reliability concerns" cluster with 7 signals

**Output:**
```json
{
  "action": "assign",
  "cluster_id": "cluster-001",
  "reasoning": "Signal shares core theme of API performance with existing cluster. Peak hours context adds temporal dimension to reliability concerns.",
  "confidence": 0.88
}
```

### Example 2: Create New Cluster

**Input:**
- Signal: "Customer requesting ability to customize dashboard widgets and rearrange layout"
- Keywords: ['dashboard customization', 'widget configuration', 'layout', 'workflow']
- Existing: "API reliability concerns", "Mobile app performance", "Enterprise SSO"

**Output:**
```json
{
  "action": "create_new",
  "cluster_name": "Dashboard customization and personalization",
  "cluster_summary": "Customers wanting to customize dashboard layouts and personalize workspace",
  "reasoning": "Distinct UI customization theme not covered by existing clusters (which focus on performance and auth).",
  "confidence": 0.92
}
```

### Example 3: First Cluster in Greenhouse

**Input:**
- Signal: "Customer reported confusion about how to export data to CSV"
- Keywords: ['data export', 'CSV', 'confusion', 'documentation']
- Existing: [] (empty - first signal)

**Output:**
```json
{
  "action": "create_new",
  "cluster_name": "Data export and integration",
  "cluster_summary": "Customers needing to export or integrate data with external tools",
  "reasoning": "No existing clusters. Creating first cluster with slightly broader theme to accommodate future related signals.",
  "confidence": 0.95
}
```

## Implementation Notes

### Model Selection

- Default: `claude-haiku-4-5-20251001`
- Fast, cost-effective for classification tasks
- Structured output ensures reliability despite smaller model

### Token Budget

- Max tokens: 1024 (sufficient for decision + reasoning)
- Typical response: 100-200 tokens
- Tool calling overhead: ~50 tokens

### Performance Characteristics

- Latency: ~500ms-1s per classification
- Accuracy: High (95%+) with structured output
- Cost: ~$0.0001 per signal (Haiku pricing)

## Future Enhancements

Potential improvements to consider:

1. **Multi-cluster assignment**: Allow signal to belong to multiple clusters
2. **Cluster merging**: Detect when two clusters are conceptually similar
3. **Cluster splitting**: Identify when a cluster has diverged into sub-themes
4. **Confidence-based review**: Flag low-confidence decisions for human review
5. **Learning from corrections**: Use manual reassignments to improve future decisions

## Related Documentation

- [Signal Extraction Design](./EXTRACTION_DESIGN.md) - Upstream tier
- [Cluster Creation](../clustering/create.ts) - Downstream tier
- [Greenhouse Isolation](../storage/README.md#greenhouse-isolation) - Storage patterns
