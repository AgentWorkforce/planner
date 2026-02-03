import { ToggleGroup, ToggleGroupItem, Badge } from '@/components/ui';
import { MessageIcon, BrainIcon } from '@/components/icons';

interface SessionTabBarProps {
  activeTab: 'chat' | 'understanding';
  onTabChange: (tab: 'chat' | 'understanding') => void;
  understandingCount?: number;
}

export function SessionTabBar({ activeTab, onTabChange, understandingCount = 0 }: SessionTabBarProps) {
  return (
    <div className="h-12 flex items-center px-4 border-b border-border-subtle bg-bg-primary">
      <ToggleGroup
        type="single"
        value={activeTab}
        onValueChange={(value) => {
          if (value === 'chat' || value === 'understanding') {
            onTabChange(value);
          }
        }}
        className="h-8 p-0.5 bg-bg-tertiary rounded-lg"
      >
        <ToggleGroupItem value="chat" aria-label="Chat view" className="h-7 px-3 gap-1.5 text-sm">
          <MessageIcon size="sm" />
          Chat
        </ToggleGroupItem>
        <ToggleGroupItem value="understanding" aria-label="Understanding view" className="h-7 px-3 gap-1.5 text-sm">
          <BrainIcon size="sm" />
          Understanding
          {understandingCount > 0 && (
            <Badge className="ml-1.5 h-5 min-w-5 text-xs bg-accent-cyan/20 text-accent-cyan rounded-full px-1.5">
              {understandingCount}
            </Badge>
          )}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
