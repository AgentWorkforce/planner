/**
 * Example integration showing how to use extraction prompts with Anthropic API
 *
 * This file demonstrates:
 * - Setting up Anthropic client
 * - Using few-shot learning with examples
 * - Calling Sonnet for signal extraction
 * - Parsing and validating results
 */

import type { ExtractionResult } from '../domain/types.js';
import {
  EXTRACTION_SYSTEM_PROMPT,
  createExtractionUserPrompt,
  EXTRACTION_EXAMPLES,
} from './extraction-prompt.js';

/**
 * Example: Extract a signal using Sonnet with few-shot learning
 *
 * Usage:
 * ```typescript
 * const result = await extractSignalExample();
 * console.log(JSON.stringify(result, null, 2));
 * ```
 */
export async function extractSignalExample(): Promise<ExtractionResult | null> {
  // In a real implementation, you would:
  // 1. Import Anthropic from '@anthropic-ai/sdk'
  // 2. Create client with API key from environment
  // 3. Call the API with the prompts below

  // This is a code example showing the structure, not executable without Anthropic SDK

  const sampleSignal = {
    title: 'Production API degradation alert',
    body: `We're seeing elevated latency on the user-service API. P95 response times have climbed from 150ms to 400-600ms over the past 2 hours. We don't have a root cause yet, but it started around 3 AM UTC.

    Queries to the accounts table are taking longer—need to investigate if it's a database issue or the new caching layer introduced in last week's deploy.

    This is affecting our enterprise customers in APAC region (peak hours for them). We're losing ~$50K/hour in SLA credits if this isn't resolved soon.`,
    author: 'oncall-platform-team',
    source: 'PagerDuty alert via Slack',
    timestamp: '2026-02-14T03:15:00Z',
  };

  // Create the user prompt for this specific signal
  const userPrompt = createExtractionUserPrompt(sampleSignal);

  // The actual API call would look like this:
  //
  // const fewShotMessages = EXTRACTION_EXAMPLES.flatMap((example) => [
  //   { role: 'user' as const, content: createExtractionUserPrompt(example.input) },
  //   { role: 'assistant' as const, content: JSON.stringify(example.output, null, 2) },
  // ]);
  //
  // const response = await anthropic.messages.create({
  //   model: 'claude-sonnet-4-latest',
  //   max_tokens: 2000,
  //   system: EXTRACTION_SYSTEM_PROMPT,
  //   messages: [
  //     ...fewShotMessages,
  //     {
  //       role: 'user',
  //       content: userPrompt,
  //     },
  //   ],
  // });
  //
  // const content = response.content[0];
  // if (content.type !== 'text') {
  //   throw new Error('Expected text response from model');
  // }
  //
  // const extractionResult = JSON.parse(content.text) as ExtractionResult;
  // return extractionResult;

  console.log('Sample Extraction User Prompt:');
  console.log('================================');
  console.log(userPrompt);
  console.log('\nFew-Shot Examples Count:', EXTRACTION_EXAMPLES.length);
  console.log('System Prompt Length:', EXTRACTION_SYSTEM_PROMPT.length, 'characters');

  // Return null since this is just an example
  return null;
}

/**
 * Example: Expected output for the sample signal above
 *
 * This demonstrates what Sonnet should produce for the production API degradation signal
 */
