import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listPlans, ApiError } from '@/api';
import type { PlanSummary, PlanStatus } from '@/types';

export function PlansListPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanStatus | 'all'>('all');

  useEffect(() => {
    async function fetchPlans() {
      setLoading(true);
      setError(null);
      try {
        const status = filter === 'all' ? undefined : filter;
        const result = await listPlans(status);
        setPlans(result.plans);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load plans');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, [filter]);

  const getStatusBadgeClass = (status: PlanStatus) => {
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
    <div className="plans-list-page">
      <div className="page-header">
        <h1>Plans</h1>
        <Link to="/plans/new" className="btn btn-primary">
          Create New Plan
        </Link>
      </div>

      <div className="filter-bar">
        <label htmlFor="status-filter">Filter by status:</label>
        <select
          id="status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as PlanStatus | 'all')}
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
        </select>
      </div>

      {loading && <div className="loading">Loading plans...</div>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && plans.length === 0 && (
        <div className="empty-state">
          <p>No plans found.</p>
          <Link to="/plans/new" className="btn btn-primary">
            Create your first plan
          </Link>
        </div>
      )}

      {!loading && !error && plans.length > 0 && (
        <ul className="plans-list">
          {plans.map((plan) => (
            <li key={plan.plan_id} className="plan-item">
              <Link to={`/plans/${plan.plan_id}`} className="plan-link">
                <div className="plan-header">
                  <h2 className="plan-goal">{plan.goal || 'Untitled Plan'}</h2>
                  <span className={getStatusBadgeClass(plan.status)}>{plan.status}</span>
                </div>
                {plan.scopes && plan.scopes.length > 0 && (
                  <div className="plan-scopes">
                    {plan.scopes.map((scope) => (
                      <span key={scope} className="scope-tag">{scope}</span>
                    ))}
                  </div>
                )}
                <div className="plan-meta">
                  <span className="plan-version">v{plan.latest_version}</span>
                  <span className="plan-date">
                    {new Date(plan.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
