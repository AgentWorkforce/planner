import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { useCultivatePresets } from '@/hooks/useCultivatePresets';
import { PresetCard } from './PresetCard';

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const STEP_TITLES = ['What are you listening for?', 'Pick your sources', 'Review'] as const;

/**
 * OnboardingWizard — 3-step dialog to create a greenhouse via quick-start.
 *
 * Steps:
 *   1. Name — text input for the greenhouse name
 *   2. Sources — multi-select grid of available presets
 *   3. Review — summary + create button
 */
export function OnboardingWizard({ open, onOpenChange, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { presets, loading: presetsLoading } = useCultivatePresets();

  // Sort presets by authority descending
  const sortedPresets = [...presets].sort(
    (a, b) => b.preset.authority - a.preset.authority
  );

  const togglePreset = useCallback((id: string) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const canAdvance = (): boolean => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return selectedPresetIds.size > 0;
    return true;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/cultivate/greenhouses/quick-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          preset_ids: Array.from(selectedPresetIds),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      // Reset state and close
      resetState();
      onOpenChange(false);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create greenhouse');
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setName('');
    setSelectedPresetIds(new Set());
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const selectedPresets = presets.filter((p) => selectedPresetIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step - 1]}</DialogTitle>
          <DialogDescription>
            Step {step} of 3
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="py-2">
            <label
              htmlFor="greenhouse-name"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Greenhouse name
            </label>
            <input
              id="greenhouse-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Feedback, Product Signals"
              className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canAdvance()) handleNext();
              }}
            />
          </div>
        )}

        {/* Step 2: Sources */}
        {step === 2 && (
          <div className="py-2">
            {presetsLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-12 bg-bg-tertiary rounded-lg" />
                <div className="h-12 bg-bg-tertiary rounded-lg" />
                <div className="h-12 bg-bg-tertiary rounded-lg" />
              </div>
            ) : sortedPresets.length === 0 ? (
              <p className="text-sm text-text-muted py-4">No presets available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
                {sortedPresets.map((entry) => (
                  <PresetCard
                    key={entry.id}
                    preset={entry}
                    selected={selectedPresetIds.has(entry.id)}
                    onToggle={() => togglePreset(entry.id)}
                  />
                ))}
              </div>
            )}
            <p className="text-xs text-text-muted mt-2">
              {selectedPresetIds.size} source{selectedPresetIds.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="py-2 space-y-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Name</p>
              <p className="text-sm text-text-primary font-medium">{name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                Sources ({selectedPresets.length})
              </p>
              <ul className="space-y-1">
                {selectedPresets.map((entry) => (
                  <li key={entry.id} className="text-sm text-text-primary">
                    {entry.preset.name}
                  </li>
                ))}
              </ul>
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={submitting}
            >
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canAdvance()}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
