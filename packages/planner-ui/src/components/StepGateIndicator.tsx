import type { Gate, GateApprovalStatus } from '@/types';
import { LockIcon, CheckIcon, CloseIcon } from './icons';

interface StepGateIndicatorProps {
  gate: Gate;
  status?: GateApprovalStatus;
  isPending?: boolean;
  onClick?: () => void;
}

// Hourglass icon for pending state
function HourglassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
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
 * Visual indicator on a step showing it has a gate.
 * Shows different states: has gate, pending approval, approved, rejected.
 */
export function StepGateIndicator({
  gate,
  status,
  isPending = false,
  onClick,
}: StepGateIndicatorProps) {
  const getStatusClass = () => {
    if (isPending) return 'bg-warning/10 text-warning border-warning/30';
    if (status === 'approved') return 'bg-success/10 text-success border-success/30';
    if (status === 'rejected') return 'bg-error/10 text-error border-error/30';
    return 'bg-bg-tertiary text-text-secondary border-border-subtle';
  };

  const getIcon = () => {
    if (status === 'approved') return <CheckIcon size="sm" />;
    if (status === 'rejected') return <CloseIcon size="sm" />;
    if (isPending) return <HourglassIcon className="w-4 h-4" />;
    return <LockIcon size="sm" />;
  };

  const getLabel = () => {
    if (status === 'approved') return 'Gate approved';
    if (status === 'rejected') return 'Gate rejected';
    if (isPending) return 'Awaiting approval';
    return `Gate: ${gate.type}`;
  };

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border transition-colors hover:opacity-80 ${getStatusClass()}`}
      onClick={onClick}
      aria-label={getLabel()}
      title={getLabel()}
    >
      {getIcon()}
      {gate.approver_role && (
        <span className="max-w-20 truncate">{gate.approver_role}</span>
      )}
    </button>
  );
}
