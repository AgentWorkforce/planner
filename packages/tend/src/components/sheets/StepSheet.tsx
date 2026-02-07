import { useState, useEffect } from 'react';
import { SheetContainer } from './SheetContainer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Step, PlanVersion, StepExecutionStatus } from '@/types/plan';

/**
 * Step with execution overlay (populated by forge SSE events)
 */
interface StepWithExecution extends Step {
  execution?: {
    status: StepExecutionStatus;
    started_at?: string;
    completed_at?: string;
    error?: string;
  };
}

/**
 * Props for StepSheet component
 */
export interface StepSheetProps {
  /** Step ID to display (null = closed) */
  stepId: string | null;
  /** Plan ID to fetch step from */
  planId: string;
  /** Callback when sheet closes */
  onClose: () => void;
}

/**
 * StepSheet
 *
 * Displays full step detail in a slide-in sheet.
 * Fetches step data from the latest plan version and shows:
 * - Title, description, scope
 * - Dependencies
 * - Acceptance criteria
 * - Status indicator and owner role
 *
 * Uses earth-tone palette and SheetContainer for consistent styling.
 *
 * @example
 * ```tsx
 * <StepSheet
 *   stepId={selectedStepId}
 *   planId="plan-123"
 *   onClose={() => setSelectedStepId(null)}
 * />
 * ```
 */
export function StepSheet({ stepId, planId, onClose }: StepSheetProps) {
  const [step, setStep] = useState<StepWithExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Fetch step data when stepId changes
  useEffect(() => {
    if (!stepId) {
      setStep(null);
      return;
    }

    const fetchStep = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/plans/${planId}/versions/latest`);
        if (!res.ok) {
          throw new Error(`Failed to fetch plan: HTTP ${res.status}`);
        }

        const data: { data: PlanVersion } = await res.json();
        const foundStep = data.data.steps.find((s) => s.step_id === stepId);

        if (!foundStep) {
          throw new Error(`Step ${stepId} not found in plan`);
        }

        setStep(foundStep);
      } catch (err) {
        console.error('[StepSheet] Failed to fetch step:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchStep();
  }, [stepId, planId]);

  // Handle chat input submission
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Shell implementation - just log for now
    console.log('[StepSheet] Chat input:', chatInput);
    setChatInput('');
  };

  return (
    <SheetContainer
      isOpen={stepId !== null}
      onClose={onClose}
      title={step?.title || 'Step Details'}
      width="lg"
      footer={
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about this step..."
            className={`
              flex-1 px-3 py-2 text-sm
              bg-bg-card border border-border-subtle rounded-md
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus:ring-2 focus:ring-accent-cyan
              transition-colors
            `}
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className={`
              px-4 py-2 text-sm font-medium rounded-md
              bg-accent-cyan text-white
              hover:bg-accent-cyan/90
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            `}
          >
            Send
          </button>
        </form>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="md" />
            <p className="text-sm text-text-muted">Loading step details...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3">
          <p className="text-sm text-error">{error.message}</p>
        </div>
      )}

      {!loading && !error && step && (
        <div className="space-y-6">
          {/* Execution Info - only shows when execution data is available */}
          {step.execution && (
            <div className="rounded-md border border-border-subtle bg-bg-card px-4 py-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
                Execution Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-muted">Status:</span>
                  <span
                    className={`text-sm font-medium ${
                      step.execution.status === 'done'
                        ? 'text-accent-green'
                        : step.execution.status === 'running'
                        ? 'text-accent-amber'
                        : step.execution.status === 'failed'
                        ? 'text-error'
                        : 'text-text-secondary'
                    }`}
                  >
                    {step.execution.status}
                  </span>
                </div>

                {step.execution.started_at && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-muted">Started:</span>
                    <span className="text-sm text-text-secondary">
                      {new Date(step.execution.started_at).toLocaleString()}
                    </span>
                  </div>
                )}

                {step.execution.completed_at && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-muted">Completed:</span>
                    <span className="text-sm text-text-secondary">
                      {new Date(step.execution.completed_at).toLocaleString()}
                    </span>
                  </div>
                )}

                {step.execution.error && (
                  <div className="mt-2 rounded border border-error/20 bg-error/5 px-3 py-2">
                    <span className="text-xs font-medium text-text-muted">Error:</span>
                    <p className="text-sm text-error mt-1">{step.execution.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scope */}
          {step.scope && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">
                Scope
              </h3>
              <p className="text-sm text-text-primary font-mono">{step.scope}</p>
            </div>
          )}

          {/* Owner Role */}
          {step.owner_role && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">
                Owner Role
              </h3>
              <p className="text-sm text-text-primary">{step.owner_role}</p>
            </div>
          )}

          {/* Description */}
          {step.description && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
                Description
              </h3>
              <div className="prose prose-sm prose-stone max-w-none">
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {step.description}
                </p>
              </div>
            </div>
          )}

          {/* Dependencies */}
          {step.dependencies && step.dependencies.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
                Dependencies ({step.dependencies.length})
              </h3>
              <ul className="space-y-1">
                {step.dependencies.map((depId) => (
                  <li
                    key={depId}
                    className="text-sm text-text-secondary font-mono bg-bg-card px-2 py-1 rounded"
                  >
                    {depId}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Acceptance Criteria */}
          {step.acceptance_criteria && step.acceptance_criteria.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
                Acceptance Criteria ({step.acceptance_criteria.length})
              </h3>
              <ul className="space-y-2">
                {step.acceptance_criteria.map((criterion) => (
                  <li key={criterion.id} className="flex gap-2">
                    <span className="text-accent-green mt-0.5">✓</span>
                    <div className="flex-1">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {criterion.description}
                      </p>
                      {criterion.type && (
                        <span className="text-xs text-text-muted mt-1 inline-block">
                          {criterion.type}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gate */}
          {step.gate && (
            <div className="rounded-md border border-border-subtle bg-bg-card px-4 py-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">
                Approval Gate
              </h3>
              <p className="text-sm text-text-secondary">
                {step.gate.type === 'human_approval' && 'Human approval required'}
                {step.gate.approver_role && ` (${step.gate.approver_role})`}
              </p>
            </div>
          )}

          {/* Sub-plan Reference */}
          {step.sub_plan_id && (
            <div className="rounded-md border border-border-subtle bg-bg-card px-4 py-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">
                Sub-plan
              </h3>
              <p className="text-sm text-text-secondary font-mono">{step.sub_plan_id}</p>
            </div>
          )}
        </div>
      )}
    </SheetContainer>
  );
}
