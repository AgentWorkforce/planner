interface ThinkingBadgeProps {
  label: string | null;
}

export function ThinkingBadge({ label }: ThinkingBadgeProps) {
  if (!label) return null;

  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-text-muted">
      <span className="text-[10px]">◎</span>
      <span>{label}</span>
    </span>
  );
}
