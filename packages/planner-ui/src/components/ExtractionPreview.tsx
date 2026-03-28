/**
 * ExtractionPreview - Shows extracted document structure with edit capabilities.
 *
 * Two-column layout: ScopesList (left) + DocumentSourceCard (right)
 * Supports inline editing, step removal, and scope management.
 */

import { useState, useCallback } from 'react';
import { EditableText } from './EditableText';
import { FormatDetectionBadge, type DocumentFormat } from './FormatDetectionBadge';
import { DocumentIcon, TrashIcon, ChevronIcon, CloseIcon } from './icons';

export interface ExtractedStep {
  step_id: string;
  title: string;
  description?: string;
  scope?: string;
}

export interface ExtractedScope {
  id: string;
  name: string;
  steps: ExtractedStep[];
}

interface ExtractionResult {
  format: DocumentFormat;
  confidence: 'high' | 'medium' | 'low';
  scopes: ExtractedScope[];
  suggestedGoal?: string;
  suggestedContext?: string;
  filename?: string;
  charCount?: number;
}

interface ExtractionPreviewProps {
  result: ExtractionResult;
  onResultChange: (result: ExtractionResult) => void;
  onBack: () => void;
  onCreatePlan: (goal: string, steps: ExtractedStep[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface ScopeGroupProps {
  scope: ExtractedScope;
  onStepTitleChange: (stepId: string, title: string) => void;
  onStepRemove: (stepId: string) => void;
  onScopeRemove: () => void;
}

function ScopeGroup({ scope, onStepTitleChange, onStepRemove, onScopeRemove }: ScopeGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleRemoveScope = () => {
    if (scope.steps.length === 0 || window.confirm(`Remove scope "${scope.name}" and all its steps?`)) {
      onScopeRemove();
    }
  };

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-bg-secondary cursor-pointer hover:bg-bg-hover transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <button
          type="button"
          className="p-1 text-text-muted hover:text-text-primary transition-colors"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand scope' : 'Collapse scope'}
        >
          <ChevronIcon direction={isCollapsed ? 'right' : 'down'} size="sm" />
        </button>
        <span className="font-medium text-text-primary flex-1">{scope.name || 'General'}</span>
        <span className="text-sm text-text-muted">{scope.steps.length} steps</span>
        <button
          type="button"
          className="p-1 text-text-muted hover:text-error transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveScope();
          }}
          aria-label={`Remove scope: ${scope.name}`}
        >
          <TrashIcon size="sm" />
        </button>
      </div>
      {!isCollapsed && (
        <div className="divide-y divide-border-border-subtle">
          {scope.steps.length === 0 ? (
            <div className="text-text-muted italic p-4">
              No steps in this scope
            </div>
          ) : (
            scope.steps.map((step, index) => (
              <ExtractedStepItem
                key={step.step_id}
                step={step}
                index={index + 1}
                onTitleChange={(title) => onStepTitleChange(step.step_id, title)}
                onRemove={() => onStepRemove(step.step_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface ExtractedStepItemProps {
  step: ExtractedStep;
  index: number;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}

function ExtractedStepItem({ step, index, onTitleChange, onRemove }: ExtractedStepItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover/50 transition-colors">
      <span className="text-sm text-text-muted font-mono w-6">{index}.</span>
      <div className="flex-1 min-w-0">
        <EditableText
          value={step.title}
          onSave={onTitleChange}
          placeholder="Step title..."
        />
      </div>
      <button
        type="button"
        className="p-1 text-text-muted hover:text-error transition-colors"
        onClick={onRemove}
        aria-label={`Remove step: ${step.title}`}
      >
        <CloseIcon size="sm" />
      </button>
    </div>
  );
}

interface DocumentSourceCardProps {
  filename?: string;
  format: DocumentFormat;
  charCount?: number;
  goal: string;
  onGoalChange: (goal: string) => void;
  onCreatePlan: () => void;
  onCancel: () => void;
  loading?: boolean;
  stepCount: number;
  scopeCount: number;
}

function DocumentSourceCard({
  filename,
  format,
  charCount,
  goal,
  onGoalChange,
  onCreatePlan,
  onCancel,
  loading,
  stepCount,
  scopeCount,
}: DocumentSourceCardProps) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-bg-secondary rounded-lg text-accent-cyan">
          <DocumentIcon size="lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-primary truncate">
            {filename || 'Pasted content'}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
            <FormatDetectionBadge format={format} />
            {charCount !== undefined && <span>{charCount.toLocaleString()} chars</span>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="goal-override" className="block text-sm font-medium text-text-secondary">
          Goal
        </label>
        <textarea
          id="goal-override"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="AI will infer goal from document. Override here if needed."
          rows={3}
          disabled={loading}
          className="w-full px-4 py-3 bg-bg-deep border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-text-muted">
          Leave empty to use the suggested goal from the document.
        </p>
      </div>

      <div className="text-sm text-text-muted">
        {stepCount} steps in {scopeCount} scopes
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 px-4 py-2 bg-accent-cyan text-bg-deep font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onCreatePlan}
          disabled={loading || stepCount === 0}
        >
          {loading ? 'Creating...' : 'Create Plan'}
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ExtractionPreview({
  result,
  onResultChange,
  onBack,
  onCreatePlan,
  onCancel,
  loading = false,
}: ExtractionPreviewProps) {
  const [goalOverride, setGoalOverride] = useState(result.suggestedGoal || '');

  const totalSteps = result.scopes.reduce((sum, scope) => sum + scope.steps.length, 0);

  const handleStepTitleChange = useCallback(
    (scopeId: string, stepId: string, title: string) => {
      const newScopes = result.scopes.map((scope) => {
        if (scope.id !== scopeId) return scope;
        return {
          ...scope,
          steps: scope.steps.map((step) =>
            step.step_id === stepId ? { ...step, title } : step
          ),
        };
      });
      onResultChange({ ...result, scopes: newScopes });
    },
    [result, onResultChange]
  );

  const handleStepRemove = useCallback(
    (scopeId: string, stepId: string) => {
      const newScopes = result.scopes.map((scope) => {
        if (scope.id !== scopeId) return scope;
        return {
          ...scope,
          steps: scope.steps.filter((step) => step.step_id !== stepId),
        };
      });
      onResultChange({ ...result, scopes: newScopes });
    },
    [result, onResultChange]
  );

  const handleScopeRemove = useCallback(
    (scopeId: string) => {
      const newScopes = result.scopes.filter((scope) => scope.id !== scopeId);
      onResultChange({ ...result, scopes: newScopes });
    },
    [result, onResultChange]
  );

  const handleCreatePlan = () => {
    const goal = goalOverride.trim() || result.suggestedGoal || 'Imported plan';
    const allSteps = result.scopes.flatMap((scope) =>
      scope.steps.map((step) => ({ ...step, scope: scope.name }))
    );
    onCreatePlan(goal, allSteps);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary">
            Extracted Structure
            <span className="ml-3 text-sm font-normal text-text-muted">
              {totalSteps} steps in {result.scopes.length} scopes
            </span>
          </h2>
          <button
            type="button"
            className="text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors"
            onClick={onBack}
          >
            ← Back to edit document
          </button>
        </div>

        <div className="space-y-4">
          {result.scopes.map((scope) => (
            <ScopeGroup
              key={scope.id}
              scope={scope}
              onStepTitleChange={(stepId, title) => handleStepTitleChange(scope.id, stepId, title)}
              onStepRemove={(stepId) => handleStepRemove(scope.id, stepId)}
              onScopeRemove={() => handleScopeRemove(scope.id)}
            />
          ))}
          {result.scopes.length === 0 && (
            <div className="text-center text-text-muted py-12">
              No scopes found in document. Go back and try a different document.
            </div>
          )}
        </div>
      </div>

      <DocumentSourceCard
        filename={result.filename}
        format={result.format}
        charCount={result.charCount}
        goal={goalOverride}
        onGoalChange={setGoalOverride}
        onCreatePlan={handleCreatePlan}
        onCancel={onCancel}
        loading={loading}
        stepCount={totalSteps}
        scopeCount={result.scopes.length}
      />
    </div>
  );
}
