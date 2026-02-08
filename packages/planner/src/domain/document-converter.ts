/**
 * Document-to-Plan Converter
 *
 * Converts parsed document structure into plan steps with scopes.
 * Uses heuristics to:
 * - Identify scopes from section context
 * - Enrich step descriptions from section content
 * - Infer dependencies between steps
 *
 * For full AI-powered conversion, this module provides the structure
 * that can be enhanced by an LLM service.
 */

import type { ParsedDocument, ParsedSection } from './document-parser.js';
import type { Step } from './step.js';
import { randomUUID } from 'crypto';

/**
 * Extracted step from document.
 */
export interface ExtractedStep {
  /** Generated step ID */
  step_id: string;
  /** Step title from section header */
  title: string;
  /** Step description from section content */
  description: string;
  /** Inferred scope (if detected) */
  scope?: string;
  /** Inferred dependencies (step_ids) */
  dependencies: string[];
  /** Original section level (for ordering context) */
  level: number;
}

/**
 * Scope with its steps.
 */
export interface ExtractedScope {
  /** Scope identifier */
  id: string;
  /** Display name */
  name: string;
  /** Steps in this scope */
  steps: ExtractedStep[];
}

/**
 * Extracted plan structure.
 */
export interface ExtractedPlan {
  /** Inferred goal from document */
  goal: string;
  /** Context from document metadata or description */
  context?: string;
  /** Identified scopes */
  scopes: ExtractedScope[];
  /** Flat list of all steps (for plans without scopes) */
  steps: ExtractedStep[];
  /** Document metadata for reference */
  metadata?: Record<string, unknown>;
}

/**
 * Known scope keywords to detect from content.
 */
const SCOPE_KEYWORDS: Record<string, string[]> = {
  backend: ['api', 'server', 'database', 'endpoint', 'rest', 'graphql', 'backend', 'service'],
  frontend: ['ui', 'frontend', 'react', 'vue', 'component', 'page', 'client', 'css', 'html'],
  infrastructure: ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'aws', 'terraform', 'infra'],
  database: ['schema', 'migration', 'sql', 'postgres', 'mysql', 'mongodb', 'data model'],
  testing: ['test', 'spec', 'e2e', 'unit test', 'integration test', 'qa'],
  documentation: ['doc', 'readme', 'documentation', 'guide', 'tutorial'],
};

/**
 * Dependency keywords that suggest ordering.
 */
const DEPENDENCY_KEYWORDS = [
  'after',
  'depends on',
  'requires',
  'following',
  'once',
  'when complete',
  'prerequisite',
];

/**
 * Infer scope from section title and content.
 */
function inferScope(title: string, content: string): string | undefined {
  const text = `${title} ${content}`.toLowerCase();

  for (const [scope, keywords] of Object.entries(SCOPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return scope;
      }
    }
  }

  return undefined;
}

/**
 * Extract a clean title from section header.
 * Removes numbering, special characters, etc.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/^\d+[.)]\s*/, '') // Remove leading numbers
    .replace(/^[-*]\s*/, '') // Remove bullet points
    .replace(/\[.*?\]\(.*?\)/, '') // Remove markdown links
    .trim();
}

/**
 * Truncate description to reasonable length.
 */
function truncateDescription(content: string, maxLength = 500): string {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\n+/g, ' ') // Collapse newlines
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength - 3) + '...';
}

/**
 * Look for dependency hints in content.
 */
function findDependencyHints(content: string, allTitles: string[]): string[] {
  const text = content.toLowerCase();
  const hints: string[] = [];

  // Check for explicit references to other steps
  for (const title of allTitles) {
    const lowerTitle = title.toLowerCase();
    for (const keyword of DEPENDENCY_KEYWORDS) {
      if (text.includes(`${keyword} ${lowerTitle}`) || text.includes(`${lowerTitle} ${keyword}`)) {
        hints.push(title);
        break;
      }
    }
  }

  return hints;
}

/**
 * Convert sections to extracted steps.
 */
function sectionsToSteps(sections: ParsedSection[]): ExtractedStep[] {
  const steps: ExtractedStep[] = [];
  const titleToId = new Map<string, string>();
  const allTitles = sections.map((s) => cleanTitle(s.title));

  // First pass: create steps
  for (const section of sections) {
    const title = cleanTitle(section.title);
    if (!title) continue;

    const stepId = randomUUID();
    titleToId.set(title.toLowerCase(), stepId);

    const step: ExtractedStep = {
      step_id: stepId,
      title,
      description: truncateDescription(section.content),
      scope: inferScope(title, section.content),
      dependencies: [],
      level: section.level,
    };

    steps.push(step);
  }

  // Second pass: resolve dependency hints
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const step = steps[i]!;
    const hints = findDependencyHints(section.content, allTitles);

    for (const hint of hints) {
      const depId = titleToId.get(hint.toLowerCase());
      if (depId && depId !== step.step_id) {
        step.dependencies.push(depId);
      }
    }
  }

  // Third pass: infer sequential dependencies from document order
  // If no explicit dependencies, steps at same level depend on previous same-level step
  let previousByLevel: Record<number, string> = {};
  for (const step of steps) {
    if (step.dependencies.length === 0) {
      const prevId = previousByLevel[step.level];
      if (prevId) {
        step.dependencies.push(prevId);
      }
    }
    previousByLevel[step.level] = step.step_id;
  }

  return steps;
}

