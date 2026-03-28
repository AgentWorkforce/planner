import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronIcon } from '@/components/icons/ChevronIcon';

interface TendLayoutProps {
  nav: ReactNode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  center: ReactNode;
  statusBar?: ReactNode;
  focusMode?: boolean;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onToggleLeft?: () => void;
  className?: string;
}

/**
 * TendLayout - CSS Grid layout for tend application
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
 * Desktop layout (focus mode — no nav, no side panels):
 * +--------------------------------------+
 * |        C (detail | chat)             |
 * +--------------------------------------+
 * |                 S                    |
 * +--------------------------------------+
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
  leftCollapsed = false,
  rightCollapsed = false,
  onToggleLeft,
  className,
}: TendLayoutProps) {
  const getGridStyle = () => {
    if (focusMode) {
      return {
        gridTemplateAreas: '"center" "status"',
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr auto',
      };
    }

    const leftCol = leftCollapsed ? '0px' : 'minmax(200px, 1fr)';
    const rightCol = rightCollapsed ? '0px' : 'minmax(200px, 1fr)';
    const centerCol = 'minmax(320px, 2.5fr)';

    return {
      gridTemplateAreas:
        '"left nav right" "left center right" "status status status"',
      gridTemplateColumns: `${leftCol} ${centerCol} ${rightCol}`,
      gridTemplateRows: 'auto 1fr auto',
    };
  };

  const gridStyle = getGridStyle();

  return (
    <div
      className={cn(
        'h-full w-full bg-[var(--canvas-bg)]',
        'flex flex-col md:grid md:transition-[grid-template-columns] md:duration-300 md:ease-in-out',
        'relative',
        className,
      )}
      style={gridStyle}
    >
      {/* Nav — hidden in focus mode */}
      <div
        className={cn('order-1 md:overflow-hidden', focusMode && 'hidden md:hidden')}
        style={{ gridArea: focusMode ? undefined : 'nav' }}
      >
        {nav}
      </div>

      {/* Left Panel — hidden in focus mode on desktop */}
      <div
        className={cn(
          'order-3 md:order-none md:overflow-hidden',
          focusMode && 'hidden md:hidden',
          leftCollapsed && 'md:opacity-0 md:pointer-events-none',
        )}
        style={{ gridArea: focusMode ? undefined : 'left' }}
      >
        <div className="h-full md:transition-opacity md:duration-300">
          {leftPanel}
        </div>
      </div>

      {/* Center — chat / focus content */}
      <div
        className="order-2 md:order-none flex-1 md:flex-none overflow-hidden"
        style={{ gridArea: 'center' }}
      >
        {center}
      </div>

      {/* Right Panel — hidden in focus mode */}
      <div
        className={cn(
          'order-4 md:order-none md:overflow-hidden',
          focusMode && 'hidden md:hidden',
          rightCollapsed && 'md:opacity-0 md:pointer-events-none',
        )}
        style={{ gridArea: focusMode ? undefined : 'right' }}
      >
        <div className="h-full md:transition-opacity md:duration-300">
          {rightPanel}
        </div>
      </div>

      {/* Status Bar */}
      {statusBar && (
        <div className="order-5 md:order-none" style={{ gridArea: 'status' }}>
          {statusBar}
        </div>
      )}

      {/* Left panel collapse toggle - only visible on desktop */}
      {!focusMode && onToggleLeft && (
        <button
          onClick={onToggleLeft}
          className={cn(
            'hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-5 h-10 items-center justify-center',
            'rounded-r-md bg-bg-secondary border border-l-0 border-border-subtle',
            'hover:bg-bg-tertiary transition-all duration-300',
            'shadow-sm',
            leftCollapsed ? 'left-0' : 'left-[calc((100%-16rem)/2.5)]',
          )}
          aria-label={leftCollapsed ? 'Show forming blocks' : 'Hide forming blocks'}
        >
          <ChevronIcon direction={leftCollapsed ? 'right' : 'left'} size="sm" />
        </button>
      )}
    </div>
  );
}
