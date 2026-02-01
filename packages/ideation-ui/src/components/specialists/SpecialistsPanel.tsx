import { SpecialistCard } from './SpecialistCard';
import { Badge } from '@/components/ui';
import { AlertIcon, HelpCircleIcon, BrainIcon } from '@/components/icons';

interface ActiveSpecialist {
  name: string;
  roleHint?: string;
}

interface SpecialistsPanelProps {
  understanding: Record<string, Record<string, unknown>>;
  activeSpecialists?: ActiveSpecialist[];
}

function countTotalConcerns(
  understanding: Record<string, Record<string, unknown>>
): number {
  let total = 0;
  for (const observations of Object.values(understanding)) {
    const concerns = observations.concerns;
    if (Array.isArray(concerns)) {
      total += concerns.length;
    } else if (typeof concerns === 'number') {
      total += concerns;
    }
  }
  return total;
}

function countTotalQuestions(
  understanding: Record<string, Record<string, unknown>>
): number {
  let total = 0;
  for (const observations of Object.values(understanding)) {
    const questions = observations.questions;
    if (Array.isArray(questions)) {
      total += questions.length;
    } else if (typeof questions === 'number') {
      total += questions;
    }
  }
  return total;
}

export function SpecialistsPanel({
  understanding,
  activeSpecialists = [],
}: SpecialistsPanelProps) {
  const specialistNames = Object.keys(understanding);
  const specialistCount = specialistNames.length;
  const totalConcerns = countTotalConcerns(understanding);
  const totalQuestions = countTotalQuestions(understanding);

  // Create a map of role hints from activeSpecialists
  const roleHintMap = new Map<string, string>();
  for (const specialist of activeSpecialists) {
    if (specialist.roleHint) {
      roleHintMap.set(specialist.name, specialist.roleHint);
    }
  }

  // Empty state
  if (specialistCount === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-text-primary">
            Specialists
          </h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <BrainIcon size="lg" className="text-accent-purple/30 mb-3" />
          <p className="text-sm text-text-muted">
            Specialists will appear as needed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Specialists
          </h3>
          <Badge variant="default" className="text-xs">
            {specialistCount}
          </Badge>
        </div>
      </div>

      {/* Body: Specialist Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {specialistNames.map((name) => (
          <SpecialistCard
            key={name}
            name={name}
            roleHint={roleHintMap.get(name)}
            observations={understanding[name]}
          />
        ))}
      </div>

      {/* Footer: Aggregated Alerts */}
      {(totalConcerns > 0 || totalQuestions > 0) && (
        <div className="p-4 border-t border-border-subtle">
          <div className="flex gap-4 justify-center">
            {totalConcerns > 0 && (
              <div className="flex items-center gap-1 text-warning text-xs">
                <AlertIcon size="sm" />
                <span>{totalConcerns} concerns</span>
              </div>
            )}
            {totalQuestions > 0 && (
              <div className="flex items-center gap-1 text-accent-purple text-xs">
                <HelpCircleIcon size="sm" />
                <span>{totalQuestions} questions</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
