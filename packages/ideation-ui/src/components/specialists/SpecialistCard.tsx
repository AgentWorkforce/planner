import { useState } from 'react';
import { ConfidenceDots } from './ConfidenceDots';
import { ConfidencePercent } from './ConfidencePercent';
import { CategoryTag } from './CategoryTag';
import { KeywordTag } from './KeywordTag';
import { AlertCount } from './AlertCount';
import { getSpecialistIcon } from './getSpecialistIcon';
import { ChevronIcon } from '../icons/ChevronIcon';
import { AlertIcon } from '../icons/AlertIcon';
import { HelpCircleIcon } from '../icons/HelpCircleIcon';
import { extractSpecialistConfidence } from '@/lib/confidence-utils';
import {
  extractCategoryNames,
  extractCategoryDetails,
  extractRecommendations,
  identifyLowConfidenceCategories,
  formatCategoryName
} from '@/lib/category-utils';

interface SpecialistCardProps {
  name: string;
  roleHint?: string;
  observations: Record<string, unknown>;
  defaultExpanded?: boolean;
}

type ConfidenceLevel = 'exploring' | 'forming' | 'confident';

// Reserved keys that have special meaning (flat format)
const RESERVED_KEYS = new Set([
  'confidence',
  'keywords',
  'concerns',
  'questions',
  'observations',
]);

function extractConfidenceLevel(
  observations: Record<string, unknown>
): ConfidenceLevel {
  const confidence = observations.confidence;
  if (typeof confidence === 'string') {
    if (confidence === 'confident' || confidence === 'forming' || confidence === 'exploring') {
      return confidence;
    }
  }
  if (typeof confidence === 'number') {
    if (confidence >= 70) return 'confident';
    if (confidence >= 40) return 'forming';
  }
  return 'exploring';
}

function extractKeywords(observations: Record<string, unknown>): string[] {
  const keywords = observations.keywords;
  if (Array.isArray(keywords)) {
    return keywords
      .filter((k): k is string => typeof k === 'string')
      .slice(0, 5);
  }
  return [];
}

function extractConcerns(observations: Record<string, unknown>): number {
  const concerns = observations.concerns;
  if (Array.isArray(concerns)) {
    return concerns.length;
  }
  if (typeof concerns === 'number') {
    return concerns;
  }
  return 0;
}

function extractQuestions(observations: Record<string, unknown>): number {
  const questions = observations.questions;
  if (Array.isArray(questions)) {
    return questions.length;
  }
  if (typeof questions === 'number') {
    return questions;
  }
  return 0;
}

function extractObservationsList(observations: Record<string, unknown>): string[] {
  const obs = observations.observations;
  if (Array.isArray(obs)) {
    return obs.filter((o): o is string => typeof o === 'string');
  }
  return [];
}

function extractQuestionsList(observations: Record<string, unknown>): string[] {
  const questions = observations.questions;
  if (Array.isArray(questions)) {
    return questions.filter((q): q is string => typeof q === 'string');
  }
  return [];
}

function extractConcernsList(observations: Record<string, unknown>): string[] {
  const concerns = observations.concerns;
  if (Array.isArray(concerns)) {
    return concerns.filter((c): c is string => typeof c === 'string');
  }
  return [];
}

/**
 * Check if the observations contain nested domain data (not flat format).
 * Nested format has object values for non-reserved keys.
 */
