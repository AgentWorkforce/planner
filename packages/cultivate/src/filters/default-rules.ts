/**
 * Default filter rules for Tier 1 signal filtering
 *
 * Provides a standard set of rules for common filtering scenarios:
 * - Noise rejection (too short, bot-generated)
 * - Length-based filtering with strictness configuration
 * - Quality boosting (specificity, structure, questions)
 */

import type { FilterRuleRegistry, FilterRuleFunction } from './rule-registry.js';

/**
 * noise_reject: Reject if title+body combined < 20 chars
 *
 * Filters out extremely short signals that are unlikely to contain
 * meaningful information (e.g., "hi", "ok", "+1").
 */
const noiseReject: FilterRuleFunction = (signal) => {
  const combinedLength = signal.title.length + signal.body.length;

  if (combinedLength < 20) {
    return {
      action: 'reject',
      reason: `Signal too short (${combinedLength} chars, minimum 20)`,
    };
  }

  return { action: 'pass' };
};

/**
 * bot_reject: Reject if author_type === 'bot'
 *
 * Filters out automated bot messages that typically contain
 * system notifications rather than actionable user intent.
 */
const botReject: FilterRuleFunction = (signal) => {
  if (signal.author_type === 'bot') {
    return {
      action: 'reject',
      reason: 'Signal from bot author',
    };
  }

  return { action: 'pass' };
};

/**
 * length_check: Reject if body < configurable min length based on tier1_strictness
 *
 * Applies length thresholds based on strictness level:
 * - strictness >= 0.8: requires 100+ chars
 * - strictness >= 0.5: requires 50+ chars
 * - strictness < 0.5: requires 20+ chars
 */
const lengthCheck: FilterRuleFunction = (signal, config) => {
  const { tier1_strictness } = config;

  let minLength: number;
  if (tier1_strictness >= 0.8) {
    minLength = 100;
  } else if (tier1_strictness >= 0.5) {
    minLength = 50;
  } else {
    minLength = 20;
  }

  if (signal.body.length < minLength) {
    return {
      action: 'reject',
      reason: `Body too short for strictness ${tier1_strictness} (${signal.body.length} chars, minimum ${minLength})`,
    };
  }

  return { action: 'pass' };
};

/**
 * specificity_boost: Boost +0.1 if body contains specific technical terms, code snippets, or URLs
 *
 * Signals containing technical indicators are likely more actionable:
 * - Code blocks (```, ``), inline code (`word`)
 * - URLs (http://, https://)
 * - Common technical terms (API, bug, error, fix, implement, feature)
 */
const specificityBoost: FilterRuleFunction = (signal) => {
  const body = signal.body.toLowerCase();

  // Check for code snippets
  const hasCodeBlock = /```[\s\S]*```/.test(signal.body) || /`[^`]+`/.test(signal.body);

  // Check for URLs
  const hasUrl = /https?:\/\//.test(signal.body) || signal.url !== undefined;

  // Check for technical terms
  const technicalTerms = ['api', 'bug', 'error', 'fix', 'implement', 'feature', 'endpoint', 'database', 'function', 'class', 'method'];
  const hasTechnicalTerm = technicalTerms.some(term => body.includes(term));

  if (hasCodeBlock || hasUrl || hasTechnicalTerm) {
    return {
      action: 'boost',
      score_adjustment: 0.1,
      reason: 'Contains technical specificity indicators',
    };
  }

  return { action: 'pass' };
};

/**
 * structure_boost: Boost +0.05 if body has structured formatting
 *
 * Well-structured signals indicate thoughtful composition:
 * - Bullet points (-, *, •)
 * - Numbered lists (1., 2., etc.)
 * - Headers (#, ##, ###)
 */
const structureBoost: FilterRuleFunction = (signal) => {
  const body = signal.body;

  // Check for bullet points
  const hasBullets = /^\s*[-*•]\s+/m.test(body);

  // Check for numbered lists
  const hasNumberedList = /^\s*\d+\.\s+/m.test(body);

  // Check for markdown headers
  const hasHeaders = /^\s*#{1,6}\s+/m.test(body);

  if (hasBullets || hasNumberedList || hasHeaders) {
    return {
      action: 'boost',
      score_adjustment: 0.05,
      reason: 'Contains structured formatting',
    };
  }

  return { action: 'pass' };
};

/**
 * question_boost: Boost +0.1 if body contains question patterns
 *
 * Questions indicate engagement and seeking solutions:
 * - Question marks (?)
 * - Question phrases (how to, why does, what if, can we, should we)
 */
const questionBoost: FilterRuleFunction = (signal) => {
  const body = signal.body.toLowerCase();

  // Check for question mark
  const hasQuestionMark = signal.body.includes('?');

  // Check for question phrases
  const questionPhrases = ['how to', 'how do', 'why does', 'why is', 'what if', 'can we', 'should we', 'could we'];
  const hasQuestionPhrase = questionPhrases.some(phrase => body.includes(phrase));

  if (hasQuestionMark || hasQuestionPhrase) {
    return {
      action: 'boost',
      score_adjustment: 0.1,
      reason: 'Contains question patterns',
    };
  }

  return { action: 'pass' };
};

/**
 * Register all default filter rules
 *
 * @param registry - FilterRuleRegistry instance to register rules with
 */
export function registerDefaultRules(registry: FilterRuleRegistry): void {
  registry.register(
    'noise_reject',
    'Noise Rejection',
    'Reject signals with combined title+body < 20 characters',
    'reject',
    noiseReject
  );

  registry.register(
    'bot_reject',
    'Bot Rejection',
    'Reject signals from bot authors',
    'reject',
    botReject
  );

  registry.register(
    'length_check',
    'Length Check',
    'Reject signals with body below minimum length based on strictness',
    'reject',
    lengthCheck
  );

  registry.register(
    'specificity_boost',
    'Specificity Boost',
    'Boost signals containing technical terms, code snippets, or URLs (+0.1)',
    'boost',
    specificityBoost
  );

  registry.register(
    'structure_boost',
    'Structure Boost',
    'Boost signals with structured formatting like bullets or headers (+0.05)',
    'boost',
    structureBoost
  );

  registry.register(
    'question_boost',
    'Question Boost',
    'Boost signals containing question patterns (+0.1)',
    'boost',
    questionBoost
  );
}
