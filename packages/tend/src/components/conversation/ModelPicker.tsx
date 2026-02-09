import { useState, useRef, useEffect } from 'react';
import type { ModelId, ModelInfo } from '@/hooks/useChatSettings';

interface ModelPickerProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  models: ModelInfo[];
}

export function ModelPicker({ value, onChange, models }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = models.find(m => m.id === value) ?? models[1]!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 transition-colors"
      >
        <span className="text-[10px] opacity-60">✦</span>
        <span>{current.label}</span>
        <span className="text-[8px] opacity-40">▾</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 py-1 min-w-[160px] rounded-lg border border-border-subtle shadow-lg z-50"
          style={{ backgroundColor: 'var(--color-bg-elevated)' }}
        >
          {models.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between hover:bg-bg-tertiary/50 transition-colors ${
                m.id === value ? 'text-text-primary' : 'text-text-secondary'
              }`}
            >
              <span>{m.label}</span>
              {m.id === value && <span className="text-accent-primary">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