function hasNestedDomainData(observations: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(observations)) {
    if (!RESERVED_KEYS.has(key) && typeof value === 'object' && value !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Extract domain categories from nested observations.
 * Returns array of { category, items } where items are key-value pairs.
 */
function extractDomainCategories(
  observations: Record<string, unknown>
): Array<{ category: string; items: Array<{ key: string; value: string }> }> {
  const categories: Array<{ category: string; items: Array<{ key: string; value: string }> }> = [];

  for (const [key, value] of Object.entries(observations)) {
    if (RESERVED_KEYS.has(key)) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object - extract as category with items
      const items: Array<{ key: string; value: string }> = [];
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === 'string') {
          items.push({ key: subKey, value: subValue });
        } else if (typeof subValue === 'object' && subValue !== null) {
          // Deeper nesting - flatten to string
          items.push({ key: subKey, value: JSON.stringify(subValue) });
        }
      }
      if (items.length > 0) {
        categories.push({ category: key, items });
      }
    } else if (typeof value === 'string') {
      // Simple key-value at top level (like random_keyword)
      categories.push({
        category: 'notes',
        items: [{ key, value }],
      });
    }
  }

  // Merge all top-level string values into a single "notes" category
  const notesCategory = categories.find(c => c.category === 'notes');
  if (notesCategory) {
    const otherNotes = categories.filter(c => c.category === 'notes' && c !== notesCategory);
    for (const other of otherNotes) {
      notesCategory.items.push(...other.items);
    }
    return categories.filter(c => c.category !== 'notes' || c === notesCategory);
  }

  return categories;
}

/**
 * Format a snake_case key to Title Case for display.
 */
