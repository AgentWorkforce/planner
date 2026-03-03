import { useState } from "react";
import { cn } from "../utils/cn";
import { type ForgeConfig, type StepOverride } from "../api/forge";

export interface ForgeConfigStep {
  step_id: string;
  title: string;
  scope?: string;
  owner_role?: string;
}

export interface ForgeConfigPanelProps {
  steps: ForgeConfigStep[];
  onStart: (config: ForgeConfig) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  defaultWorkspacePath?: string;
}

type ModelChoice = 'auto' | 'haiku' | 'sonnet' | 'opus';

interface StepRow {
  step_id: string;
  included: boolean;
  model: ModelChoice;
}

function buildStepRows(steps: ForgeConfigStep[]): StepRow[] {
  return steps.map((s) => ({ step_id: s.step_id, included: true, model: 'auto' }));
}

function assembleConfig(
  rows: StepRow[],
  workspacePath: string,
  budget: string,
  maxConcurrentTasks: string,
  maxConcurrentPerScope: string,
  sequentialInScope: boolean,
): ForgeConfig {
  const step_overrides: StepOverride[] = rows
    .filter((r) => !r.included || r.model !== 'auto')
    .map((r) => {
      const override: StepOverride = { step_id: r.step_id };
      if (!r.included) override.skip = true;
      if (r.model !== 'auto') override.model = r.model;
      return override;
    });

  const totalCost = parseFloat(budget);
  const maxTasks = parseInt(maxConcurrentTasks, 10);
  const maxPerScope = parseInt(maxConcurrentPerScope, 10);

  return {
    workspace_path: workspacePath || undefined,
    step_overrides,
    execution_policy: {
      parallelism: {
        max_concurrent_tasks: isNaN(maxTasks) ? undefined : maxTasks,
        max_concurrent_per_scope: isNaN(maxPerScope) ? undefined : maxPerScope,
        prefer_sequential_in_scope: sequentialInScope,
      },
      budgets: {
        total_cost_limit_usd: isNaN(totalCost) ? undefined : totalCost,
      },
    },
  };
}

const inputClass =
  "w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none text-sm";

const selectClass =
  "px-2 py-1 bg-bg-secondary border border-border-subtle rounded text-sm text-text-primary outline-none focus:border-accent-cyan";

const labelClass = "text-sm font-medium text-text-secondary";

/**
 * ForgeConfigPanel — execution configuration UI for starting a plan build.
 *
 * Not a dialog — consuming apps wrap this in their own container/sheet.
 *
 * Usage:
 *   <ForgeConfigPanel
 *     steps={planSteps}
 *     onStart={async (config) => { await startBuild({ plan_id, ...config }); }}
 *     onCancel={() => setOpen(false)}
 *     defaultWorkspacePath="/Users/me/project"
 *   />
 */
