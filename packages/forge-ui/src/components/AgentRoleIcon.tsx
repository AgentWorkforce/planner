/**
 * AgentRoleIcon - Icon component for agent roles
 *
 * Maps owner_role to appropriate icon with status-based coloring.
 * Icons:
 * - backend:Coder -> CodeIcon
 * - frontend:Coder -> LayoutIcon
 * - tester -> TestTubeIcon
 * - reviewer -> EyeIcon
 * - auditor -> ShieldIcon
 * - Default -> UserIcon
 */

import { cn } from '@/lib/utils';
import { AgentStatus } from '@/types';

interface AgentRoleIconProps {
  role?: string;
  status?: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const statusColorMap: Record<AgentStatus, string> = {
  [AgentStatus.WORKING]: 'text-cyan-500',
  [AgentStatus.BLOCKED]: 'text-amber-500',
  [AgentStatus.IDLE]: 'text-gray-500',
  [AgentStatus.ERROR]: 'text-red-500',
};

export function AgentRoleIcon({
  role,
  status = AgentStatus.IDLE,
  size = 'md',
  className,
}: AgentRoleIconProps) {
  const sizeClass = sizeMap[size];
  const colorClass = statusColorMap[status];

  // Determine which icon to render based on role
  const normalizedRole = role?.toLowerCase() || '';

  if (normalizedRole.includes('backend') && normalizedRole.includes('coder')) {
    return <CodeIcon className={cn(sizeClass, colorClass, className)} />;
  }

  if (normalizedRole.includes('frontend') && normalizedRole.includes('coder')) {
    return <LayoutIcon className={cn(sizeClass, colorClass, className)} />;
  }

  if (normalizedRole.includes('tester')) {
    return <TestTubeIcon className={cn(sizeClass, colorClass, className)} />;
  }

  if (normalizedRole.includes('reviewer')) {
    return <EyeIcon className={cn(sizeClass, colorClass, className)} />;
  }

  if (normalizedRole.includes('auditor')) {
    return <ShieldIcon className={cn(sizeClass, colorClass, className)} />;
  }

  // Default icon for unknown roles
  return <UserIcon className={cn(sizeClass, colorClass, className)} />;
}

/**
 * Code Icon - For backend coders
 */
function CodeIcon({ className }: { className?: string }) {
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
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

/**
 * Layout Icon - For frontend coders
 */
function LayoutIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

/**
 * TestTube Icon - For testers
 */
function TestTubeIcon({ className }: { className?: string }) {
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
      <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2" />
      <path d="M8.5 2h7" />
      <path d="M14.5 16h-5" />
    </svg>
  );
}

/**
 * Eye Icon - For reviewers
 */
function EyeIcon({ className }: { className?: string }) {
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Shield Icon - For auditors
 */
function ShieldIcon({ className }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/**
 * User Icon - Default for unknown roles
 */
function UserIcon({ className }: { className?: string }) {
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
