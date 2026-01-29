import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPlan, ApiError } from '@/api';
import { LoadingSpinner, DocumentImportForm } from '@/components';
import { TabNavigation, TabPanel } from '@/components/TabNavigation';

type TabId = 'goal' | 'import';

const TABS = [
  { id: 'goal' as const, label: 'From Goal' },
  { id: 'import' as const, label: 'From Document' },
];

export function NewPlanPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('goal');
  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!goal.trim()) {
      setError('Goal is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createPlan(goal.trim(), context.trim() || undefined);
      navigate(`/plans/${result.plan.plan_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create plan');
      }
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="new-plan-page">
      {loading && (
        <div className="ai-overlay">
          <LoadingSpinner message="AI is analyzing your goal and creating a plan..." />
        </div>
      )}

      <h1>Create New Plan</h1>

      <TabNavigation
        tabs={TABS}
        activeTabId={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabId)}
      />

      <TabPanel tabId="goal" isActive={activeTab === 'goal'}>
        <form onSubmit={handleSubmit} className="new-plan-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="goal">Goal *</label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to accomplish? Be as specific or vague as you like - AI will help refine it."
              rows={3}
              disabled={loading}
              autoFocus
            />
            <p className="form-hint">
              Examples: "Add user authentication", "Improve homepage performance", "Build a REST API
              for orders"
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="context">Context (optional)</label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Any additional context, constraints, or requirements..."
              rows={4}
              disabled={loading}
            />
            <p className="form-hint">
              Include relevant technical constraints, deadlines, team information, or dependencies.
            </p>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/plans')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !goal.trim()}>
              {loading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>

          <p className="keyboard-hint">Press Cmd/Ctrl + Enter to submit</p>
        </form>
      </TabPanel>

      <TabPanel tabId="import" isActive={activeTab === 'import'}>
        <DocumentImportForm />
      </TabPanel>
    </div>
  );
}
