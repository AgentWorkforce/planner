/**
 * RunControls - Control buttons for a run (pause, resume, cancel)
 *
 * Features:
 * - Pause button (visible when running)
 * - Resume button (visible when paused)
 * - Cancel button (always visible, with confirmation dialog)
 * - Loading state on buttons during API call
 * - Disabled when run is completed/cancelled/failed
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RunStatus } from '@/types';

interface RunControlsProps {
  runId: string;
  status: RunStatus;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  className?: string;
}

export function RunControls({
  runId: _runId,
  status,
  onPause,
  onResume,
  onCancel,
  className,
}: RunControlsProps) {
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const isRunning = status === RunStatus.RUNNING;
  const isPaused = status === RunStatus.PAUSED;
  const isTerminal =
    status === RunStatus.COMPLETED ||
    status === RunStatus.FAILED ||
    status === RunStatus.CANCELLED;

  // Disable all controls for terminal states
  if (isTerminal) {
    return null;
  }

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await onPause();
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await onResume();
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
      setShowCancelDialog(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        {/* Pause button - visible when running */}
        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={isPausing}
            className="gap-1.5"
          >
            {isPausing ? (
              <LoadingSpinner />
            ) : (
              <PauseIcon />
            )}
            Pause
          </Button>
        )}

        {/* Resume button - visible when paused */}
        {isPaused && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleResume}
            disabled={isResuming}
            className="gap-1.5"
          >
            {isResuming ? (
              <LoadingSpinner />
            ) : (
              <PlayIcon />
            )}
            Resume
          </Button>
        )}

        {/* Cancel button - always visible for active runs */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelDialog(true)}
          disabled={isCancelling}
          className="gap-1.5 text-error hover:bg-error-light hover:border-error"
        >
          {isCancelling ? (
            <LoadingSpinner />
          ) : (
            <CancelIcon />
          )}
          Cancel
        </Button>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Run</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this run? This action cannot be undone.
              Any in-progress tasks will be terminated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCancelling}
            >
              Keep Running
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={isCancelling}
              className="gap-1.5"
            >
              {isCancelling ? (
                <>
                  <LoadingSpinner />
                  Cancelling...
                </>
              ) : (
                'Cancel Run'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Pause icon
 */
function PauseIcon() {
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
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

/**
 * Play icon
 */
function PlayIcon() {
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
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

/**
 * Cancel/X icon
 */
function CancelIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Loading spinner
 */
function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
