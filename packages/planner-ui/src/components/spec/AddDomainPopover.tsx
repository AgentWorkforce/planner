/**
 * AddDomainPopover Component
 *
 * Popover for adding domains to step specification with suggested domains and custom domain input.
 * Opens when clicking a trigger (usually a "+" button).
 *
 * @example
 * ```tsx
 * <AddDomainPopover
 *   existingDomains={['architecture', 'testing']}
 *   onAddDomain={(domain) => console.log('Adding domain:', domain)}
 *   trigger={
 *     <button className="px-2 py-1 text-accent-cyan hover:bg-bg-deep rounded">
 *       + Add Domain
 *     </button>
 *   }
 * />
 * ```
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddDomainPopoverProps {
  /** Domains already added (to disable them in suggestions) */
  existingDomains: string[];
  /** Callback when a domain is selected/added */
  onAddDomain: (domain: string) => void;
  /** The trigger element (usually a "+" button) */
  trigger: React.ReactNode;
}

/**
 * Suggested domains for step specification.
 * These are hints - users can add any custom domain they want.
 */
const SUGGESTED_DOMAINS = [
  'Architecture',
  'Model',
  'Design',
  'Testing',
  'Security',
];

/**
 * Content of the add domain popover.
 */
function AddDomainPopoverContent({
  existingDomains,
  onAddDomain,
  onClose,
}: {
  existingDomains: string[];
  onAddDomain: (domain: string) => void;
  onClose: () => void;
}) {
  const [customDomain, setCustomDomain] = useState('');

  // Normalize for comparison (lowercase)
  const normalizedExisting = existingDomains.map((d) => d.toLowerCase());

  const handleSuggestedDomain = (domain: string) => {
    onAddDomain(domain.toLowerCase());
    onClose();
  };

  const handleCustomDomain = () => {
    const trimmedDomain = customDomain.trim().toLowerCase();
    if (trimmedDomain) {
      onAddDomain(trimmedDomain);
      setCustomDomain('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomDomain();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="w-64 bg-bg-tertiary border border-border-subtle rounded-lg shadow-lg p-3">
      {/* Header */}
      <div className="pb-2 border-b border-border-subtle">
        <span className="text-sm font-medium text-text-primary">Add Domain</span>
      </div>

      {/* Suggested domains */}
      <div className="mt-2 space-y-1">
        <div className="text-xs text-text-muted mb-1">Suggested:</div>
        {SUGGESTED_DOMAINS.map((domain) => {
          const isDisabled = normalizedExisting.includes(domain.toLowerCase());
          return (
            <button
              key={domain}
              onClick={() => !isDisabled && handleSuggestedDomain(domain)}
              disabled={isDisabled}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                isDisabled
                  ? 'text-text-muted cursor-not-allowed opacity-50'
                  : 'text-text-secondary hover:bg-bg-deep hover:text-text-primary cursor-pointer'
              )}
            >
              {domain}
              {isDisabled && <span className="ml-2 text-xs text-text-muted">(added)</span>}
            </button>
          );
        })}
      </div>

      {/* Custom domain input */}
      <div className="mt-3 pt-3 border-t border-border-subtle">
        <div className="text-xs text-text-muted mb-1">Custom domain:</div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter domain name..."
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-8 text-sm"
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCustomDomain}
            disabled={!customDomain.trim()}
            className="h-8 px-3 text-xs"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Full popover with positioning and backdrop.
 * Uses a portal to render at document root, avoiding container clipping issues.
 */
export function AddDomainPopover({
  existingDomains,
  onAddDomain,
  trigger,
}: AddDomainPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const handleClose = () => setIsOpen(false);

  // Calculate position when popover opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // getBoundingClientRect() returns viewport-relative coords
      // position: fixed also uses viewport-relative coords
      // So we use them directly without adding scroll offsets
      setPosition({
        top: rect.bottom + 8, // 8px gap below trigger
        left: rect.left,
      });
    }
  }, [isOpen]);

  return (
    <div className="inline-block" ref={triggerRef}>
      {/* Trigger */}
      <div onClick={() => setIsOpen((prev) => !prev)}>{trigger}</div>

      {/* Popover rendered via portal at document root */}
      {isOpen &&
        createPortal(
          <>
            {/* Backdrop to catch outside clicks */}
            <div className="fixed inset-0 z-40" onClick={handleClose} aria-hidden="true" />

            {/* Popover positioned below the trigger */}
            <div
              className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
              style={{ top: position.top, left: position.left }}
            >
              <AddDomainPopoverContent
                existingDomains={existingDomains}
                onAddDomain={onAddDomain}
                onClose={handleClose}
              />
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