export const sampleSignalExpectedOutput: ExtractionResult = {
  summary:
    'Production user-service API experiencing latency degradation (P95: 400-600ms vs baseline 150ms) for ~2 hours starting 03:00 UTC; impacts APAC enterprise customers during peak hours; root cause under investigation (database or caching layer suspected)',
  keywords: [
    'API latency',
    'degradation',
    'P95 response time',
    'user-service',
    'database performance',
    'caching layer',
    'APAC region',
    'enterprise customers',
    'SLA impact',
  ],
  entities: [
    { name: 'user-service API', type: 'SERVICE' },
    { name: 'P95 latency', type: 'METRIC' },
    { name: '400-600ms', type: 'PERFORMANCE_VALUE' },
    { name: '150ms', type: 'BASELINE_VALUE' },
    { name: 'accounts table', type: 'DATABASE_OBJECT' },
    { name: 'APAC region', type: 'GEOGRAPHIC_REGION' },
    { name: '$50K/hour', type: 'FINANCIAL_IMPACT' },
    { name: 'last week deploy', type: 'EVENT' },
    { name: '2026-02-14T03:00 UTC', type: 'TIMESTAMP' },
  ],
  aspects: [
    'service reliability',
    'performance degradation',
    'production incident response',
    'customer impact',
    'SLA compliance',
    'root cause investigation',
  ],
  quotes: [
    "P95 response times have climbed from 150ms to 400-600ms over the past 2 hours",
    "Started around 3 AM UTC",
    "Queries to the accounts table are taking longer",
    "Need to investigate if it's a database issue or the new caching layer",
    "We're losing ~$50K/hour in SLA credits if this isn't resolved soon",
  ],
  questions: [
    { text: 'Is the latency spike correlated with last week\'s deploy?', is_explicit: false },
    { text: 'Need to investigate if it\'s a database issue or the new caching layer', is_explicit: true },
  ],
  reasoning:
    'This is a moderately-to-highly specific incident report (0.72): it includes quantified metrics (P95: 400-600ms vs 150ms baseline), specific component (user-service API, accounts table), start time, and estimated financial impact. However, root cause is unknown, which reduces specificity slightly. Emotional intensity is high (0.68)—clear urgency markers ("APAC peak hours", "losing ~$50K/hour", "This is affecting"), sense of business criticality, but language remains professional rather than crisis-mode. Actionability is moderate (0.54): the signal identifies the component, metrics, and suspects (database or caching layer), but lacks specific diagnostic commands or remediation steps; next action is investigation, not execution.',
  specificity: 0.72,
  emotional_intensity: 0.68,
  actionability: 0.54,
  sentiment: 'frustrated',
};

/**
 * Validation helper: Check that extracted result has all required fields
 *
 * @param result - The ExtractionResult to validate
 * @returns true if all required fields are present with correct types
 */
export function validateExtractionResult(result: unknown): result is ExtractionResult {
  if (typeof result !== 'object' || result === null) {
    return false;
  }

  const r = result as Record<string, unknown>;

  return (
    typeof r.summary === 'string' &&
    r.summary.length > 0 &&
    Array.isArray(r.keywords) &&
    r.keywords.every((k) => typeof k === 'string') &&
    Array.isArray(r.entities) &&
    r.entities.every(
      (e) => typeof e === 'object' && e !== null && typeof (e as any).name === 'string' && typeof (e as any).type === 'string'
    ) &&
    Array.isArray(r.aspects) &&
    r.aspects.every((a) => typeof a === 'string') &&
    Array.isArray(r.quotes) &&
    r.quotes.every((q) => typeof q === 'string') &&
    typeof r.reasoning === 'string' &&
    r.reasoning.length > 0 &&
    typeof r.specificity === 'number' &&
    r.specificity >= 0 &&
    r.specificity <= 1 &&
    typeof r.emotional_intensity === 'number' &&
    r.emotional_intensity >= 0 &&
    r.emotional_intensity <= 1 &&
    typeof r.actionability === 'number' &&
    r.actionability >= 0 &&
    r.actionability <= 1
  );
}

/**
 * Scoring accuracy helper: Validate that scores are justified by reasoning
 *
 * This checks for obvious mismatches between assigned scores and reasoning content.
 * Not a perfect validator, but catches gross inconsistencies.
 *
 * @param result - The ExtractionResult to check
 * @returns array of issues found (empty if no issues)
 */
export function validateScoringConsistency(result: ExtractionResult): string[] {
  const issues: string[] = [];

  // Check specificity consistency
  if (result.specificity > 0.75 && !/\d+|specific|precise|exact|concrete/.test(result.reasoning)) {
    issues.push('High specificity (>0.75) but reasoning lacks specific/precise language');
  }

  // Check emotional intensity consistency
  const urgencyKeywords = /critical|urgent|immediately|ASAP|crisis|emergency|catastrophic|UNACCEPTABLE/i;
  if (result.emotional_intensity > 0.8 && !urgencyKeywords.test(result.reasoning)) {
    issues.push('High emotional intensity (>0.8) but reasoning lacks urgency language');
  }

  if (result.emotional_intensity < 0.2 && urgencyKeywords.test(result.reasoning)) {
    issues.push('Low emotional intensity (<0.2) but reasoning contains urgency language');
  }

  // Check actionability consistency
  const actionVerbs = /deploy|implement|execute|run|configure|escalate|roll back|patch/i;
  if (result.actionability > 0.75 && !actionVerbs.test(result.reasoning)) {
    issues.push('High actionability (>0.75) but reasoning lacks action verbs');
  }

  return issues;
}
