import { SpecialistCard } from '@/components/specialists';
import { Badge, Skeleton } from '@/components/ui';
import { BrainIcon } from '@/components/icons';

interface SessionUnderstandingTabProps {
  understanding: Record<string, Record<string, unknown>>;
  activeSpecialists?: Array<{ name: string; roleHint?: string }>;
  loading?: boolean;
}

export function SessionUnderstandingTab({
  understanding,
  activeSpecialists = [],
  loading = false,
}: SessionUnderstandingTabProps) {
  const specialistNames = Object.keys(understanding);
  const specialistCount = specialistNames.length;

  // Create a map of role hints from activeSpecialists
  const roleHintMap = new Map<string, string>();
  for (const specialist of activeSpecialists) {
    if (specialist.roleHint) {
      roleHintMap.set(specialist.name, specialist.roleHint);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Specialist Observations
          </h2>
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  // Empty state
  if (specialistCount === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Specialist Observations
          </h2>
          <Badge variant="default" className="text-xs">
            0
          </Badge>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BrainIcon size="lg" className="text-accent-purple/30 mb-3" />
          <p className="text-sm text-text-muted max-w-md">
            No specialist observations yet. As you brainstorm, specialists will
            contribute insights.
          </p>
        </div>
      </div>
    );
  }

  // Normal state: Grid of SpecialistCard components
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          Specialist Observations
        </h2>
        <Badge variant="default" className="text-xs">
          {specialistCount}
        </Badge>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {specialistNames.map((name) => (
          <SpecialistCard
            key={name}
            name={name}
            roleHint={roleHintMap.get(name)}
            observations={understanding[name]}
            defaultExpanded={true}
          />
        ))}
      </div>
    </div>
  );
}
