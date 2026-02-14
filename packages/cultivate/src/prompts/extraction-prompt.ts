/**
 * Extraction Prompt Templates for Signal Analysis
 *
 * This module defines the system and user prompt templates used to instruct Sonnet
 * to analyze raw signal content and produce structured ExtractionResult objects.
 *
 * The prompts include:
 * - Clear task definition and output schema
 * - Scoring guidelines for the three dimensions (specificity, emotional_intensity, actionability)
 * - Examples of expected output format
 * - Format instructions (JSON output)
 */

/**
 * System prompt: Instructs the model on its role and responsibilities
 *
 * This prompt establishes:
 * - The task context (signal extraction for a cultivate system)
 * - The output schema (ExtractionResult structure)
 * - Quality expectations (accurate scoring, justified reasoning)
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an expert signal analyst trained to extract structured insights from raw signal content.

Your task is to analyze raw signal content (from sources like Slack, email, GitHub, etc.) and produce an ExtractionResult object with the following schema:

{
  "summary": "Brief summary of the extracted content",
  "keywords": ["array", "of", "key", "terms"],
  "entities": [
    { "name": "Entity Name", "type": "Entity Type (e.g., PERSON, ORGANIZATION, LOCATION, TECHNOLOGY)" },
    ...
  ],
  "aspects": ["Key", "themes", "or", "dimensions"],
  "quotes": ["Notable", "direct", "quotes", "from", "the", "source"],
  "reasoning": "Detailed explanation of extraction choices and key findings",
  "specificity": 0.0-1.0,
  "emotional_intensity": 0.0-1.0,
  "actionability": 0.0-1.0
}

## Extraction Guidelines

### Summary
- Concise one-sentence or two-sentence summary
- Capture the main idea or key finding
- Include relevant numbers/dates if they are critical

### Keywords
- Extract 5-15 key terms and phrases
- Include specific technical terms, product names, names of people/teams
- Avoid generic words; prioritize domain-specific language
- Order by relevance to the core signal

### Entities
- Extract named entities (people, organizations, locations, technical components, standards, etc.)
- Provide entity type classification
- Include timestamps, dollar amounts, version numbers where relevant
- Maximum 10-15 entities

### Aspects
- Identify 3-6 key themes or dimensions
- Examples: "system reliability", "user experience", "compliance", "market strategy", "operational efficiency"
- Should reflect business or technical domains relevant to the organization

### Quotes
- Extract 2-5 notable direct quotes from the source
- Preserve original wording
- Select quotes that support the summary or highlight key tensions/opportunities

### Reasoning
- Explain your extraction and scoring decisions
- Justify why specific terms were chosen as keywords
- Reference the source material in your explanation
- Address any ambiguities or interpretation challenges

## Scoring Dimensions

### 1. Specificity (0-1)

How specific, concrete, and detailed is the content versus how general, abstract, or high-level?

**Score Ranges:**
- **0.0-0.2 (Very General)**: Broad statements, generalizations, abstract concepts with no concrete details
  - Example: "The market is changing" → 0.1
  - Example: "There are challenges ahead" → 0.15

- **0.2-0.4 (General)**: Somewhat specific but still relatively high-level; lacks concrete examples or data
  - Example: "Customer satisfaction has decreased" → 0.3
  - Example: "The product needs better UX" → 0.35

- **0.4-0.6 (Moderate)**: Mixed level of detail; some concrete information but also generalizations
  - Example: "Q3 revenue declined 5-7% due to seasonal factors" → 0.55
  - Example: "API response time increased by 200-300ms under load" → 0.58

- **0.6-0.8 (Specific)**: Detailed and concrete with specific numbers, dates, names, or clear examples
  - Example: "Revenue dropped from $2.3M to $1.9M in October due to the Azure outage on Oct 15" → 0.72
  - Example: "Enterprise tier customers (5 of 7) complained about slowdowns >500ms" → 0.75

- **0.8-1.0 (Very Specific)**: Highly detailed, quantified, with precise metrics, timelines, or technical specifications
  - Example: "The Elasticsearch indexing pipeline failed on 2026-02-13 22:47 UTC, affecting 847 documents; reindexing completed in 12 minutes" → 0.92
  - Example: "P95 latency spiked to 2847ms on 2026-02-14 06:00 UTC due to 40GB RDS disk write cache overflow" → 0.95

**Scoring Tips:**
- Count mentions of specific numbers, percentages, dates, names, precise metrics
- Deduct points for vague language: "some", "many", "usually", "approximately", "might"
- Technical jargon can be specific but verify it conveys clear meaning
- Context matters: "5% growth" is specific; "significant growth" is not

### 2. Emotional Intensity (0-1)

The degree of emotional charge, urgency, or affective weight expressed in the content.

**Score Ranges:**
- **0.0-0.2 (Neutral)**: Purely factual, detached tone; no emotional markers or urgency cues
  - Example: "Average response time was 250ms" → 0.05
  - Example: "Three departments participated in the survey" → 0.08

- **0.2-0.4 (Low Emotional Tone)**: Mild concern or interest; subtle emotional markers; professional but not urgent
  - Example: "We should consider improving our dashboard performance" → 0.25
  - Example: "It would be good to have better documentation" → 0.3

- **0.4-0.6 (Moderate Emotional Tone)**: Clear emotional markers; noticeable concern, frustration, or interest; sense of importance
  - Example: "We're frustrated with the repeated outages affecting our users" → 0.52
  - Example: "Customers are disappointed with feature delays" → 0.48

- **0.6-0.8 (High Emotional Tone)**: Strong emotional markers; significant urgency, concern, excitement, or frustration
  - Example: "This is critical—we're losing customers every day due to stability issues!" → 0.72
  - Example: "The team is extremely frustrated with constant context switching" → 0.68

- **0.8-1.0 (Very High Emotional Tone)**: Intense emotional expression; crisis language, strong urgency, or extreme enthusiasm
  - Example: "We're FAILING our customers! This outage is UNACCEPTABLE!" → 0.88
  - Example: "This is a catastrophic security breach that could destroy the company!" → 0.95

**Scoring Tips:**
- Identify emotional indicators: exclamation marks, ALL CAPS, emotional verbs (frustrated, thrilled, devastated)
- Assess urgency language: "critical", "urgent", "immediately", "ASAP" → higher scores
- Positive and negative emotional intensity score equally
- Factor in context: distinguish between legitimate urgency (security breach) and hyperbole (minor issue)

### 3. Actionability (0-1)

The degree to which the content provides clear, specific guidance that can be acted upon by relevant stakeholders.

**Score Ranges:**
- **0.0-0.2 (Not Actionable)**: No clear path to action; purely observational or informational; no implied next steps
  - Example: "The market trends are shifting" → 0.05
  - Example: "The system was down for 30 minutes" → 0.1

- **0.2-0.4 (Weakly Actionable)**: Implied action but vague or unclear; would require significant interpretation
  - Example: "We should probably improve our monitoring" → 0.28
  - Example: "Consider investigating the database performance" → 0.32

- **0.4-0.6 (Moderately Actionable)**: Clear action implied but missing implementation details or clear assignment
  - Example: "Reduce API response time from 250ms to under 100ms" → 0.52
  - Example: "Add validation to prevent null values in forms" → 0.55

- **0.6-0.8 (Highly Actionable)**: Specific, clear action with most details needed; mostly ready for implementation or assignment
  - Example: "Roll back to the 2.4.1 build from 2026-02-01; it doesn't have the regression affecting P95 latency" → 0.76
  - Example: "Disable the new caching layer in CDN config and revert to previous TTL settings" → 0.72

- **0.8-1.0 (Fully Actionable)**: Complete, specific guidance ready for immediate execution with minimal interpretation
  - Example: "Run 'npm run migrate:prod -- --version=42' to fix schema conflict, then restart API with FORCE_REBUILD=true" → 0.92
  - Example: "Deploy commit a3f9c2 to staging, run integration tests with --timeout=5000, monitor metrics for 30min, then deploy to production" → 0.88

**Scoring Tips:**
- Look for specificity of "who" (role), "what" (concrete action), "how" (implementation details)
- Action verbs matter: "consider" (low) vs. "deploy" (high) vs. "must" (high)
- Missing information reduces score: "Fix the bug" (0.3) vs. "Apply this patch" (0.8)
- Implementation blockers (waiting for decisions, unknown dependencies) reduce actionability
- Consider skill/knowledge required: "Run this script" is actionable; "Redesign architecture" less so

## Quality Standards

1. **Accuracy**: All extracted information must be directly supported by the source material
2. **Completeness**: Capture all key information needed to understand the signal
3. **Consistency**: Ensure reasoning aligns with assigned scores
4. **Balance**: Avoid over-interpreting or under-interpreting content

## Output Format

Always return valid JSON matching the ExtractionResult schema. Do not include markdown formatting, code blocks, or explanatory text outside the JSON object.`;

/**
 * User prompt template: Instructs the model to analyze specific signal content
 *
 * This prompt includes:
 * - The raw signal content to analyze
 * - Any metadata about the signal (source type, channel, timestamp)
 * - Explicit instructions to output JSON
 */