export function ForgeConfigPanel({
  steps,
  onStart,
  onCancel,
  loading = false,
  defaultWorkspacePath = '',
}: ForgeConfigPanelProps) {
  const [rows, setRows] = useState<StepRow[]>(() => buildStepRows(steps));
  const [workspacePath, setWorkspacePath] = useState(defaultWorkspacePath);
  const [budget, setBudget] = useState('10');
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState('3');
  const [maxConcurrentPerScope, setMaxConcurrentPerScope] = useState('2');
  const [sequentialInScope, setSequentialInScope] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isLoading = loading || submitting;

  function toggleIncluded(step_id: string) {
    setRows((prev) =>
      prev.map((r) => (r.step_id === step_id ? { ...r, included: !r.included } : r))
    );
  }

  function setModel(step_id: string, model: ModelChoice) {
    setRows((prev) =>
      prev.map((r) => (r.step_id === step_id ? { ...r, model } : r))
    );
  }

  async function handleStart() {
    setSubmitting(true);
    try {
      const config = assembleConfig(
        rows,
        workspacePath,
        budget,
        maxConcurrentTasks,
        maxConcurrentPerScope,
        sequentialInScope,
      );
      await onStart(config);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Step roster */}
      <div>
        <p className={cn(labelClass, "mb-2")}>Steps</p>
        <div className="rounded-md border border-border-subtle overflow-hidden">
          {rows.map((row, index) => {
            const step = steps[index];
            return (
              <div
                key={row.step_id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  index < rows.length - 1 && "border-b border-border-subtle",
                  !row.included && "opacity-50"
                )}
              >
                {/* Include checkbox */}
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={() => toggleIncluded(row.step_id)}
                  className="shrink-0 accent-[var(--color-accent-cyan)] w-4 h-4 cursor-pointer"
                  aria-label={`Include step: ${step.title}`}
                />

                {/* Title */}
                <span className="flex-1 text-sm text-text-primary truncate">
                  {step.title}
                </span>

                {/* Scope badge */}
                {step.scope && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-bg-tertiary text-text-muted shrink-0">
                    {step.scope}
                  </span>
                )}

                {/* Model selector */}
                <select
                  value={row.model}
                  onChange={(e) => setModel(row.step_id, e.target.value as ModelChoice)}
                  disabled={!row.included}
                  className={cn(selectClass, "shrink-0")}
                  aria-label={`Model for step: ${step.title}`}
                >
                  <option value="auto">Auto</option>
                  <option value="haiku">Haiku</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                </select>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="px-3 py-4 text-sm text-text-muted text-center">
              No steps in this plan.
            </div>
          )}
        </div>
      </div>

      {/* Workspace path */}
      <div>
        <label className={cn(labelClass, "block mb-1.5")}>
          Workspace path
        </label>
        <input
          type="text"
          value={workspacePath}
          onChange={(e) => setWorkspacePath(e.target.value)}
          placeholder="/path/to/workspace"
          className={inputClass}
        />
      </div>

      {/* Budget */}
      <div>
        <label className={cn(labelClass, "block mb-1.5")}>
          Budget ($)
        </label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          min={0}
          step={1}
          className={cn(inputClass, "max-w-[140px]")}
        />
      </div>

      {/* Advanced section */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          aria-expanded={advancedOpen}
        >
          <svg
            className={cn("w-3.5 h-3.5 transition-transform", advancedOpen && "rotate-90")}
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Advanced
        </button>

        {advancedOpen && (
          <div className="mt-3 space-y-4 pl-5 border-l border-border-subtle">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn(labelClass, "block mb-1.5")}>
                  Max concurrent tasks
                </label>
                <input
                  type="number"
                  value={maxConcurrentTasks}
                  onChange={(e) => setMaxConcurrentTasks(e.target.value)}
                  min={1}
                  className={cn(inputClass)}
                />
              </div>

              <div>
                <label className={cn(labelClass, "block mb-1.5")}>
                  Max concurrent per scope
                </label>
                <input
                  type="number"
                  value={maxConcurrentPerScope}
                  onChange={(e) => setMaxConcurrentPerScope(e.target.value)}
                  min={1}
                  className={cn(inputClass)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="sequential-in-scope"
                checked={sequentialInScope}
                onChange={(e) => setSequentialInScope(e.target.checked)}
                className="accent-[var(--color-accent-cyan)] w-4 h-4 cursor-pointer"
              />
              <label htmlFor="sequential-in-scope" className={cn(labelClass, "cursor-pointer")}>
                Sequential within scope
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 bg-bg-tertiary text-text-primary border border-border-subtle rounded-lg hover:border-border-light disabled:opacity-50 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={isLoading || rows.every((r) => !r.included)}
          className="px-4 py-2 bg-accent-cyan text-bg-deep font-medium rounded-lg hover:shadow-glow-cyan disabled:opacity-50 transition-all text-sm"
        >
          {isLoading ? 'Starting…' : 'Start Build'}
        </button>
      </div>
    </div>
  );
}
