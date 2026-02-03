/**
 * GateBanner - Banner component for pending gates notification
 *
 * Shows a warning banner when there are pending gates requiring approval.
 * Includes review button that opens the GateDetailPanel.
 * Features sound notifications for new gates.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { GateDetailPanel } from './GateDetailPanel';
import { usePendingGates } from '@/hooks/usePendingGates';
import { useGateNotificationSound } from '@/hooks/useNotificationSound';
import type { Gate } from '@/types';

interface GateBannerProps {
  runId?: string;
  className?: string;
}

export function GateBanner({ runId, className }: GateBannerProps) {
  const { onGateReached, isSoundEnabled, toggleSound } = useGateNotificationSound();

  const { gates, count, refetch } = usePendingGates({
    runId,
    onGateReached,
  });

  const [selectedGate, setSelectedGate] = useState<Gate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleReview = (gate?: Gate) => {
    // If a specific gate is provided, use it; otherwise use the first pending gate
    const gateToReview = gate || gates[0];
    if (gateToReview) {
      setSelectedGate(gateToReview);
      setDetailOpen(true);
    }
  };

  const handleApproved = () => {
    refetch();
  };

  const handleRejected = () => {
    refetch();
  };

  if (count === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-4 px-4 py-3',
          'bg-amber-500/10 border border-amber-500/20 rounded-lg',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 p-1.5 bg-amber-500/20 rounded-lg">
            <GateIcon className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="font-medium text-text-primary">
              {count === 1 ? (
                'Gate requires approval'
              ) : (
                <>{count} gates require approval</>
              )}
            </p>
            <p className="text-sm text-text-muted">
              {count === 1 ? (
                <>Review and approve to continue the run</>
              ) : (
                <>Review and approve gates to continue the run</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle button */}
          <button
            onClick={toggleSound}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isSoundEnabled
                ? 'text-amber-500 hover:bg-amber-500/20'
                : 'text-text-muted hover:bg-bg-tertiary'
            )}
            title={isSoundEnabled ? 'Sound notifications on' : 'Sound notifications off'}
          >
            {isSoundEnabled ? (
              <SoundOnIcon className="h-4 w-4" />
            ) : (
              <SoundOffIcon className="h-4 w-4" />
            )}
          </button>

          {/* Review button */}
          <Button
            onClick={() => handleReview()}
            className="bg-amber-500 text-bg-deep hover:bg-amber-400"
          >
            Review{count > 1 && ` (${count})`}
          </Button>
        </div>
      </div>

      {/* Gate Detail Panel */}
      <GateDetailPanel
        gate={selectedGate}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onApproved={handleApproved}
        onRejected={handleRejected}
      />
    </>
  );
}

/**
 * GateBannerSimple - Simple version that accepts a gate prop directly
 * Useful when the parent already has gate data
 */
interface GateBannerSimpleProps {
  gate: Gate | null;
  onReview?: (gate: Gate) => void;
  className?: string;
}

export function GateBannerSimple({ gate, onReview, className }: GateBannerSimpleProps) {
  // Hidden when no pending gate
  if (!gate) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3',
        'bg-amber-500/10 border border-amber-500/20 rounded-lg',
        className
      )}
    >
      {/* Left side: icon and message */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Warning icon */}
        <div className="flex-shrink-0">
          <GateIcon className="h-5 w-5 text-amber-500" />
        </div>

        {/* Message */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-500">
            Gate pending approval
          </p>
          <p className="text-xs text-text-secondary truncate">
            {gate.title}
          </p>
        </div>
      </div>

      {/* Right side: review button */}
      {onReview && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReview(gate)}
          className="flex-shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/50"
        >
          <EyeIcon />
          Review
        </Button>
      )}
    </div>
  );
}

/**
 * GateBannerCompact - Compact version for smaller spaces
 */
export function GateBannerCompact({ runId, className }: GateBannerProps) {
  const { onGateReached } = useGateNotificationSound();

  const { gates, count, refetch } = usePendingGates({
    runId,
    onGateReached,
  });

  const [selectedGate, setSelectedGate] = useState<Gate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleReview = () => {
    if (gates[0]) {
      setSelectedGate(gates[0]);
      setDetailOpen(true);
    }
  };

  if (count === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleReview}
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          'bg-amber-500/10 border border-amber-500/20 rounded-lg',
          'hover:bg-amber-500/20 hover:border-amber-500/30',
          'transition-colors',
          className
        )}
      >
        <GateIcon className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-500">
          {count} {count === 1 ? 'gate' : 'gates'} pending
        </span>
      </button>

      <GateDetailPanel
        gate={selectedGate}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onApproved={refetch}
        onRejected={refetch}
      />
    </>
  );
}

/**
 * CompactGateBanner - Legacy compact version for sidebar
 * @deprecated Use GateBannerCompact instead
 */
interface CompactGateBannerProps {
  gateCount: number;
  onClick?: () => void;
  className?: string;
}

export function CompactGateBanner({ gateCount, onClick, className }: CompactGateBannerProps) {
  if (gateCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2',
        'bg-amber-500/10 border border-amber-500/20 rounded-md',
        'hover:bg-amber-500/20 transition-colors',
        'text-left',
        className
      )}
    >
      <GateIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
      <span className="text-xs font-medium text-amber-500">
        {gateCount} {gateCount === 1 ? 'gate' : 'gates'} pending
      </span>
    </button>
  );
}

function GateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SoundOnIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SoundOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
