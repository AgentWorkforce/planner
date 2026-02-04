import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CanvasLayoutProps {
  formingBlocksSlot: ReactNode;
  chatSlot: ReactNode;
  curatedBlocksSlot: ReactNode;
  className?: string;
}

/**
 * CanvasLayout - Three-column layout for the ideation canvas
 *
 * Layout structure:
 * - Desktop (≥768px): 30% (forming) | 45% (chat) | 25% (curated)
 * - Mobile (<768px): Stacked vertical layout with chat first
 *
 * Features:
 * - Responsive three-column flex layout on desktop
 * - Stacked vertical layout on mobile
 * - Proportional resizing on window resize
 * - Full height container fill
 * - Canvas-specific background colors from theme
 *
 * Mobile considerations:
 * - Chat takes priority (shown first)
 * - No physics simulation on mobile (performance)
 * - Touch-friendly spacing
 *
 * Usage:
 * ```tsx
 * <CanvasLayout
 *   formingBlocksSlot={<FormingBlocksColumn />}
 *   chatSlot={<ChatView />}
 *   curatedBlocksSlot={<CuratedBlocksColumn />}
 * />
 * ```
 */
export function CanvasLayout({
  formingBlocksSlot,
  chatSlot,
  curatedBlocksSlot,
  className,
}: CanvasLayoutProps) {
  return (
    <div className={cn('flex flex-col md:flex-row h-full gap-0', className)}>
      {/* Mobile: Chat First | Desktop: Forming Blocks Left (30%) */}
      <div
        className="flex-1 md:flex-[0_0_30%] h-auto md:h-full overflow-hidden bg-bg-tertiary md:border-r border-b md:border-b-0 border-border-subtle order-2 md:order-1"
      >
        <div className="block md:hidden">{chatSlot}</div>
        <div className="hidden md:block">{formingBlocksSlot}</div>
      </div>

      {/* Mobile: Hidden | Desktop: Chat Center (45%) */}
      <div
        className="hidden md:flex md:flex-[0_0_45%] h-full overflow-hidden bg-bg-primary order-1 md:order-2"
      >
        {chatSlot}
      </div>

      {/* Mobile: Forming then Curated | Desktop: Curated Right (25%) */}
      <div
        className="flex-1 md:flex-[0_0_25%] h-auto md:h-full overflow-hidden bg-bg-secondary md:border-l border-t md:border-t-0 border-border-subtle order-3"
      >
        {/* Mobile: Show both columns stacked */}
        <div className="block md:hidden">
          <div className="border-b border-border-subtle bg-bg-tertiary">
            {formingBlocksSlot}
          </div>
          {curatedBlocksSlot}
        </div>
        {/* Desktop: Show only curated */}
        <div className="hidden md:block">{curatedBlocksSlot}</div>
      </div>
    </div>
  );
}