function formatKey(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function SpecialistCard({
  name,
  roleHint,
  observations,
  defaultExpanded = false,
}: SpecialistCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const Icon = getSpecialistIcon(name, roleHint);
  const isEmpty = Object.keys(observations).length === 0;

  const confidenceLevel = extractConfidenceLevel(observations);
  const keywords = extractKeywords(observations);
  const concernCount = extractConcerns(observations);
  const questionCount = extractQuestions(observations);

  // Flat format lists
  const observationsList = extractObservationsList(observations);
  const questionsList = extractQuestionsList(observations);
  const concernsList = extractConcernsList(observations);

  // Nested domain data
  const isNestedFormat = hasNestedDomainData(observations);
  const domainCategories = isNestedFormat ? extractDomainCategories(observations) : [];

  // Enhanced nested data extraction
  const confidencePercent = extractSpecialistConfidence(observations);
  const categoryNames = extractCategoryNames(observations);
  const categoryDetails = extractCategoryDetails(observations);
  const recommendations = extractRecommendations(observations);
  const lowConfidenceCategories = identifyLowConfidenceCategories(observations);

  // Collapsed summary: max 5 tags, prioritize low-confidence categories
  const collapsedCategories = isNestedFormat
    ? [...lowConfidenceCategories, ...categoryNames.filter(c => !lowConfidenceCategories.includes(c))].slice(0, 5)
    : [];

  const hasFlatContent =
    observationsList.length > 0 ||
    questionsList.length > 0 ||
    concernsList.length > 0;

  const hasExpandableContent = hasFlatContent || domainCategories.length > 0 || categoryDetails.length > 0;

  const handleToggle = () => {
    if (hasExpandableContent) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg p-3 self-start">
      {/* Header */}
      <div
        className={`flex items-center justify-between ${
          hasExpandableContent ? 'cursor-pointer' : ''
        }`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <Icon size="sm" className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">{name}</span>
          {hasExpandableContent && (
            <ChevronIcon
              size="sm"
              direction={isExpanded ? 'down' : 'right'}
              className="text-text-muted transition-transform duration-200"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Show ConfidencePercent if nested format, otherwise ConfidenceDots */}
          {isNestedFormat && confidencePercent.overall > 0 ? (
            <ConfidencePercent value={confidencePercent.overall} />
          ) : (
            <ConfidenceDots level={confidenceLevel} />
          )}
        </div>
      </div>

      {/* Body */}
      {isEmpty ? (
        <p className="text-xs text-text-muted italic mt-2">Thinking...</p>
      ) : (
        <>
          {/* Collapsed Summary: CategoryTags for nested format, Keywords for flat format */}
          {!isExpanded && (
            <>
              {isNestedFormat && collapsedCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {collapsedCategories.map((category, index) => {
                    const detail = categoryDetails.find(d => d.name === category);
                    return (
                      <CategoryTag
                        key={index}
                        name={category}
                        confidence={detail?.confidence}
                      />
                    );
                  })}
                </div>
              ) : keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {keywords.map((keyword, index) => (
                    <KeywordTag key={index} keyword={keyword} />
                  ))}
                </div>
              ) : null}
            </>
          )}

          {/* Expanded Content */}
          {isExpanded && hasExpandableContent && (
            <div className="mt-3 space-y-3 transition-all duration-200 overflow-hidden">
              {/* Recommendations (nested format) */}
              {isNestedFormat && recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted mb-1.5">
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="text-xs text-text-secondary pl-3 relative before:content-['•'] before:absolute before:left-0"
                      >
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Category Details (nested format with confidence) */}
              {isNestedFormat && categoryDetails.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-text-muted mb-1.5">
                    Categories
                  </h4>
                  {categoryDetails.map(({ name: catName, confidence, itemCount, items }) => {
                    const isCatExpanded = expandedCategories.has(catName);
                    return (
                      <div key={catName} className="border-l-2 border-accent-purple/30 pl-3">
                        <button
                          onClick={() => toggleCategory(catName)}
                          className="w-full text-left hover:bg-bg-tertiary/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <ChevronIcon
                                size="sm"
                                direction={isCatExpanded ? 'down' : 'right'}
                                className="text-text-muted"
                              />
                              <span className="text-xs font-medium text-text-primary">
                                {formatCategoryName(catName)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-muted">
                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                              </span>
                              {confidence !== undefined && (
                                <ConfidencePercent value={confidence} size="sm" />
                              )}
                            </div>
                          </div>
                        </button>
                        {/* Expanded items */}
                        {isCatExpanded && items.length > 0 && (
                          <div className="mt-2 ml-4 space-y-2 pb-2">
                            {items.map(({ key, value }) => (
                              <div key={key} className="text-xs">
                                <span className="font-medium text-text-secondary">
                                  {formatCategoryName(key)}:
                                </span>
                                <p className="text-text-muted mt-0.5 whitespace-pre-wrap">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legacy: Nested Domain Categories (old extraction logic) */}
              {!isNestedFormat && domainCategories.length > 0 && domainCategories.map(({ category, items }) => (
                <div key={category} className="border-l-2 border-accent-purple/30 pl-3">
                  <h4 className="text-xs font-medium text-text-primary mb-2">
                    {formatKey(category)}
                  </h4>
                  <div className="space-y-2">
                    {items.slice(0, 5).map(({ key, value }) => (
                      <div key={key}>
                        <span className="text-xs font-medium text-text-muted">
                          {formatKey(key)}:
                        </span>
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-3">
                          {value}
                        </p>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <p className="text-xs text-text-muted italic">
                        +{items.length - 5} more items
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Flat Format: Observations */}
              {observationsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted mb-1.5">
                    Observations
                  </h4>
                  <ul className="space-y-1">
                    {observationsList.map((obs, index) => (
                      <li
                        key={index}
                        className="text-xs text-text-secondary pl-3 relative before:content-['•'] before:absolute before:left-0"
                      >
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Flat Format: Questions */}
              {questionsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted mb-1.5">
                    Questions
                  </h4>
                  <ul className="space-y-1.5">
                    {questionsList.map((question, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs text-text-secondary"
                      >
                        <HelpCircleIcon size="sm" className="text-accent-purple mt-0.5 flex-shrink-0" />
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Flat Format: Concerns */}
              {concernsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted mb-1.5">
                    Concerns
                  </h4>
                  <ul className="space-y-1.5">
                    {concernsList.map((concern, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs text-text-secondary"
                      >
                        <AlertIcon size="sm" className="text-warning mt-0.5 flex-shrink-0" />
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer: Alerts (flat format) */}
          {(concernCount > 0 || questionCount > 0) && (
            <div className="flex gap-3 mt-2 pt-2 border-t border-border-subtle">
              <AlertCount type="concern" count={concernCount} />
              <AlertCount type="question" count={questionCount} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
