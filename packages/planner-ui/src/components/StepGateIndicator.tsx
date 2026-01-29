import type { Gate, GateApprovalStatus } from '@/types';

interface StepGateIndicatorProps {
  /** Gate configuration */
  gate: Gate;
  /** Current approval status (if known) */
  status?: GateApprovalStatus;
  /** Whether this gate is currently pending */
  isPending?: boolean;
  /** Callback when clicked */
  onClick?: () => void;
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
    if (isPending) return 'pending';
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'default';
  };

  const getIcon = () => {
    if (status === 'approved') return '✓';
    if (status === 'rejected') return '✗';
    if (isPending) return '⏳';
    return '🔒';
  };

  const getLabel = () => {
    if (status === 'approved') return 'Gate approved';
    if (status === 'rejected') return 'Gate rejected';
    if (isPending) return 'Awaiting approval';
    return `Gate: ${gate.type}`;
  };

  return (
    <button
      className={`step-gate-indicator step-gate-indicator--${getStatusClass()}`}
      onClick={onClick}
      aria-label={getLabel()}
      title={getLabel()}
    >
      <span className="step-gate-icon" aria-hidden="true">
        {getIcon()}
      </span>
      {gate.approver_role && (
        <span className="step-gate-role">{gate.approver_role}</span>
      )}
    </button>
  );
}
