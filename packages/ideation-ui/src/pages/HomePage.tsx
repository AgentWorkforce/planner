// CLEANUP: This page is deprecated. Remove after confirming DashboardPage works.
// Accessible at /legacy for comparison, then delete this file.
import { BrainIcon } from '@/components/icons';

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-accent-cyan/10 flex items-center justify-center mb-6">
        <BrainIcon size="xl" className="text-accent-cyan" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Welcome to Ideation
      </h2>
      <p className="text-text-muted max-w-md">
        Start a new brainstorming session to explore your ideas with AI specialists.
        Click "New Session" in the sidebar to begin.
      </p>
    </div>
  );
}
