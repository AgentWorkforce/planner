import { ConfidenceDots } from './ConfidenceDots';
import { KeywordTag } from './KeywordTag';
import { AlertCount } from './AlertCount';
import { getSpecialistIcon } from './getSpecialistIcon';

interface SpecialistCardProps {
  name: string;
  roleHint?: string;
  observations: Record<string, unknown>;
}

type ConfidenceLevel = 'exploring' | 'forming' | 'confident';

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

export function SpecialistCard({
  name,
  roleHint,
  observations,
}: SpecialistCardProps) {
  const Icon = getSpecialistIcon(name, roleHint);
  const isEmpty = Object.keys(observations).length === 0;

  const confidenceLevel = extractConfidenceLevel(observations);
  const keywords = extractKeywords(observations);
  const concernCount = extractConcerns(observations);
  const questionCount = extractQuestions(observations);

  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size="sm" className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">{name}</span>
        </div>
        <ConfidenceDots level={confidenceLevel} />
      </div>

      {/* Body */}
      {isEmpty ? (
        <p className="text-xs text-text-muted italic">Thinking...</p>
      ) : (
        <>
          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {keywords.map((keyword, index) => (
                <KeywordTag key={index} keyword={keyword} />
              ))}
            </div>
          )}

          {/* Footer: Alerts */}
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
