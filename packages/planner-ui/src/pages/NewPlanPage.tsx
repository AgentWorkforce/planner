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
    <div className="max-w-2xl mx-auto py-8 px-6">
      {loading && (
        <div className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-subtle rounded-xl p-8 shadow-lg">
            <LoadingSpinner message="AI is analyzing your goal and creating a plan..." />
          </div>
        </div>
      )}

      <h1 className="font-display text-3xl text-text-primary mb-6">Create New Plan</h1>

      <TabNavigation
        tabs={TABS}
        activeTabId={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabId)}
      />

      <TabPanel tabId="goal" isActive={activeTab === 'goal'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="goal" className="block text-sm font-medium text-text-primary">
              Goal <span className="text-error">*</span>
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to accomplish? Be as specific or vague as you like - AI will help refine it."
              rows={3}
              disabled={loading}
              autoFocus
              className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-text-muted">
              Examples: "Add user authentication", "Improve homepage performance", "Build a REST API
              for orders"
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="context" className="block text-sm font-medium text-text-primary">
              Context <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Any additional context, constraints, or requirements..."
              rows={4}
              disabled={loading}
              className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-text-muted">
              Include relevant technical constraints, deadlines, team information, or dependencies.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              className="px-4 py-2 bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-all duration-150 hover:border-border-light"
              onClick={() => navigate('/plans')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !goal.trim()}
            >
              {loading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>

          <p className="text-center text-xs text-text-muted">
            Press <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">Cmd/Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">Enter</kbd> to submit
          </p>
        </form>
      </TabPanel>

      <TabPanel tabId="import" isActive={activeTab === 'import'}>
        <DocumentImportForm />
      </TabPanel>
    </div>
  );
}
