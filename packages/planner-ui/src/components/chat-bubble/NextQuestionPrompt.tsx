import { Button } from '../ui/Button';
import { getRoleConfig } from '@/config/agentRoles';
import type { AgentRole } from '@/hooks/useAgentOrchestration';

interface NextQuestionPromptProps {
  agentRole: AgentRole;
  onShowNext: () => void;
  onLater: () => void;
}

export function NextQuestionPrompt({
  agentRole,
  onShowNext,
  onLater,
}: NextQuestionPromptProps) {
  const roleConfig = getRoleConfig(agentRole);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onLater}
        aria-hidden="true"
      />

      {/* Next question prompt */}
      <div className="fixed right-4 bottom-16 w-72 bg-bg-tertiary border border-border-subtle rounded-xl shadow-lg p-4 z-50 animate-slide-up">
        <p className="text-sm text-accent-green mb-2 flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
            <path d="M2 7l3 3 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sent to {roleConfig.label}
        </p>
        <p className="text-xs text-text-secondary mb-3">
          Another agent has a question
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onLater} className="flex-1">
            Later
          </Button>
          <Button variant="default" size="sm" onClick={onShowNext} className="flex-1">
            Show Now
          </Button>
        </div>
      </div>
    </>
  );
}
