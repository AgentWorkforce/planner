import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface IdeationLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  panel?: ReactNode;
  panelCollapsed?: boolean;
  onTogglePanel?: () => void;
}

export function IdeationLayout({
  sidebar,
  children,
  panel,
  panelCollapsed = false,
}: IdeationLayoutProps) {
  return (
    <div className="flex h-screen bg-bg-deep">
      {/* Left Sidebar */}
      <aside
        className="w-[var(--sidebar-width)] h-full bg-bg-secondary border-r border-border-subtle flex flex-col shrink-0"
      >
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        {children}
      </main>

      {/* Right Panel (Specialists) */}
      {panel && (
        <>
          {/* Panel content in aside (hidden when collapsed) */}
          <aside
            className={cn(
              "h-full bg-bg-secondary border-l border-border-subtle flex flex-col shrink-0 transition-all duration-200",
              panelCollapsed ? "w-0 overflow-hidden" : "w-[var(--specialists-panel-width)]",
              "hidden lg:flex"
            )}
          >
            {!panelCollapsed && panel}
          </aside>
          {/* Floating expand button when collapsed (rendered outside aside to escape overflow-hidden) */}
          {panelCollapsed && panel}
        </>
      )}
    </div>
  );
}
