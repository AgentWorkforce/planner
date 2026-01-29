import type { ConnectionStatus } from '@/hooks/useAIConnectionStatus';
import type { PlanStatus } from '@/types';

interface AIConnectionBadgeProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Plan status - used to determine if connect button should be shown */
  planStatus?: PlanStatus;
  /** Whether connection is in progress */
  isConnecting?: boolean;
  /** Error message from connection attempt */
  connectError?: string | null;
  /** Callback to initiate connection */
  onConnect?: () => void;
  /** Callback to clear error */
  onClearError?: () => void;
}

/**
 * Badge showing AI connection status with optional Connect button.
 * Shows 'AI Connected' when connected, 'Demo Mode' + Connect button when not.
 * Only draft plans can have AI sessions.
 */
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
    <div className="ai-connection-badge-container">
      <div
        className={`ai-connection-badge ai-connection-badge--${status} ${isConnecting ? 'connecting' : ''}`}
      >
        {showSpinner ? (
          <>
            <span className="ai-connection-spinner" aria-hidden="true" />
            <span className="ai-connection-text">
              {isConnecting ? 'Connecting...' : 'Loading...'}
            </span>
          </>
        ) : status === 'connected' ? (
          <>
            <span className="ai-connection-icon ai-connection-icon--connected" aria-hidden="true">
              ✓
            </span>
            <span className="ai-connection-text">AI Connected</span>
          </>
        ) : (
          <>
            <span className="ai-connection-icon ai-connection-icon--demo" aria-hidden="true">
              ○
            </span>
            <span className="ai-connection-text">Demo Mode</span>
          </>
        )}
      </div>

      {showConnectButton && (
        <button
          className="ai-connection-connect-btn"
          onClick={onConnect}
          disabled={isConnecting}
          title={canConnect ? 'Connect to AI planning agent' : 'Only draft plans support AI'}
        >
          Connect AI
        </button>
      )}

      {status === 'demo' && !canConnect && (
        <span
          className="ai-connection-hint"
          title="Only draft plans can have AI sessions. Approved/published plans are read-only."
        >
          (Read-only)
        </span>
      )}

      {connectError && (
        <div className="ai-connection-error">
          <span className="ai-connection-error-text">{connectError}</span>
          {onClearError && (
            <button
              className="ai-connection-error-dismiss"
              onClick={onClearError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