export function createExtractionUserPrompt(options: {
  title: string;
  body: string;
  author?: string;
  source?: string;
  timestamp?: string;
}): string {
  const { title, body, author = 'Unknown', source = 'Unknown', timestamp = 'Unknown' } = options;

  return `Analyze the following signal and extract a structured ExtractionResult.

**Signal Metadata:**
- Title: ${title}
- Author: ${author}
- Source: ${source}
- Timestamp: ${timestamp}

**Signal Content:**
${body}

Please extract a complete ExtractionResult object with all required fields. Ensure your scoring (specificity, emotional_intensity, actionability) is justified by the content as presented, not by what *should* be done.

Return ONLY the JSON object, no additional text or formatting.`;
}

/**
 * Example extraction input and output for few-shot learning
 *
 * Use these examples in prompts to show the model the expected output format
 */
export const EXTRACTION_EXAMPLES = [
  {
    input: {
      title: 'Database outage incident',
      body: 'The production database went down this morning at 06:30 UTC. We identified the root cause as an Elasticsearch index corruption on the users table due to disk write cache overflow. The index corruption filled 98% of disk capacity within 12 minutes. The SRE team ran pg_upgrade and completed reindexing in 8 minutes with zero data loss. Total outage duration was 47 minutes (06:30-07:17 UTC). The root cause was traced to a missed index maintenance window from February 10.',
      author: 'SRE Team',
      source: 'Slack #incidents',
      timestamp: '2026-02-14T07:30:00Z',
    },
    output: {
      summary:
        'Database outage on 2026-02-14 06:30-07:17 UTC (47 minutes); primary cause: Elasticsearch index corruption on users table due to disk write cache overflow; reindexing completed successfully',
      keywords: [
        'database outage',
        'Elasticsearch',
        'index corruption',
        'disk write cache overflow',
        'pg_upgrade',
        'incident response',
        'SRE team',
        'users table',
      ],
      entities: [
        { name: 'Elasticsearch', type: 'TECHNOLOGY' },
        { name: '2026-02-14 06:30 UTC', type: 'TIMESTAMP' },
        { name: 'users table', type: 'DATABASE_OBJECT' },
        { name: '47 minutes', type: 'DURATION' },
        { name: '98% disk capacity', type: 'METRIC' },
        { name: '12 minutes', type: 'DURATION' },
        { name: 'SRE Team', type: 'TEAM' },
      ],
      aspects: [
        'system reliability',
        'performance degradation',
        'operational response',
        'root cause analysis',
        'data integrity',
      ],
      quotes: [
        'Disk write cache filled to 98% capacity within 12 minutes',
        'Index corruption detected during reindexing',
        'Reindexing completed in 8 minutes with zero data loss',
        'Root cause: missed index maintenance window from Feb 10',
      ],
      reasoning:
        'This is a detailed incident report with specific timestamps, affected components, duration metrics, and identified root cause. Specificity is very high (0.88) due to precise quantification (47 min duration, 98% capacity, 8 min reindex). Emotional intensity is moderate (0.48)—factual but acknowledges business impact and operational urgency. Actionability is high (0.82) because it identifies the exact problem and remediation steps taken, providing clear guidance for preventing recurrence by addressing the missed maintenance window.',
      specificity: 0.88,
      emotional_intensity: 0.48,
      actionability: 0.82,
    },
  },
  {
    input: {
      title: 'Customer feedback on performance',
      body: 'The app feels slower these days when I use the reports feature. This happens mostly in the evenings when more people are online. Maybe there are bottlenecks somewhere? I really like the product but this slowness is getting annoying.',
      author: 'Customer (Enterprise)',
      source: 'Email',
      timestamp: '2026-02-13T14:22:00Z',
    },
    output: {
      summary:
        'Customer reported application slowness in the reports feature, particularly during peak evening hours; impact on user experience and satisfaction',
      keywords: ['performance', 'slowness', 'reports feature', 'peak hours', 'user experience', 'concern'],
      entities: [
        { name: 'reports feature', type: 'FEATURE' },
        { name: 'evening hours', type: 'TIME_PERIOD' },
      ],
      aspects: ['user experience', 'application performance', 'feature responsiveness', 'scalability'],
      quotes: [
        'The app feels slower these days',
        'This happens mostly in the evenings when more people are online',
        'This slowness is getting annoying',
        'I really like the product',
      ],
      reasoning:
        'This feedback lacks specificity (no metrics, latency measurements, or affected endpoints) but provides temporal context (evenings = peak hours). Emotional intensity is moderate (0.38)—customer is concerned and annoyed but not in crisis mode, and acknowledges product value. Actionability is low (0.18) because there is no clear guidance on which components to optimize or performance targets to hit; requires follow-up investigation to understand whether this is client-side rendering, network latency, or server-side degradation.',
      specificity: 0.22,
      emotional_intensity: 0.38,
      actionability: 0.18,
    },
  },
  {
    input: {
      title: 'CRITICAL: SQL injection vulnerability',
      body: 'ALERT: We have discovered a CRITICAL SQL injection vulnerability in the user authentication form. An attacker can bypass authentication and gain unauthorized access to any user account. This is a severe security breach risk. Patches have been developed and tested. This must be deployed to production IMMEDIATELY. CVE-2026-1234.',
      author: 'Security Team',
      source: 'Email (Priority)',
      timestamp: '2026-02-14T09:15:00Z',
    },
    output: {
      summary:
        'CRITICAL: SQL injection vulnerability in user authentication form allows authentication bypass and unauthorized account access; patches available and tested',
      keywords: [
        'SQL injection',
        'security vulnerability',
        'authentication bypass',
        'CRITICAL',
        'CVE-2026-1234',
        'urgent',
        'data breach',
      ],
      entities: [
        { name: 'user authentication form', type: 'COMPONENT' },
        { name: 'SQL injection', type: 'VULNERABILITY_TYPE' },
        { name: 'CVE-2026-1234', type: 'CVE_IDENTIFIER' },
        { name: 'Security Team', type: 'TEAM' },
      ],
      aspects: ['security', 'authentication', 'data protection', 'urgent incident response', 'vulnerability management'],
      quotes: [
        'CRITICAL SQL injection vulnerability',
        'Attacker can bypass authentication and gain unauthorized access to any user account',
        'This is a severe security breach risk',
        'Patches have been developed and tested',
        'This must be deployed IMMEDIATELY',
      ],
      reasoning:
        'This alert combines high specificity (0.78)—identifies exact component, vulnerability type, and CVE identifier—with very high emotional intensity (0.92) due to crisis language (CRITICAL, ALL CAPS, "IMMEDIATELY"). Actionability is high (0.72) because it clearly states what the threat is and that patches exist, though specific deployment procedures and rollback steps would increase actionability further.',
      specificity: 0.78,
      emotional_intensity: 0.92,
      actionability: 0.72,
    },
  },
];
