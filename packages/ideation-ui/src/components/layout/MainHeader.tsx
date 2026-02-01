import { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { PanelRightIcon } from '@/components/icons';

interface MainHeaderProps {
  children?: ReactNode;
  showPanelToggle?: boolean;
  panelCollapsed?: boolean;
  onTogglePanel?: () => void;
}

export function MainHeader({
  children,
  showPanelToggle = false,
  panelCollapsed = false,
  onTogglePanel,
}: MainHeaderProps) {
  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-border-subtle bg-bg-primary">
      <div className="flex-1">
        {children}
      </div>
      {showPanelToggle && onTogglePanel && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePanel}
          className="ml-2"
          title={panelCollapsed ? 'Show specialists panel' : 'Hide specialists panel'}
        >
          <PanelRightIcon size="md" className={panelCollapsed ? 'text-text-muted' : 'text-accent-cyan'} />
        </Button>
      )}
    </header>
  );
}
