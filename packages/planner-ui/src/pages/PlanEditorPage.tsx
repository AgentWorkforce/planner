import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlan, ApiError } from '@/api';
import type { Plan, PlanVersion } from '@/types';

export function PlanEditorPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlan() {
      if (!planId) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getPlan(planId);
        setPlan(result.plan);
        setVersion(result.version);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load plan');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [planId]);

  if (loading) {
    return (
      <div className="plan-editor-page">
        <div className="loading">Loading plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-editor-page">
        <div className="error-message">{error}</div>
        <Link to="/plans" className="btn btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  if (!plan || !version) {
    return (
      <div className="plan-editor-page">
        <div className="error-message">Plan not found</div>
        <Link to="/plans" className="btn btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'badge badge-draft';
      case 'approved':
        return 'badge badge-approved';
      case 'published':
        return 'badge badge-published';
      default:
        return 'badge';
    }
  };

  return (
    <div className="plan-editor-page">
      <div className="plan-header">
        <div className="plan-header-main">
          <Link to="/plans" className="back-link">
            &larr; Back to Plans
          </Link>
          <h1 className="plan-goal">{version.summary.goal || 'Untitled Plan'}</h1>
          <div className="plan-meta">
            <span className={getStatusBadgeClass(version.status)}>{version.status}</span>
            <span className="plan-version">Version {version.version}</span>
            {version.submitted_at && <span className="badge badge-submitted">Submitted</span>}
          </div>
        </div>
      </div>

      {version.summary.context && (
        <div className="plan-context">
          <h2>Context</h2>
          <p>{version.summary.context}</p>
        </div>
      )}

      <div className="plan-steps">
        <h2>Steps ({version.steps.length})</h2>
        {version.steps.length === 0 ? (
          <div className="empty-state">
            <p>No steps yet. Add steps to define the work needed to achieve your goal.</p>
          </div>
        ) : (
          <ul className="steps-list">
            {version.steps.map((step) => (
              <li key={step.step_id} className="step-item">
                <div className="step-header">
                  <span className="step-title">{step.title}</span>
                  {step.scope && <span className="step-scope">{step.scope}</span>}
                </div>
                {step.description && <p className="step-description">{step.description}</p>}
                {step.owner_role && (
                  <span className="step-owner">Owner: {step.owner_role}</span>
                )}
                {step.dependencies.length > 0 && (
                  <div className="step-dependencies">
                    Depends on: {step.dependencies.join(', ')}
                  </div>
                )}
                {step.acceptance_criteria && step.acceptance_criteria.length > 0 && (
                  <div className="step-criteria">
                    <strong>Acceptance criteria:</strong>
                    <ul>
                      {step.acceptance_criteria.map((criterion) => (
                        <li key={criterion.id}>{criterion.description}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {step.gate && (
                  <div className="step-gate">
                    <span className="gate-badge">Gate: {step.gate.type}</span>
                    {step.gate.approver_role && <span> ({step.gate.approver_role})</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="plan-timestamps">
        <span>Created: {new Date(version.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(version.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
