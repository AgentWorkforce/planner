import { cn } from "../utils/cn";

export interface LoadingSpinnerProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

/**
 * Simple loading spinner with size variants.
 */
export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <svg
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="32"
        strokeLinecap="round"
        className="opacity-25"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="32"
        strokeLinecap="round"
        strokeDashoffset="32"
        className="opacity-75"
      />
    </svg>
  );
}
