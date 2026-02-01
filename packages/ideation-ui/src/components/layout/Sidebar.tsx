import { SessionList, NewSessionButton } from '@/components/sessions';

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-text-primary font-display">
            Ideation
          </h1>
        </div>
        <NewSessionButton />
      </div>

      {/* Body - Sessions List */}
      <div className="flex-1 overflow-y-auto">
        <SessionList />
      </div>

      {/* Footer - Optional settings/help links */}
      <div className="p-3 border-t border-border-subtle text-xs text-text-muted">
        <span>Ideation v0.1.0</span>
      </div>
    </div>
  );
}
