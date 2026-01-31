import type { PendingGate } from '@/types';
import { LockIcon } from './icons';

interface PendingGatesNotificationProps {
  gates: PendingGate[];
  onGateClick?: (stepId: string) => void;
}

// Hourglass icon
function HourglassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

/**
 * Notification banner showing pending gates that need human approval.
 * Displayed prominently at the top of the plan view.
 */
export function PendingGatesNotification({ gates, onGateClick }: PendingGatesNotificationProps) {
  if (gates.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-warning/10 border border-warning/30 rounded-xl p-4"
      role="alert"
    >
      <div className="flex items-center gap-3 mb-3">
        <HourglassIcon className="text-warning" />
        <span className="font-medium text-warning">
          {gates.length === 1
            ? '1 gate awaiting approval'
            : `${gates.length} gates awaiting approval`}
        </span>
      </div>
      <ul className="space-y-2">
        {gates.map((gate) => (
          <li key={gate.step_id}>
            <button
              className="w-full flex items-center justify-between gap-4 p-3 bg-bg-secondary rounded-lg text-left hover:bg-bg-hover transition-colors"
              onClick={() => onGateClick?.(gate.step_id)}
              aria-label={`Review gate for ${gate.step_title}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <LockIcon size="sm" className="text-warning flex-shrink-0" />
                <span className="font-medium text-text-primary truncate">{gate.step_title}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted flex-shrink-0">
                {gate.gate.approver_role && (
                  <span>Approver: {gate.gate.approver_role}</span>
                )}
                <span>Since {new Date(gate.blocked_since).toLocaleTimeString()}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
