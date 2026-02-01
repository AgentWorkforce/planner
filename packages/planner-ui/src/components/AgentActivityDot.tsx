/**
 * AgentActivityDot component.
 *
 * Renders a small pulsing green dot to indicate an agent is currently working
 * on a plan. Hidden when not active.
 */

interface AgentActivityDotProps {
  active: boolean;
  className?: string;
}

/**
 * Visual indicator showing an agent is actively working on a plan.
 *
 * Renders a 6x6px pulsing green dot with a tooltip.
 * Returns null when not active.
 */
export function AgentActivityDot({ active, className = '' }: AgentActivityDotProps) {
  if (!active) {
    return null;
  }

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse ${className}`}
      title="Agent working"
      aria-label="Agent currently working on this plan"
    />
  );
}