/**
 * Group steps by scope.
 */
function groupByScope(steps: ExtractedStep[]): ExtractedScope[] {
  const scopeMap = new Map<string, ExtractedStep[]>();
  const ungrouped: ExtractedStep[] = [];

  for (const step of steps) {
    if (step.scope) {
      const existing = scopeMap.get(step.scope) || [];
      existing.push(step);
      scopeMap.set(step.scope, existing);
    } else {
      ungrouped.push(step);
    }
  }

  const scopes: ExtractedScope[] = [];

  // Add scoped groups
  for (const [scopeId, scopeSteps] of scopeMap) {
    scopes.push({
      id: scopeId,
      name: scopeId.charAt(0).toUpperCase() + scopeId.slice(1),
      steps: scopeSteps,
    });
  }

  // Add ungrouped as "general" scope if needed
  if (ungrouped.length > 0) {
    scopes.push({
      id: 'general',
      name: 'General',
      steps: ungrouped,
    });
  }

  return scopes;
}

/**
 * Infer goal from document.
 */
function inferGoal(document: ParsedDocument): string {
  // Try title first
  if (document.title) {
    return document.title;
  }

  // Try metadata
  if (document.metadata) {
    if (typeof document.metadata.goal === 'string') {
      return document.metadata.goal;
    }
    if (typeof document.metadata.title === 'string') {
      return document.metadata.title;
    }
    if (typeof document.metadata.name === 'string') {
      return document.metadata.name;
    }
    if (
      document.metadata.summary &&
      typeof document.metadata.summary === 'object' &&
      typeof (document.metadata.summary as Record<string, unknown>).goal === 'string'
    ) {
      return (document.metadata.summary as Record<string, unknown>).goal as string;
    }
  }

  // Try first section title
  if (document.sections.length > 0 && document.sections[0]!.level === 1) {
    return cleanTitle(document.sections[0]!.title);
  }

  return 'Imported Plan';
}

/**
 * Infer context from document.
 */
function inferContext(document: ParsedDocument): string | undefined {
  // Try metadata
  if (document.metadata) {
    if (typeof document.metadata.context === 'string') {
      return document.metadata.context;
    }
    if (typeof document.metadata.description === 'string') {
      return truncateDescription(document.metadata.description, 1000);
    }
    if (
      document.metadata.summary &&
      typeof document.metadata.summary === 'object' &&
      typeof (document.metadata.summary as Record<string, unknown>).context === 'string'
    ) {
      return (document.metadata.summary as Record<string, unknown>).context as string;
    }
  }

  // Use first section content if it looks like an overview
  if (document.sections.length > 0) {
    const firstSection = document.sections[0]!;
    const lowerTitle = firstSection.title.toLowerCase();
    if (
      lowerTitle.includes('overview') ||
      lowerTitle.includes('introduction') ||
      lowerTitle.includes('summary') ||
      lowerTitle.includes('background')
    ) {
      return truncateDescription(firstSection.content, 1000);
    }
  }

  return undefined;
}

/**
 * Convert a parsed document to a plan structure.
 *
 * @param document - Parsed document from document-parser
 * @returns Extracted plan structure ready for plan creation
 */
export function documentToPlan(document: ParsedDocument): ExtractedPlan {
  // Filter sections that should become steps (level 2+ for Markdown, level 2 for others)
  const stepSections = document.sections.filter((s) => s.level >= 2 || document.format !== 'markdown');

  // If no level 2+ sections, use all sections
  const sectionsToConvert = stepSections.length > 0 ? stepSections : document.sections;

  // Convert sections to steps
  const steps = sectionsToSteps(sectionsToConvert);

  // Group by scope
  const scopes = groupByScope(steps);

  return {
    goal: inferGoal(document),
    context: inferContext(document),
    scopes,
    steps,
    metadata: document.metadata,
  };
}

/**
 * Convert ExtractedPlan steps to proper Step format for plan creation.
 */
export function extractedStepsToSteps(extractedSteps: ExtractedStep[]): Step[] {
  return extractedSteps.map((es) => ({
    step_id: es.step_id,
    title: es.title,
    description: es.description,
    scope: es.scope,
    dependencies: es.dependencies,
  }));
}
