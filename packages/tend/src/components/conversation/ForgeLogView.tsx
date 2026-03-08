import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type {
  BuildEvent,
  RunStatus,
  RunMetrics,
  StepState,
  GateState,
  QuestionState,
} from '@/hooks/useBuildMonitor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ForgeLogViewProps {
  eventLog: BuildEvent[];
  runStatus: RunStatus | null;
  runMetrics: RunMetrics | null;
  steps: Map<string, StepState>;
  gates: GateState[];
  questions: QuestionState[];
  /** Step name to scroll to and highlight (title-based, matches SSE stepName) */
  focusedStepName?: string | null;
  /** Called when a step group header is clicked */
  onStepClick?: (stepName: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Event grouping types
// ---------------------------------------------------------------------------

interface RunGroup {
  kind: 'run';
  events: BuildEvent[];
}

interface StepGroup {
  kind: 'step';
  stepName: string;
  events: BuildEvent[];
  isTerminal: boolean;
}

type EventGroup = RunGroup | StepGroup;

const STEP_TERMINAL_STATUSES = new Set(['completed', 'failed', 'skipped']);

function groupEvents(eventLog: BuildEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  const stepGroupMap = new Map<string, StepGroup>();

  for (const event of eventLog) {
    // Skip noisy events that don't render
    if (event.type === 'ping' || event.type === 'run:metrics') continue;

    const isRunLevel = !event.stepName || event.type.startsWith('run:');

    if (isRunLevel) {
      // Find or create a run group at the end of groups
      const last = groups[groups.length - 1];
      if (last?.kind === 'run') {
        last.events.push(event);
      } else {
        const g: RunGroup = { kind: 'run', events: [event] };
        groups.push(g);
      }
    } else {
      const name = event.stepName!;
      let stepGroup = stepGroupMap.get(name);

      if (!stepGroup) {
        stepGroup = { kind: 'step', stepName: name, events: [], isTerminal: false };
        stepGroupMap.set(name, stepGroup);
        groups.push(stepGroup);
      }

      stepGroup.events.push(event);

      // Mark terminal when we see a terminal step:status
      if (
        event.type === 'step:status' &&
        STEP_TERMINAL_STATUSES.has((event.data.status as string) ?? '')
      ) {
        stepGroup.isTerminal = true;
      }
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Single event line rendering
// ---------------------------------------------------------------------------

interface EventLineConfig {
  icon: string;
  color: string;
  text: string;
}

function getEventLineConfig(
  event: BuildEvent,
  _steps: Map<string, StepState>,
  _gates: GateState[],
  _questions: QuestionState[],
): EventLineConfig | null {
  const d = event.data;

  switch (event.type) {
    case 'run:status': {
      const status = d.status as string;
      if (status === 'running') {
        return { icon: '▸', color: 'text-accent-primary', text: 'RUN STARTED' };
      }
      if (status === 'completed') {
        const stepsCompleted = d.stepsCompleted ?? d.steps_completed;
        const stepsTotal = d.stepsTotal ?? d.steps_total;
        const costVal = (d.total_cost_usd ?? d.totalCostUsd) as number | undefined;
        const cost = typeof costVal === 'number' ? formatCost(costVal) : null;
        const durationMs = ((d.duration_ms ?? d.durationMs) as number | undefined) ?? null;
        const parts = [`RUN COMPLETED`];
        if (stepsCompleted != null && stepsTotal != null) parts.push(`${stepsCompleted}/${stepsTotal}`);
        if (cost) parts.push(cost);
        if (durationMs != null) parts.push(formatDuration(durationMs as number));
        return { icon: '✓', color: 'text-success', text: parts.join(' · ') };
      }
      if (status === 'failed') {
        const err = (d.error as string | undefined) ?? 'unknown error';
        return { icon: '✗', color: 'text-error', text: `RUN FAILED · ${err}` };
      }
      if (status === 'cancelled') {
        return { icon: '■', color: 'text-warning', text: 'RUN CANCELLED' };
      }
      if (status === 'paused') {
        return { icon: '‖', color: 'text-warning', text: 'RUN PAUSED' };
      }
      return { icon: '▸', color: 'text-text-secondary', text: `RUN STATUS: ${status}` };
    }

    case 'step:status': {
      const status = d.status as string;
      const stepName = event.stepName ?? '';
      if (status === 'running') {
        return { icon: '┬', color: 'text-text-primary', text: `[${stepName}] spawning agent` };
      }
      if (status === 'completed') {
        return { icon: '└─', color: 'text-success', text: 'completed' };
      }
      if (status === 'failed') {
        const err = (d.error as string | undefined) ?? 'failed';
        return { icon: '└─', color: 'text-error', text: `failed: ${err}` };
      }
      if (status === 'skipped') {
        return { icon: '└─', color: 'text-text-muted', text: 'skipped' };
      }
      if (status === 'retrying') {
        const attempt = d.attempt as number | undefined;
        const suffix = attempt != null ? ` (attempt ${attempt})` : '';
        return { icon: '├─', color: 'text-warning', text: `retrying${suffix}` };
      }
      return null;
    }

    case 'step:scored': {
      const score = d.score as number | undefined;
      const reasoning = d.reasoning as string | undefined;
      if (score == null) return null;
      const color = score >= 0.7 ? 'text-success' : 'text-warning';
      const scoreStr = score.toFixed(2);
      const text = reasoning ? `Score ${scoreStr} — "${reasoning}"` : `Score ${scoreStr}`;
      return { icon: '├─', color, text };
    }

    case 'step:metrics': {
      const model = d.model as string | undefined;
      const durationMs = (d.duration_ms ?? d.durationMs) as number | undefined;
      const cost = (d.estimated_cost_usd ?? d.estimatedCostUsd) as number | undefined;
      const parts: string[] = [];
      if (model) parts.push(model);
      if (durationMs != null) parts.push(formatDuration(durationMs));
      if (cost != null) parts.push(formatCost(cost));
      return { icon: '├─', color: 'text-text-secondary', text: parts.join(' · ') || 'metrics' };
    }

    case 'stall:warning': {
      const elapsedMs = (d.elapsed_ms ?? d.elapsedMs) as number | undefined;
      const suffix = elapsedMs != null ? ` — no progress for ${Math.round(elapsedMs / 1000)}s` : '';
      return { icon: '⚡', color: 'text-warning', text: `STALL${suffix}` };
    }

    case 'gate:pending':
      return { icon: '├─', color: 'text-warning', text: 'gate waiting for approval' };

    case 'gate:approved':
      return { icon: '├─', color: 'text-success', text: 'gate approved' };

    case 'gate:rejected':
      return { icon: '├─', color: 'text-error', text: 'gate rejected' };

    case 'question:pending': {
      const q = d.question as string | undefined;
      return { icon: '├─', color: 'text-accent-secondary', text: q ? `asked: "${q}"` : 'question pending' };
    }

    case 'question:answered': {
      const answer = d.answer as string | undefined;
      return { icon: '├─', color: 'text-success', text: answer ? `answered: "${answer}"` : 'answered' };
    }

    case 'question:dismissed':
      return { icon: '├─', color: 'text-text-muted', text: 'question dismissed' };

    case 'step:merge-status': {
      const status = d.status as string | undefined;
      if (status === 'merged') {
        const branch = (d.target_branch ?? d.branch) as string | undefined;
        return { icon: '├─', color: 'text-success', text: branch ? `merged → ${branch}` : 'merged' };
      }
      if (status === 'merging') {
        return { icon: '├─', color: 'text-text-secondary', text: 'merging...' };
      }
      if (status === 'failed') {
        const err = d.error as string | undefined;
        return { icon: '├─', color: 'text-error', text: err ? `merge failed: ${err}` : 'merge failed' };
      }
      return null;
    }

    case 'step:failed-enriched': {
      const err = d.error as string | undefined;
      return { icon: '├─', color: 'text-error', text: err ?? 'step failed' };
    }

    case 'step:retry-context': {
      const attempt = d.attempt as number | undefined;
      return { icon: '├─', color: 'text-text-secondary', text: attempt != null ? `retry #${attempt}` : 'retry context' };
    }

    case 'step:retries-exhausted': {
      const attempt = d.attempt as number | undefined;
      const max = (d.max_retries ?? d.maxRetries) as number | undefined;
      const suffix = attempt != null && max != null ? ` (${attempt}/${max})` : '';
      return { icon: '⚠', color: 'text-error', text: `retries exhausted${suffix}` };
    }

    case 'reconciliation:plan-retracted': {
      const reason = d.reason as string | undefined;
      return { icon: '■', color: 'text-error', text: `PLAN RETRACTED${reason ? ` — ${reason}` : ''}` };
    }

    case 'reconciliation:stall-detected': {
      const elapsedMs = (d.elapsed_ms ?? d.elapsedMs) as number | undefined;
      const suffix = elapsedMs != null ? ` — no progress for ${formatDuration(elapsedMs)}` : '';
      return { icon: '⚡', color: 'text-warning', text: `RUN STALLED${suffix}` };
    }

    case 'reconciliation:version-drift': {
      const current = d.current_version as number | undefined;
      const latest = d.latest_version as number | undefined;
      const info = current != null && latest != null ? ` (v${current} → v${latest} available)` : '';
      return { icon: '↑', color: 'text-text-secondary', text: `Newer plan version available${info}` };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// EventLine sub-component
// ---------------------------------------------------------------------------

function EventLine({
  event,
  steps,
  gates,
  questions,
}: {
  event: BuildEvent;
  steps: Map<string, StepState>;
  gates: GateState[];
  questions: QuestionState[];
}) {
  const config = getEventLineConfig(event, steps, gates, questions);
  if (!config) return null;

  return (
    <div className="flex items-baseline gap-2 font-mono text-xs leading-5">
      <span className="text-text-muted shrink-0 tabular-nums">{formatTime(event.timestamp)}</span>
      <span className={cn('shrink-0', config.color)}>{config.icon}</span>
      <span className={config.color}>{config.text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepSummaryLine — collapsed single-line summary for a terminal step
// ---------------------------------------------------------------------------

function StepSummaryLine({
  stepName,
  events,
  step,
}: {
  stepName: string;
  events: BuildEvent[];
  step: StepState | undefined;
}) {
  const finalStatus = step?.status ?? 'completed';

  const isSuccess = finalStatus === 'completed';
  const isFailed = finalStatus === 'failed';
  const isSkipped = finalStatus === 'skipped';

  const icon = isSuccess ? '✓' : isFailed ? '✗' : '·';
  const statusColor = isSuccess
    ? 'text-success'
    : isFailed
      ? 'text-error'
      : 'text-text-muted';

  const parts: string[] = [];

  if (step?.score != null) parts.push(step.score.toFixed(2));
  if (step?.model) parts.push(step.model);
  if (step?.durationMs != null) parts.push(formatDuration(step.durationMs));
  if (step?.estimatedCostUsd != null) parts.push(formatCost(step.estimatedCostUsd));

  if (isFailed && step?.error) parts.push(`"${step.error}"`);
  if (isFailed && step?.attempt && step.attempt > 1) parts.push(`${step.attempt} attempts`);
  if (isSkipped) parts.push('skipped');

  const detail = parts.length > 0 ? ` · ${parts.join(' · ')}` : '';

  // Get timestamp from the last event in the group
  const lastEvent = events[events.length - 1];
  const timestamp = lastEvent ? formatTime(lastEvent.timestamp) : '';

  return (
    <div className="flex items-baseline gap-2 font-mono text-xs leading-5">
      <span className="text-text-muted shrink-0 tabular-nums">{timestamp}</span>
      <span className={cn('shrink-0', statusColor)}>{icon}</span>
      <span className={statusColor}>
        [{stepName}]
      </span>
      <span className="text-text-secondary">
        {isSuccess ? 'completed' : isFailed ? 'failed' : 'done'}
      </span>
      {detail && (
        <span className="text-text-muted">{detail}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepJournal — collapsible agent output within a step group
// ---------------------------------------------------------------------------

const MAX_JOURNAL_LINES = 200;

function StepJournal({ output }: { output: string }) {
  const [showAll, setShowAll] = useState(false);

  const lines = useMemo(() => output.split('\n'), [output]);
  const isTruncated = lines.length > MAX_JOURNAL_LINES;
  const displayText = useMemo(
    () => (isTruncated && !showAll ? lines.slice(0, MAX_JOURNAL_LINES).join('\n') : output),
    [lines, isTruncated, showAll, output],
  );

  const toggleShowAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAll((prev) => !prev);
  }, []);

  return (
    <details
      className="mt-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <summary className="flex items-center gap-1.5 cursor-pointer text-text-muted hover:text-text-secondary text-xs font-mono select-none">
        <span className="shrink-0">⬡</span>
        <span>Agent Output</span>
        <span className="text-text-muted/60">({lines.length} lines)</span>
      </summary>
      <div className="mt-1 bg-bg-surface-raised border border-border-subtle rounded p-3 font-mono text-xs leading-relaxed overflow-x-auto">
        <pre className="whitespace-pre-wrap break-words text-text-secondary">{displayText}</pre>
        {isTruncated && (
          <button
            type="button"
            onClick={toggleShowAll}
            className="mt-2 text-accent-primary hover:text-accent-primary/80 text-xs"
          >
            {showAll ? `Show first ${MAX_JOURNAL_LINES} lines` : `Show all ${lines.length} lines`}
          </button>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// StepGroupBlock
// ---------------------------------------------------------------------------

function StepGroupBlock({
  group,
  step,
  expanded,
  onToggle,
  steps,
  gates,
  questions,
}: {
  group: StepGroup;
  step: StepState | undefined;
  expanded: boolean;
  onToggle: () => void;
  steps: Map<string, StepState>;
  gates: GateState[];
  questions: QuestionState[];
}) {
  if (group.isTerminal && !expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left hover:bg-bg-deep/40 rounded px-1 -mx-1 transition-colors"
        aria-expanded={false}
      >
        <StepSummaryLine stepName={group.stepName} events={group.events} step={step} />
      </button>
    );
  }

  return (
    <div>
      {group.isTerminal && (
        <button
          type="button"
          onClick={onToggle}
          className="w-full text-left hover:bg-bg-deep/40 rounded px-1 -mx-1 transition-colors"
          aria-expanded={true}
        >
          <StepSummaryLine stepName={group.stepName} events={group.events} step={step} />
        </button>
      )}
      <div className={cn('flex flex-col gap-0.5', group.isTerminal && 'mt-1 pl-16')}>
        {group.events.map((event) => (
          <EventLine
            key={event.id}
            event={event}
            steps={steps}
            gates={gates}
            questions={questions}
          />
        ))}
        {group.isTerminal && step?.output && (
          <StepJournal output={step.output} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildSummary — compact terminal summary block
// ---------------------------------------------------------------------------

function BuildSummary({
  steps,
  runStatus,
  runMetrics,
}: {
  steps: Map<string, StepState>;
  runStatus: RunStatus | null;
  runMetrics: RunMetrics | null;
}) {
  const stepSummaries = useMemo(() => {
    const summaries: Array<{
      name: string;
      status: StepState['status'];
      score?: number;
      costUsd?: number;
      durationMs?: number;
      error?: string;
    }> = [];

    for (const [name, step] of steps) {
      summaries.push({
        name,
        status: step.status,
        score: step.score,
        costUsd: step.estimatedCostUsd,
        durationMs: step.durationMs,
        error: step.error,
      });
    }

    return summaries;
  }, [steps]);

  // Only render when run is in a terminal state
  if (!runStatus || (runStatus !== 'completed' && runStatus !== 'failed')) {
    return null;
  }

  const passCount = stepSummaries.filter((s) => s.status === 'completed').length;
  const failCount = stepSummaries.filter((s) => s.status === 'failed').length;
  const skipCount = stepSummaries.filter((s) => s.status === 'skipped').length;
  const total = stepSummaries.length;

  const scoredSteps = stepSummaries.filter((s) => s.score != null);
  const avgScore =
    scoredSteps.length > 0
      ? scoredSteps.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSteps.length
      : null;

  return (
    <div className="mx-3 mb-3 mt-4 border border-border-default bg-bg-elevated rounded-lg p-4 font-mono text-xs">
      {/* Header */}
      <div
        className={cn(
          'text-sm font-medium mb-2',
          runStatus === 'completed' ? 'text-success' : 'text-error',
        )}
      >
        {runStatus === 'completed' ? '✓ BUILD COMPLETED' : '✗ BUILD FAILED'}
      </div>

      {/* Summary line */}
      <div className="text-text-secondary mb-3 leading-5">
        {passCount}/{total} passed
        {failCount > 0 && ` · ${failCount} failed`}
        {skipCount > 0 && ` · ${skipCount} skipped`}
        {runMetrics && runMetrics.totalCostUsd > 0 && ` · ${formatCost(runMetrics.totalCostUsd)}`}
        {runMetrics && runMetrics.avgSatisfaction > 0 &&
          ` · avg score ${runMetrics.avgSatisfaction.toFixed(2)}`}
      </div>

      {/* Step rows */}
      {stepSummaries.length > 0 && (
        <div className="space-y-0.5">
          {stepSummaries.map((step) => (
            <div key={step.name} className="flex items-baseline gap-2 leading-5">
              <span
                className={cn(
                  'w-4 shrink-0 tabular-nums',
                  step.status === 'completed' && 'text-success',
                  step.status === 'failed' && 'text-error',
                  step.status === 'skipped' && 'text-text-muted',
                  step.status === 'running' && 'text-accent-primary',
                  step.status === 'pending' && 'text-text-muted',
                  step.status === 'retrying' && 'text-warning',
                )}
              >
                {step.status === 'completed'
                  ? '✓'
                  : step.status === 'failed'
                    ? '✗'
                    : step.status === 'skipped'
                      ? '⊘'
                      : '·'}
              </span>
              <span className="w-36 truncate text-text-primary">{step.name}</span>
              <span className="w-10 text-right text-text-muted tabular-nums">
                {step.score != null ? step.score.toFixed(2) : '—'}
              </span>
              <span className="w-14 text-right text-text-muted tabular-nums">
                {step.costUsd != null ? formatCost(step.costUsd) : '—'}
              </span>
              <span className="w-16 text-right text-text-muted tabular-nums">
                {step.durationMs != null ? formatDuration(step.durationMs) : '—'}
              </span>
              {step.error && (
                <span className="text-error truncate ml-1">"{step.error}"</span>
              )}
              {step.status === 'skipped' && (
                <span className="text-text-muted ml-1">(dependency failed)</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer totals */}
      {avgScore != null && (
        <div className="mt-3 pt-2 border-t border-border-subtle text-text-muted leading-5">
          Avg score: {avgScore.toFixed(2)}
          {runMetrics && runMetrics.totalCostUsd > 0 &&
            ` · Total cost: ${formatCost(runMetrics.totalCostUsd)}`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RunMetricsHeader — sticky top bar
// ---------------------------------------------------------------------------

function RunMetricsHeader({
  runStatus,
  runMetrics,
}: {
  runStatus: RunStatus | null;
  runMetrics: RunMetrics | null;
}) {
  if (!runStatus || runStatus === 'pending') return null;

  const isActive = runStatus === 'running' || runStatus === 'paused';
  const isCompleted = runStatus === 'completed';
  const isFailed = runStatus === 'failed';
  const icon = isActive ? '▸' : isCompleted ? '✓' : isFailed ? '✗' : '■';
  const labelColor = isActive
    ? 'text-accent-primary'
    : isCompleted
      ? 'text-success'
      : isFailed
        ? 'text-error'
        : 'text-warning';
  const label = isActive
    ? 'RUNNING'
    : isCompleted
      ? 'COMPLETED'
      : isFailed
        ? 'FAILED'
        : 'CANCELLED';

  const parts: string[] = [];

  if (runMetrics) {
    if (runMetrics.stepsTotal > 0) {
      parts.push(`${runMetrics.stepsCompleted}/${runMetrics.stepsTotal} steps`);
    }
    if (runMetrics.totalCostUsd > 0) {
      parts.push(formatCost(runMetrics.totalCostUsd));
    }
    if (runMetrics.avgSatisfaction > 0) {
      parts.push(`avg ${runMetrics.avgSatisfaction.toFixed(2)}`);
    }
  }

  return (
    <div className="sticky top-0 z-10 bg-[var(--color-bg-chrome)] border-b border-border-subtle px-3 py-1.5 flex items-center gap-2 font-mono text-xs">
      <span className={cn('shrink-0', labelColor)}>{icon}</span>
      <span className={labelColor}>{label}</span>
      {parts.length > 0 && (
        <>
          <span className="text-text-muted">·</span>
          <span className="text-text-secondary">{parts.join(' · ')}</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ForgeLogView({
  eventLog,
  runStatus,
  runMetrics,
  steps,
  gates,
  questions,
  focusedStepName,
  onStepClick,
}: ForgeLogViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const stepGroupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Track expanded step groups (terminal steps are collapsed by default)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepName: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepName)) {
        next.delete(stepName);
      } else {
        next.add(stepName);
      }
      return next;
    });
  };

  // Group events once per eventLog change
  const groups = useMemo(() => groupEvents(eventLog), [eventLog]);

  // Track scroll position to decide whether to auto-scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 40;
    isAtBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  };

  // Auto-scroll to bottom when new events arrive, if user is at the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eventLog.length]);

  // Scroll to focused step group when focusedStepName changes
  useEffect(() => {
    if (!focusedStepName) return;
    const el = stepGroupRefs.current.get(focusedStepName);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedStepName]);

  // Empty state
  if (eventLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-muted text-xs font-mono">Build log will appear here when a build starts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RunMetricsHeader runStatus={runStatus} runMetrics={runMetrics} />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1"
      >
        {groups.map((group, idx) => {
          if (group.kind === 'run') {
            return (
              <div key={`run-${idx}`} className="flex flex-col gap-0.5">
                {group.events.map((event) => (
                  <EventLine
                    key={event.id}
                    event={event}
                    steps={steps}
                    gates={gates}
                    questions={questions}
                  />
                ))}
              </div>
            );
          }

          // Step group
          const stepState = steps.get(group.stepName);
          const isExpanded = expandedSteps.has(group.stepName);
          const isFocused = focusedStepName === group.stepName;
          const isHookStep = group.stepName.endsWith(':pre') || group.stepName.endsWith(':post');

          // Hook steps (deterministic :pre/:post) render compact and muted
          if (isHookStep) {
            const hookStatus = stepState?.status ?? 'completed';
            const hookIcon = hookStatus === 'completed' ? '⚙' : hookStatus === 'failed' ? '✗' : '·';
            const hookColor = hookStatus === 'failed' ? 'text-error' : 'text-text-muted';
            const lastEvt = group.events[group.events.length - 1];
            const hookTime = lastEvt ? formatTime(lastEvt.timestamp) : '';
            const hookDur = stepState?.durationMs != null ? ` · ${formatDuration(stepState.durationMs)}` : '';
            return (
              <div key={`step-${group.stepName}`} className="flex items-baseline gap-2 font-mono text-[10px] leading-4 text-text-muted pl-4">
                <span className="shrink-0 tabular-nums">{hookTime}</span>
                <span className={hookColor}>{hookIcon}</span>
                <span className={hookColor}>{group.stepName}</span>
                <span>{hookStatus === 'failed' ? 'failed' : 'done'}{hookDur}</span>
              </div>
            );
          }

          return (
            <div
              key={`step-${group.stepName}`}
              ref={(el) => {
                if (el) stepGroupRefs.current.set(group.stepName, el);
                else stepGroupRefs.current.delete(group.stepName);
              }}
              className={cn(
                'rounded transition-all duration-300',
                isFocused && 'ring-1 ring-accent-primary/60',
                onStepClick && 'cursor-pointer',
              )}
              onClick={() => onStepClick?.(group.stepName)}
              role={onStepClick ? 'button' : undefined}
              tabIndex={onStepClick ? 0 : undefined}
              onKeyDown={onStepClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(group.stepName); } : undefined}
            >
              <StepGroupBlock
                group={group}
                step={stepState}
                expanded={isExpanded}
                onToggle={() => toggleStep(group.stepName)}
                steps={steps}
                gates={gates}
                questions={questions}
              />
            </div>
          );
        })}

        <BuildSummary steps={steps} runStatus={runStatus} runMetrics={runMetrics} />

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
