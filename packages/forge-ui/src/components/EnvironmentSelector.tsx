/**
 * EnvironmentSelector - Dropdown for selecting execution environment
 *
 * Provides options for development, staging, and production with
 * warning indicators for production environment.
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Environment } from '@/types';

interface EnvironmentSelectorProps {
  value: Environment;
  onChange: (env: Environment) => void;
  environments?: Environment[];
  className?: string;
}

const DEFAULT_ENVIRONMENTS: Environment[] = ['development', 'staging', 'production'];

const ENVIRONMENT_CONFIG: Record<
  Environment,
  { label: string; description: string; warning?: boolean }
> = {
  development: {
    label: 'Development',
    description: 'Local testing and iteration',
  },
  staging: {
    label: 'Staging',
    description: 'Pre-production validation',
  },
  production: {
    label: 'Production',
    description: 'Live environment',
    warning: true,
  },
};

/**
 * Chevron Icon
 */
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Alert Icon for production warning
 */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function EnvironmentSelector({
  value,
  onChange,
  environments = DEFAULT_ENVIRONMENTS,
  className,
}: EnvironmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render if only one environment
  if (environments.length <= 1) {
    return null;
  }

  const selectedConfig = ENVIRONMENT_CONFIG[value];
  const isProduction = value === 'production';

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Label */}
      <label className="block text-sm font-medium text-text-secondary mb-1.5">
        Environment
      </label>

      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left',
          'bg-bg-surface transition-colors',
          isProduction
            ? 'border-amber-500/50 hover:border-amber-500'
            : 'border-border-subtle hover:border-border-hover',
          'focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-bg-deep'
        )}
      >
        <div className="flex items-center gap-2">
          {isProduction && <AlertIcon className="h-4 w-4 text-amber-500" />}
          <span className={cn('font-medium', isProduction && 'text-amber-500')}>
            {selectedConfig.label}
          </span>
        </div>
        <ChevronIcon
          className={cn(
            'h-4 w-4 text-text-muted transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Production Warning Badge */}
      {isProduction && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
          <AlertIcon className="h-3 w-3" />
          <span>This will run against the production environment</span>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1 rounded-md border border-border-subtle',
            'bg-bg-surface shadow-lg'
          )}
        >
          {environments.map((env) => {
            const config = ENVIRONMENT_CONFIG[env];
            const isSelected = env === value;
            const isProd = env === 'production';

            return (
              <button
                key={env}
                type="button"
                onClick={() => {
                  onChange(env);
                  setIsOpen(false);
                }}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-bg-hover',
                  isSelected && 'bg-accent-cyan/10',
                  'first:rounded-t-md last:rounded-b-md'
                )}
              >
                {/* Selection Indicator */}
                <div
                  className={cn(
                    'mt-0.5 h-4 w-4 rounded-full border-2',
                    isSelected
                      ? 'border-accent-cyan bg-accent-cyan'
                      : 'border-border-subtle'
                  )}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="h-full w-full text-bg-deep"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                {/* Environment Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-medium',
                        isProd && 'text-amber-500',
                        isSelected && !isProd && 'text-accent-cyan'
                      )}
                    >
                      {config.label}
                    </span>
                    {isProd && <AlertIcon className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <div className="text-sm text-text-muted">{config.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
