import { StatusBar, type AgentStatus, type StatusAction } from '@plannr/shared-ui';
import { type SpecialistPresence } from './CanvasHeader';

export interface IdeationStatusBarProps {
  specialists?: SpecialistPresence[];
  overallConfidence?: number;
  actions?: StatusAction[];
  className?: string;
}

/**
 * IdeationStatusBar
 *
 * Thin wrapper that bridges SpecialistPresence data to the shared-ui StatusBar.
 * Renders at the bottom of the ideation grid layout (S area) with canvas theming.
 */
export function IdeationStatusBar({
  specialists,
  overallConfidence,
  actions,
  className,
}: IdeationStatusBarProps) {
  const agents: AgentStatus[] = specialists?.map((s) => ({
    id: s.name,
    name: s.name,
    avatar: s.avatar,
    status: s.status,
    confidence: s.confidence,
  })) ?? [];

  return (
    <StatusBar
      agents={agents}
      overallConfidence={overallConfidence}
      actions={actions}
      className={`bg-[var(--canvas-bg)] border-t border-[var(--block-draft-border)] border-b-0 ${className ?? ''}`}
    />
  );
}
