/**
 * ExtractionPreview - Shows extracted document structure with edit capabilities.
 *
 * Two-column layout: ScopesList (left) + DocumentSourceCard (right)
 * Supports inline editing, step removal, and scope management.
 */

import { useState, useCallback } from 'react';
import { EditableText } from './EditableText';
import { FormatDetectionBadge, type DocumentFormat } from './FormatDetectionBadge';

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
    <div className={`scope-group${isCollapsed ? ' scope-group--collapsed' : ''}`}>
      <div className="scope-group-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <button
          type="button"
          className="scope-group-expand"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand scope' : 'Collapse scope'}
        >
          ▼
        </button>
        <span className="scope-group-name">{scope.name || 'General'}</span>
        <span className="scope-group-count">{scope.steps.length} steps</span>
        <button
          type="button"
          className="scope-group-remove"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveScope();
          }}
          aria-label={`Remove scope: ${scope.name}`}
        >
          🗑
        </button>
      </div>
      <div className="scope-group-content">
        {scope.steps.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: 'var(--spacing-md)' }}>
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
    <div className="extracted-step">
      <span className="extracted-step-number">{index}.</span>
      <div className="extracted-step-title">
        <EditableText
          value={step.title}
          onChange={onTitleChange}
          placeholder="Step title..."
        />
      </div>
      <button
        type="button"
        className="extracted-step-remove"
        onClick={onRemove}
        aria-label={`Remove step: ${step.title}`}
      >
        ×
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
    <div className="document-source-card">
      <div className="source-info">
        <span className="source-icon">📄</span>
        <div className="source-details">
          <div className="source-name">{filename || 'Pasted content'}</div>
          <div className="source-meta">
            <FormatDetectionBadge format={format} />
            {charCount !== undefined && <span>{charCount.toLocaleString()} chars</span>}
          </div>
        </div>
      </div>

      <div className="goal-override">
        <label htmlFor="goal-override">Goal</label>
        <textarea
          id="goal-override"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="AI will infer goal from document. Override here if needed."
          rows={3}
          disabled={loading}
        />
        <p className="form-hint">
          Leave empty to use the suggested goal from the document.
        </p>
      </div>

      <div style={{ marginBottom: 'var(--spacing-md)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        {stepCount} steps in {scopeCount} scopes
      </div>

      <div className="source-card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onCreatePlan}
          disabled={loading || stepCount === 0}
        >
          {loading ? 'Creating...' : 'Create Plan'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
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
    <div className="extraction-preview">
      <div>
        <div className="extraction-preview-header">
          <h2>
            Extracted Structure
            <span className="extraction-stats">
              {totalSteps} steps in {result.scopes.length} scopes
            </span>
          </h2>
          <button type="button" className="extraction-back-link" onClick={onBack}>
            ← Back to edit document
          </button>
        </div>

        <div className="scopes-list">
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
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-xl)' }}>
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
