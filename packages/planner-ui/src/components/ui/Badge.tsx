import { HTMLAttributes } from 'react';

export type BadgeVariant =
  | 'default'
  | 'draft'
  | 'approved'
  | 'published'
  | 'submitted'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

interface BadgeProps extends HTMLAttributes<HTMLElement> {
  variant?: BadgeVariant;
  /** For clickable badges */
  as?: 'span' | 'button';
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-tertiary text-text-secondary',
  draft: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  published: 'bg-accent-cyan/10 text-accent-cyan',
  submitted: 'bg-accent-purple/10 text-accent-purple',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-accent-cyan/10 text-accent-cyan',
};

export function Badge({
  variant = 'default',
  as = 'span',
  className = '',
  children,
  ...props
}: BadgeProps) {
  const baseClasses =
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide';

  const Component = as;

  return (
    <Component
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
