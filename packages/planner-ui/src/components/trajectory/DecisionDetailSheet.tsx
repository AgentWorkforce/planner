/**
 * DecisionDetailSheet Component
 *
 * Slide-out panel showing full decision details.
 * Displays complete context, question, options, answer, and reasoning.
 *
 * Props:
 * - decision: The decision event to display (null when closed)
 * - open: Whether the sheet is visible
 * - onClose: Callback when sheet is dismissed
 */

import type { DecisionEvent } from '@/types/trajectory';
import { AgentAvatar } from '@/components/AgentAvatar';
import type { AgentRole } from '@/hooks/useAgentOrchestration';
import { getRoleConfig } from '@/config/agentRoles';
import { formatRelativeTime } from '@/utils/time';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DecisionDetailSheetProps {
  decision: DecisionEvent | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Format timestamp as human-readable date and time.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

export function DecisionDetailSheet({
  decision,
  open,
  onClose,
}: DecisionDetailSheetProps) {
  // Early return if no decision
  if (!decision) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>No decision selected</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const roleConfig = getRoleConfig(decision.asking_agent as AgentRole);
  const timestamp = formatTimestamp(decision.timestamp);
  const timeAgo = formatRelativeTime(decision.timestamp);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[420px] overflow-y-auto">
        {/* Header with agent info and timestamp */}
        <SheetHeader className="flex-row items-start justify-between space-y-0 pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <AgentAvatar
              role={decision.asking_agent as AgentRole}
              state="normal"
              size="md"
              showTooltip={false}
            />
            <div>
              <SheetTitle className="text-base mb-1">{roleConfig.label}</SheetTitle>
              <div className="text-xs text-text-dim">
                {timestamp}
                <span className="ml-1 text-text-muted">({timeAgo})</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Main content */}
        <div className="space-y-6 pt-6">
          {/* Context section (optional) */}
          {decision.context_provided && (
            <section>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">
                Context
              </h3>
              <div className="p-3 rounded bg-bg-secondary">
                <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {decision.context_provided}
                </pre>
              </div>
            </section>
          )}

          {/* Question section */}
          <section>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">
              Question
            </h3>
            <p className="text-sm text-text-primary leading-relaxed">
              {decision.question_text}
            </p>
          </section>

          {/* Options section */}
          {decision.options_presented.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">
                Options
              </h3>
              <ul className="space-y-2">
                {decision.options_presented.map((option, index) => {
                  const isSelected = option === decision.selected_option;
                  return (
                    <li
                      key={index}
                      className={`
                        p-2.5 rounded text-sm
                        ${
                          isSelected
                            ? 'bg-accent-cyan/10 text-accent-cyan font-medium border border-accent-cyan/20'
                            : 'bg-bg-secondary text-text-primary'
                        }
                      `}
                    >
                      {option}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Answer section */}
          <section>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">
              Answer
            </h3>
            <div className="p-3 rounded bg-accent-cyan/10 border border-accent-cyan/20">
              {decision.selected_option ? (
                <p className="text-sm text-accent-cyan font-medium">
                  {decision.selected_option}
                </p>
              ) : decision.free_text_response ? (
                <p className="text-sm text-accent-cyan">
                  {decision.free_text_response}
                </p>
              ) : (
                <p className="text-sm text-text-dim italic">No answer recorded</p>
              )}
            </div>
          </section>

          {/* Reasoning section (optional) */}
          {decision.reasoning && (
            <section>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">
                Reasoning
              </h3>
              <div className="p-3 rounded bg-bg-secondary">
                <p className="text-sm text-text-primary leading-relaxed">
                  {decision.reasoning}
                </p>
              </div>
            </section>
          )}

          {/* Metadata section */}
          <section className="pt-4 border-t border-border-subtle">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">
              Metadata
            </h3>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-dim">Event ID:</dt>
                <dd className="text-text-primary font-mono">{decision.event_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-dim">Question ID:</dt>
                <dd className="text-text-primary font-mono">{decision.question_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-dim">Plan:</dt>
                <dd className="text-text-primary font-mono">{decision.plan_id}</dd>
              </div>
              {decision.step_id && (
                <div className="flex justify-between">
                  <dt className="text-text-dim">Step:</dt>
                  <dd className="text-text-primary font-mono">{decision.step_id}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-text-dim">Trajectory Ref:</dt>
                <dd className="text-text-primary font-mono truncate max-w-[240px]">
                  {decision.agent_trajectory_ref}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
