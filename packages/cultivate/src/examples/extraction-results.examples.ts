/**
 * Example ExtractionResult objects demonstrating the schema and scoring dimensions.
 * Use these examples for:
 * - LLM few-shot prompting
 * - Test fixtures and validation
 * - Documentation and onboarding
 * - Quality assurance of scoring accuracy
 */

import type { ExtractionResult } from '../domain/types.js';

/**
 * Critical incident report with high specificity and actionability
 * Ideal for escalation and immediate action
 */
export const criticalIncidentReport: ExtractionResult = {
  summary:
    'Database outage on 2026-02-14 06:30-07:17 UTC (47 minutes); primary cause: Elasticsearch index corruption on users table',
  keywords: [
    'database outage',
    'Elasticsearch',
    'index corruption',
    'disk write cache overflow',
    'incident response',
    'users table',
  ],
  entities: [
    {
      name: 'Elasticsearch',
      type: 'TECHNOLOGY',
    },
    {
      name: '2026-02-14 06:30 UTC',
      type: 'TIMESTAMP',
    },
    {
      name: 'users table',
      type: 'DATABASE_OBJECT',
    },
    {
      name: '47 minutes',
      type: 'DURATION',
    },
    {
      name: 'SRE Team',
      type: 'TEAM',
    },
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
    'This is a detailed, quantified incident report. Specificity is high due to precise timestamps, affected components, duration metrics, and identified root cause. Emotional intensity is moderate - factual but acknowledges business impact and corrective action needed. Actionability is high because it identifies the exact problem and remediation steps taken, providing clear guidance for preventing recurrence.',
  specificity: 0.88,
  emotional_intensity: 0.48,
  actionability: 0.82,
};

/**
 * Vague customer feedback with low specificity and actionability
 * Requires follow-up investigation before action can be taken
 */
export const vagueCustomerFeedback: ExtractionResult = {
  summary:
    'Customer reported that the application feels slower when using certain features, especially during peak hours',
  keywords: [
    'performance',
    'responsiveness',
    'customer concern',
    'features',
    'peak hours',
    'slowness',
  ],
  entities: [
    {
      name: 'customer',
      type: 'ROLE',
    },
    {
      name: 'peak hours',
      type: 'TIME_PERIOD',
    },
  ],
  aspects: [
    'user experience',
    'application performance',
    'feature usability',
    'scalability',
  ],
  quotes: [
    'The app feels slower lately',
    'Some features are really sluggish',
    'This happens mostly in the evenings',
  ],
  reasoning:
    'This feedback lacks specificity - no metrics, feature names, or quantified performance degradation. Emotional intensity is moderate; the customer is concerned but using measured language rather than crisis urgency. Actionability is low because there is no clear guidance on which features to optimize, what performance targets to hit, or whether this is client-side or server-side.',
  specificity: 0.22,
  emotional_intensity: 0.38,
  actionability: 0.18,
};

/**
 * Security vulnerability alert with urgent language and clear remediation
 * High emotional intensity and actionability; moderate specificity on root cause
 */
export const securityVulnerabilityAlert: ExtractionResult = {
  summary:
    'CRITICAL: SQL injection vulnerability in user authentication form allows authentication bypass and unauthorized account access',
  keywords: [
    'SQL injection',
    'security vulnerability',
    'authentication bypass',
    'CRITICAL',
    'authentication form',
    'data breach risk',
  ],
  entities: [
    {
      name: 'user authentication form',
      type: 'COMPONENT',
    },
    {
      name: 'SQL injection',
      type: 'VULNERABILITY_TYPE',
    },
    {
      name: 'CVE-2026-1234',
      type: 'IDENTIFIER',
    },
  ],
  aspects: [
    'security',
    'authentication',
    'data protection',
    'urgent incident response',
    'compliance violation',
  ],
  quotes: [
    'This is a CRITICAL vulnerability',
    'Attacker can bypass authentication and access any user account',
    'Patches available and tested',
    'Deploy to production immediately',
  ],
  reasoning:
    'This alert combines high specificity (identifies exact component and vulnerability type) with very high emotional intensity (crisis language, CRITICAL markers, urgency indicators). Actionability is high - clearly stating what the threat is and that patches exist - though implementation details on deployment procedures could be more explicit.',
  specificity: 0.78,
  emotional_intensity: 0.92,
  actionability: 0.72,
};

/**
 * Strategic market insight with business impact and clear implications
 * Moderately specific, low emotional intensity, high actionability
 */
export const strategicMarketInsight: ExtractionResult = {
  summary:
    'Enterprise customers are now requiring multi-tenant data isolation and SOC 2 Type II compliance as baseline requirements; this is affecting deal closure for >$500K ARR opportunities',
  keywords: [
    'enterprise',
    'multi-tenant',
    'SOC 2 Type II',
    'compliance',
    'sales',
    'deal closure',
    'market requirement',
  ],
  entities: [
    {
      name: 'Enterprise segment',
      type: 'CUSTOMER_SEGMENT',
    },
    {
      name: '$500K+ ARR',
      type: 'REVENUE_THRESHOLD',
    },
    {
      name: 'SOC 2 Type II',
      type: 'COMPLIANCE_STANDARD',
    },
  ],
  aspects: [
    'product strategy',
    'market positioning',
    'compliance requirements',
    'sales enablement',
    'competitive differentiation',
  ],
  quotes: [
    'We are hearing this from all our enterprise prospects',
    'It has become table-stakes for enterprise deals',
    'Competitors are advertising their SOC 2 Type II status',
    'Sales cycle is extending 2-3 weeks waiting on compliance review',
  ],
  reasoning:
    'This insight is moderately specific, providing concrete revenue thresholds and compliance standards but lacking detailed metrics on deal impact. Emotional intensity is low - professional and objective. Actionability is high because it clearly signals product investment priorities and business justification for resource allocation.',
  specificity: 0.68,
  emotional_intensity: 0.18,
  actionability: 0.76,
};

/**
 * Developer experience issue with unclear scope and proposed solution
 * Low specificity, moderate emotional intensity, low actionability
 */
export const developerExperienceIssue: ExtractionResult = {
  summary:
    'New build system is confusing for developers; onboarding is slower, and there are occasional mysterious build failures',
  keywords: [
    'build system',
    'developer experience',
    'tooling',
    'confusion',
    'onboarding',
    'build failures',
  ],
  entities: [
    {
      name: 'developers',
      type: 'ROLE',
    },
  ],
  aspects: ['developer tooling', 'onboarding experience', 'build reliability', 'process efficiency'],
  quotes: [
    'The new build system is confusing',
    'Onboarding is taking longer',
    'We get mysterious build failures sometimes',
    'We are working through the issues',
  ],
  reasoning:
    'This feedback is low specificity - no metrics on onboarding time, no specific build failure descriptions, no root cause analysis. Emotional intensity is moderate; frustration is evident but not crisis-level. Actionability is low; while the issue is acknowledged, there is no clear guidance on what specifically needs fixing or what success looks like.',
  specificity: 0.28,
  emotional_intensity: 0.42,
  actionability: 0.22,
};

/**
 * Feature request with business context and clear requirements
 * High specificity, moderate-low emotional intensity, high actionability
 */
export const featureRequest: ExtractionResult = {
  summary:
    'Request to add bulk export functionality for reports; customers want to export 500+ reports to CSV or Parquet for analysis in external tools',
  keywords: [
    'feature request',
    'bulk export',
    'CSV',
    'Parquet',
    'reports',
    'customer request',
    'data accessibility',
  ],
  entities: [
    {
      name: 'bulk export',
      type: 'FEATURE',
    },
    {
      name: 'CSV',
      type: 'FILE_FORMAT',
    },
    {
      name: 'Parquet',
      type: 'FILE_FORMAT',
    },
    {
      name: '500+ reports',
      type: 'SCALE_METRIC',
    },
  ],
  aspects: [
    'product features',
    'data accessibility',
    'integration capabilities',
    'customer satisfaction',
    'workflow efficiency',
  ],
  quotes: [
    'Multiple customers have requested bulk export',
    'They want to export 500+ reports at once',
    'CSV and Parquet formats would cover most use cases',
    'This would enable external analysis workflows',
  ],
  reasoning:
    'This request is fairly specific - identifies exact feature, supported formats, and usage patterns. Emotional intensity is low-moderate; it is a normal feature request without urgency markers. Actionability is high because it clearly defines what is wanted (bulk export), acceptable output formats, and implied use cases.',
  specificity: 0.72,
  emotional_intensity: 0.25,
  actionability: 0.78,
};

/**
 * Ambiguous performance statement combining multiple dimensions
 * Moderate-high specificity, high emotional intensity, moderate actionability
 */
export const ambiguousPerformanceStatement: ExtractionResult = {
  summary:
    'API performance is concerning us - it was fast six months ago but now feels bloated and slow; no one seems to know why',
  keywords: [
    'API performance',
    'degradation',
    'bloat',
    'regression',
    'investigation',
    'root cause unknown',
  ],
  entities: [
    {
      name: 'API',
      type: 'COMPONENT',
    },
    {
      name: '6 months ago',
      type: 'TIME_REFERENCE',
    },
  ],
  aspects: [
    'system performance',
    'code quality',
    'operational visibility',
    'technical debt',
    'monitoring',
  ],
  quotes: [
    'It was fast six months ago',
    'Now feels bloated and slow',
    'No one seems to know why',
    'This is concerning us',
  ],
  reasoning:
    'This statement is moderately specific - it identifies the component (API) and time frame (6 months) but lacks quantitative metrics (latency targets, actual response times). Emotional intensity is high (concern, frustration). Actionability is moderate; the concern is clear but the path to investigation and resolution is vague - needs performance profiling and baseline data collection.',
  specificity: 0.54,
  emotional_intensity: 0.68,
  actionability: 0.52,
};

/**
 * Operational runbook with detailed, actionable guidance
 * Very high specificity and actionability; low emotional intensity
 */
export const operationalRunbook: ExtractionResult = {
  summary:
    'Database recovery procedure after disk failure: stop API servers, run pg_upgrade -d /data/primary -D /data/standby, verify consistency, promote standby, restart API with FORCE_SYNC=true',
  keywords: [
    'database recovery',
    'disk failure',
    'pg_upgrade',
    'promotion',
    'operational procedure',
    'downtime mitigation',
  ],
  entities: [
    {
      name: 'pg_upgrade',
      type: 'TOOL',
    },
    {
      name: 'API servers',
      type: 'COMPONENT',
    },
    {
      name: '/data/primary, /data/standby',
      type: 'FILE_PATH',
    },
    {
      name: 'FORCE_SYNC=true',
      type: 'CONFIGURATION',
    },
  ],
  aspects: [
    'disaster recovery',
    'operational procedures',
    'data consistency',
    'availability',
    'failover management',
  ],
  quotes: [
    'Stop API servers before running upgrade',
    'Run pg_upgrade -d /data/primary -D /data/standby',
    'Verify consistency check passes before promotion',
    'Restart API with FORCE_SYNC=true to catch up',
  ],
  reasoning:
    'This is a detailed operational runbook with very high specificity - exact commands, file paths, and configuration parameters. Emotional intensity is low; it is a neutral procedural document. Actionability is very high; this can be executed as written with minimal interpretation.',
  specificity: 0.94,
  emotional_intensity: 0.12,
  actionability: 0.9,
};

/**
 * Collection of all examples for reference and testing
 */
export const allExamples: Record<string, ExtractionResult> = {
  criticalIncidentReport,
  vagueCustomerFeedback,
  securityVulnerabilityAlert,
  strategicMarketInsight,
  developerExperienceIssue,
  featureRequest,
  ambiguousPerformanceStatement,
  operationalRunbook,
};
