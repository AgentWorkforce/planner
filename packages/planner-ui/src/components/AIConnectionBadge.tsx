import { CheckIcon, CloseIcon } from './icons';
import type { ConnectionStatus } from '@/hooks/useAIConnectionStatus';
import type { PlanStatus } from '@/types';

interface AIConnectionBadgeProps {
  status: ConnectionStatus;
  planStatus?: PlanStatus;
  isConnecting?: boolean;
  connectError?: string | null;
  onConnect?: () => void;
  onClearError?: () => void;
}

export function AIConnectionBadge({
  status,
  planStatus = 'draft',
  isConnecting = false,
  connectError = null,
  onConnect,
  onClearError,
}: AIConnectionBadgeProps) {
  const canConnect = planStatus === 'draft';
  const showSpinner = status === 'loading' || isConnecting;
  const showConnectButton = status === 'demo' && canConnect && onConnect;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
          status === 'connected'
            ? 'bg-success/10 text-success'
            : status === 'loading' || isConnecting
            ? 'bg-accent-cyan/10 text-accent-cyan'
            : 'bg-bg-tertiary text-text-muted'
        }`}
      >
        {showSpinner ? (
          <>
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <span>{isConnecting ? 'Connecting...' : 'Loading...'}</span>
          </>
        ) : status === 'connected' ? (
          <>
            <CheckIcon size="sm" />
            <span>AI Connected</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full border border-current" aria-hidden="true" />
            <span>Demo Mode</span>
          </>
        )}
      </div>

      {showConnectButton && (
        <button
          className="px-2 py-0.5 text-xs bg-accent-cyan text-bg-deep font-medium rounded transition-all duration-150 hover:shadow-glow-cyan disabled:opacity-50"
          onClick={onConnect}
          disabled={isConnecting}
          title={canConnect ? 'Connect to AI planning agent' : 'Only draft plans support AI'}
        >
          Connect AI
        </button>
      )}

      {status === 'demo' && !canConnect && (
        <span
          className="text-xs text-text-muted"
          title="Only draft plans can have AI sessions. Approved/published plans are read-only."
        >
          (Read-only)
        </span>
      )}

      {connectError && (
        <div className="flex items-center gap-1 px-2 py-1 bg-error/10 text-error text-xs rounded">
          <span>{connectError}</span>
          {onClearError && (
            <button
              className="p-0.5 hover:bg-error/20 rounded transition-colors"
              onClick={onClearError}
              aria-label="Dismiss error"
            >
              <CloseIcon size="sm" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
