import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { PlusIcon } from './icons';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette, useRecentPlans } from '@/hooks';
import { listPlans } from '@/api';
import type { PlanSummary } from '@/types';

export function Layout() {
  const location = useLocation();
  const { isOpen, close } = useCommandPalette();
  const { recentPlanIds, addRecent } = useRecentPlans();
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  // Fetch plans for command palette
  useEffect(() => {
    async function fetchPlans() {
      try {
        const result = await listPlans();
        setPlans(result.plans);
      } catch {
        // Silently fail - command palette will just have no results
      }
    }
    fetchPlans();
  }, []);

  // Track plan views - extract planId from URL and add to recent
  useEffect(() => {
    const match = location.pathname.match(/^\/plans\/([^/]+)$/);
    if (match && match[1] && match[1] !== 'new') {
      addRecent(match[1]);
    }
  }, [location.pathname, addRecent]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="h-header bg-bg-secondary border-b border-border-subtle">
        <nav className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/plans" className="font-display text-xl font-bold text-text-primary hover:text-accent-cyan transition-colors">
            Planner
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/plans"
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive('/plans')
                  ? 'text-accent-cyan bg-accent-cyan/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Plans
            </Link>
            <Link
              to="/plans/new"
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isActive('/plans/new')
                  ? 'text-accent-cyan bg-accent-cyan/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <PlusIcon size="sm" />
              New Plan
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isOpen}
        onClose={close}
        plans={plans}
        recentPlanIds={recentPlanIds}
      />
    </div>
  );
}
