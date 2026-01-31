import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPlan, ApiError } from '@/api';
import { LoadingSpinner, DocumentImportForm } from '@/components';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TabId = 'goal' | 'import';

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
    <div className="flex flex-col h-full">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-subtle rounded-xl p-8 shadow-lg">
            <LoadingSpinner message="AI is analyzing your goal and creating a plan..." />
          </div>
        </div>
      )}

      {/* Toolbar header */}
      <div className="border-b border-border-subtle bg-bg-card">
        <div className="flex items-center justify-between h-14 px-6">
          <h1 className="text-lg font-semibold text-text-primary">
            New Plan
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/plans')}
          >
            Cancel
          </Button>
        </div>

        {/* Tab toggle row */}
        <div className="flex items-center h-12 px-6">
          <ToggleGroup
            type="single"
            value={activeTab}
            onValueChange={(val) => {
              if (val) setActiveTab(val as TabId);
            }}
            variant="tabs"
            size="sm"
            aria-label="Plan creation method"
          >
            <ToggleGroupItem value="goal" aria-label="Create from goal">
              From Goal
            </ToggleGroupItem>
            <ToggleGroupItem value="import" aria-label="Import from document">
              From Document
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* From Goal tab */}
          {activeTab === 'goal' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              {/* Goal field */}
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
                  className="w-full px-3 py-2.5 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-text-muted">
                  Examples: "Add user authentication", "Improve homepage performance", "Build a REST API for orders"
                </p>
              </div>

              {/* Context field */}
              <div className="space-y-2">
                <label htmlFor="context" className="block text-sm font-medium text-text-primary">
                  Context <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Any additional context, constraints, or requirements..."
                  rows={4}
                  disabled={loading}
                  className="w-full px-3 py-2.5 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-text-muted">
                  Include relevant technical constraints, deadlines, team information, or dependencies.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-text-muted">
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded text-text-secondary font-mono">⌘</kbd>
                  {' + '}
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded text-text-secondary font-mono">↵</kbd>
                  {' to submit'}
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || !goal.trim()}
                >
                  {loading ? 'Creating...' : 'Create Plan'}
                </Button>
              </div>
            </form>
          )}

          {/* From Document tab */}
          {activeTab === 'import' && (
            <DocumentImportForm />
          )}
        </div>
      </div>
    </div>
  );
}
