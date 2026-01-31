/**
 * DuplicateQuestionPrompt Component
 *
 * Shows when an agent attempts to ask a question similar to one already in queue.
 * Offers options to subscribe to the existing question or ask anyway.
 */

import { AgentAvatar } from './AgentAvatar';
import { Button } from './ui/Button';
import { getRoleConfig } from '@/config/agentRoles';
import type { Question } from '@/types/plan';
import type { AgentRole } from '@/hooks/useAgentOrchestration';

interface DuplicateQuestionPromptProps {
  /** The new question the agent wants to ask */
  newQuestionText: string;
  /** The existing similar question */
  existingQuestion: Question;
  /** Current agent ID for subscription */
  agentId: string;
  /** Callback to subscribe to existing question */
  onSubscribe: () => void;
  /** Callback to ask the question anyway (create new) */
  onAskAnyway: () => void;
  /** Callback to cancel */
  onCancel: () => void;
  /** Whether an action is in progress */
  isProcessing?: boolean;
}

export function DuplicateQuestionPrompt({
  newQuestionText,
  existingQuestion,
  agentId,
  onSubscribe,
  onAskAnyway,
  onCancel,
  isProcessing = false,
}: DuplicateQuestionPromptProps) {
  // Check if role is valid, fallback to 'coder' if unknown
  const agentRole = (
    ['architect', 'ui-designer', 'data-modeler', 'coder', 'tester', 'security'].includes(
      existingQuestion.agent_role
    )
      ? existingQuestion.agent_role
      : 'coder'
  ) as AgentRole;

  const roleConfig = getRoleConfig(agentRole);
  const alreadySubscribed = existingQuestion.subscribers.includes(agentId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Prompt dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-bg-tertiary border border-border-subtle rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-bg-secondary border-b border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary">
            Similar Question Found
          </h3>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-text-secondary mb-4">
            A similar question is already waiting for an answer. Would you like to
            subscribe to that question instead?
          </p>

          {/* Existing question preview */}
          <div className="bg-bg-secondary rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2 mb-2">
              <AgentAvatar
                role={agentRole}
                state="needs_input"
                size="sm"
                showTooltip={false}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-muted">
                  {roleConfig.label} asked:
                </div>
                <p className="text-sm text-text-primary line-clamp-2">
                  {existingQuestion.text}
                </p>
                {existingQuestion.subscribers.length > 0 && (
                  <div className="text-xs text-accent-cyan mt-1">
                    {existingQuestion.subscribers.length} agent{existingQuestion.subscribers.length !== 1 ? 's' : ''} waiting for answer
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* New question preview */}
          <div className="text-xs text-text-muted mb-1">Your question:</div>
          <div className="text-sm text-text-secondary bg-bg-elevated rounded px-2 py-1.5 line-clamp-2">
            {newQuestionText}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-bg-secondary border-t border-border-subtle">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAskAnyway}
            disabled={isProcessing}
          >
            Ask Anyway
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onSubscribe}
            disabled={isProcessing || alreadySubscribed}
          >
            {isProcessing ? 'Subscribing...' : alreadySubscribed ? 'Already Subscribed' : 'Subscribe'}
          </Button>
        </div>
      </div>
    </>
  );
}
