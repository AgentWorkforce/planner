import { useMemo } from 'react';
import type { SignalWithExtraction } from '@/hooks/useCultivateCluster';
import { cn } from '@/lib/utils';

interface QuestionsPanelProps {
  signals: SignalWithExtraction[];
}

interface AggregatedQuestion {
  text: string;
  frequency: number;
  isExplicit: boolean;
}

function aggregateQuestions(signals: SignalWithExtraction[]): AggregatedQuestion[] {
  const questionMap = new Map<string, { text: string; frequency: number; isExplicit: boolean }>();

  for (const signal of signals) {
    if (!signal.extraction?.questions) continue;

    for (const q of signal.extraction.questions) {
      const key = q.text.toLowerCase().trim();
      const existing = questionMap.get(key);
      if (existing) {
        existing.frequency += 1;
        // If any occurrence is explicit, mark as explicit
        if (q.is_explicit) existing.isExplicit = true;
      } else {
        questionMap.set(key, {
          text: q.text,
          frequency: 1,
          isExplicit: q.is_explicit,
        });
      }
    }
  }

  return Array.from(questionMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 8);
}

export function QuestionsPanel({ signals }: QuestionsPanelProps) {
  const questions = useMemo(() => aggregateQuestions(signals), [signals]);

  if (questions.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
        Questions being asked
      </p>
      <div className="space-y-1.5">
        {questions.map((q) => (
          <div
            key={q.text.toLowerCase().trim()}
            className={cn(
              'flex items-start gap-2 px-2 py-1.5 rounded-lg',
              'bg-bg-secondary border-l-2 border-indigo-500/60'
            )}
          >
            <span className="text-indigo-400 text-sm font-semibold shrink-0 mt-px">?</span>
            <span className="text-sm text-text-secondary flex-1 leading-snug">
              {q.text}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {q.frequency > 1 && (
                <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                  {q.frequency}x
                </span>
              )}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                q.isExplicit
                  ? 'text-text-muted bg-bg-tertiary'
                  : 'text-text-muted/70 bg-bg-tertiary/60 italic'
              )}>
                {q.isExplicit ? 'explicit' : 'implied'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
