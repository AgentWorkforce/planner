/**
 * ArtifactTypeIcon - Icon component for different artifact types
 *
 * Maps artifact types to appropriate icons:
 * - commit -> GitCommitIcon
 * - pr -> GitPullRequestIcon
 * - file -> FileIcon
 * - deployment -> RocketIcon
 * - test_result -> TestTubeIcon
 */

import { cn } from '@/lib/utils';
import type { ArtifactType } from '@/types';

interface ArtifactTypeIconProps {
  type: ArtifactType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

/**
 * Git Commit Icon
 */
function GitCommitIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <line x1="1.05" y1="12" x2="7" y2="12" />
      <line x1="17.01" y1="12" x2="22.96" y2="12" />
    </svg>
  );
}

/**
 * Git Pull Request Icon
 */
function GitPullRequestIcon({ className }: { className?: string }) {
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
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  );
}

/**
 * File Icon
 */
function FileIcon({ className }: { className?: string }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/**
 * Rocket Icon (for deployments)
 */
function RocketIcon({ className }: { className?: string }) {
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
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

/**
 * Test Tube Icon (for test results)
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
      <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2" />
      <path d="M8.5 2h7" />
      <path d="M14.5 16h-5" />
    </svg>
  );
}

/**
 * Map artifact type to icon component
 */
const iconMap: Record<ArtifactType, React.FC<{ className?: string }>> = {
  commit: GitCommitIcon,
  pr: GitPullRequestIcon,
  file: FileIcon,
  deployment: RocketIcon,
  test_result: TestTubeIcon,
};

/**
 * Map artifact type to color class
 */
const colorMap: Record<ArtifactType, string> = {
  commit: 'text-accent-cyan',
  pr: 'text-accent-purple',
  file: 'text-text-secondary',
  deployment: 'text-success',
  test_result: 'text-warning',
};

export function ArtifactTypeIcon({ type, size = 'md', className }: ArtifactTypeIconProps) {
  const IconComponent = iconMap[type] || FileIcon;
  const colorClass = colorMap[type] || 'text-text-secondary';

  return <IconComponent className={cn(sizeMap[size], colorClass, className)} />;
}

/**
 * Get display name for artifact type
 */
export function getArtifactTypeName(type: ArtifactType): string {
  const nameMap: Record<ArtifactType, string> = {
    commit: 'Commits',
    pr: 'Pull Requests',
    file: 'Files',
    deployment: 'Deployments',
    test_result: 'Test Results',
  };
  return nameMap[type] || type;
}

/**
 * Get singular display name for artifact type
 */
export function getArtifactTypeSingular(type: ArtifactType): string {
  const nameMap: Record<ArtifactType, string> = {
    commit: 'Commit',
    pr: 'Pull Request',
    file: 'File',
    deployment: 'Deployment',
    test_result: 'Test Result',
  };
  return nameMap[type] || type;
}
