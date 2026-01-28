interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <span className="loading-message">{message}</span>
    </div>
  );
}
