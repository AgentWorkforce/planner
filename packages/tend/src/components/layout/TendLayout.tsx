import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TendLayoutProps {
  nav: ReactNode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  center: ReactNode;
  statusBar?: ReactNode;
  focusMode?: boolean;
  className?: string;
}

/**
 * TendLayout - CSS Grid layout for tend workspace
 *
 * Desktop layout (normal):
 * +----------+------------------+----------+
 * |    L     |        N         |    R     |
 * |          |------------------|          |
 * |          |        C         |          |
 * +----------+------------------+----------+
 * |                  S                     |
 * +----------------------------------------+
 *
 * Desktop layout (focus mode):
 * +------------------+----------+
 * |        N         |    R     |
 * |------------------|          |
 * |        C         |          |
 * +------------------+----------+
 * |          S                  |
 * +-----------------------------+
 *
 * Mobile (<md breakpoint): vertical stack
 * Order: nav, center (chat), left, right, status
 *
 * CRITICAL: All grid cells maintain real dimensions so
 * physics engine can call getBoundingClientRect() reliably.
 */
export function TendLayout({
  nav,
  leftPanel,
  rightPanel,
  center,
  statusBar,
  focusMode = false,
  className,
}: TendLayoutProps) {
  const gridStyle = focusMode
    ? {
        gridTemplateAreas: '"nav right" "center right" "status status"',
        gridTemplateColumns: 'minmax(400px, 3fr) minmax(200px, 1fr)',
        gridTemplateRows: 'auto 1fr auto',
      }
    : {
        gridTemplateAreas:
          '"left nav right" "left center right" "status status status"',
        gridTemplateColumns: 'minmax(300px, 1.5fr) minmax(320px, 1.5fr) minmax(200px, 1fr)',
        gridTemplateRows: 'auto 1fr auto',
      };

  return (
    <div
      className={cn(
        'h-full w-full bg-[var(--canvas-bg)]',
        'flex flex-col md:grid',
        className,
      )}
      style={gridStyle}
    >
      {/* Nav — center top */}
      <div className="order-1 md:overflow-hidden" style={{ gridArea: 'nav' }}>
        {nav}
      </div>

      {/* Left Panel — hidden in focus mode on desktop */}
      <div
        className={cn(
          'order-3 md:order-none md:overflow-hidden',
          focusMode && 'hidden md:hidden',
        )}
        style={{ gridArea: focusMode ? undefined : 'left' }}
      >
        {leftPanel}
      </div>

      {/* Center — chat / focus content */}
      <div
        className="order-2 md:order-none flex-1 md:flex-none overflow-hidden"
        style={{ gridArea: 'center' }}
      >
        {center}
      </div>

      {/* Right Panel */}
      <div
        className="order-4 md:order-none md:overflow-hidden"
        style={{ gridArea: 'right' }}
      >
        {rightPanel}
      </div>

      {/* Status Bar */}
      {statusBar && (
        <div className="order-5 md:order-none" style={{ gridArea: 'status' }}>
          {statusBar}
        </div>
      )}
    </div>
  );
}
