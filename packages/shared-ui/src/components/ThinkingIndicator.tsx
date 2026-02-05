import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

export interface ThinkingIndicatorProps {
  /** Whether the indicator is active */
  isActive?: boolean;
  /** When processing started (for elapsed time display) */
  startTime?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show elapsed time */
  showElapsed?: boolean;
  /** Show label text */
  showLabel?: boolean;
  /** Label text (default: "thinking") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

const sizeConfig = {
  sm: { dot: "w-1 h-1", gap: "gap-0.5", text: "text-[10px]" },
  md: { dot: "w-1.5 h-1.5", gap: "gap-1", text: "text-xs" },
  lg: { dot: "w-2 h-2", gap: "gap-1.5", text: "text-sm" },
};

/**
 * Animated thinking/processing indicator with bouncing dots.
 * Shows elapsed time and optional label.
 */
export function ThinkingIndicator({
  isActive = true,
  startTime,
  size = "md",
  showElapsed = false,
  showLabel = false,
  label = "thinking",
  className,
}: ThinkingIndicatorProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    if (!isActive || !startTime) {
      setElapsedMs(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedMs(Date.now() - startTime);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isActive, startTime]);

  if (!isActive) {
    return null;
  }

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const config = sizeConfig[size];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-primary", className)}
      title="Processing..."
    >
      <span className={cn("inline-flex items-center", config.gap)}>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className={cn(config.dot, "rounded-full bg-current animate-bounce")}
            style={{ animationDelay: `${delay}ms`, animationDuration: "800ms" }}
          />
        ))}
      </span>
      {showLabel && (
        <span className={cn("font-medium", config.text)}>{label}</span>
      )}
      {showElapsed && elapsedMs > 0 && (
        <span className={cn("opacity-70", config.text)}>
          {formatElapsed(elapsedMs)}
        </span>
      )}
    </span>
  );
}

/**
 * Compact pulsing dot indicator for inline use.
 */
export function ThinkingDot({
  isActive = true,
  className,
}: {
  isActive?: boolean;
  className?: string;
}) {
  if (!isActive) return null;

  return (
    <span
      className={cn("inline-flex items-center justify-center w-3 h-3", className)}
      title="Processing..."
    >
      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
    </span>
  );
}
