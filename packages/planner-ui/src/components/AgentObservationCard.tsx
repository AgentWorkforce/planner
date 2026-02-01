import { useState, type ComponentType } from 'react';
import type { AgentObservations } from '@/types';
import { ConfidenceBadge } from './ConfidenceBadge';
import {
  ChevronIcon,
  ArchitectIcon,
  DesignerIcon,
  TesterIcon,
  SecurityIcon,
  BrainIcon,
  AlertIcon,
  ChatQuestionIcon,
  type IconProps,
} from '@/components/icons';

interface AgentObservationCardProps {
  role: string;
  observations: AgentObservations;
  isEditable?: boolean;
  onUpdate?: (observations: AgentObservations) => void;
  defaultExpanded?: boolean;
}

/**
 * Get role icon component based on role name.
 */
function getRoleIcon(role: string): ComponentType<IconProps> {
  const roleLower = role.toLowerCase();
  switch (roleLower) {
    case 'architect':
    case 'architecture':
      return ArchitectIcon;
    case 'designer':
    case 'design':
      return DesignerIcon;
    case 'tester':
    case 'testing':
    case 'qa':
      return TesterIcon;
    case 'security':
      return SecurityIcon;
    default:
      return BrainIcon;
  }
}

/**
 * Get role display name (capitalized).
 */
function getRoleDisplayName(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Get role color classes for accent styling.
 */
function getRoleColorClasses(role: string): { border: string; bg: string; text: string } {
  const roleLower = role.toLowerCase();
  switch (roleLower) {
    case 'architect':
    case 'architecture':
      return { border: 'border-accent-blue', bg: 'bg-accent-blue/10', text: 'text-accent-blue' };
    case 'designer':
    case 'design':
      return { border: 'border-accent-purple', bg: 'bg-accent-purple/10', text: 'text-accent-purple' };
    case 'tester':
    case 'testing':
    case 'qa':
      return { border: 'border-accent-cyan', bg: 'bg-accent-cyan/10', text: 'text-accent-cyan' };
    case 'security':
      return { border: 'border-warning', bg: 'bg-warning/10', text: 'text-warning' };
    default:
      return { border: 'border-text-muted', bg: 'bg-bg-tertiary', text: 'text-text-secondary' };
  }
}

/**
 * Renders a list of items with a prefix icon and title.
 */
function ObservationList({
  title,
  items,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  items?: string[];
  icon?: ComponentType<IconProps>;
  iconClassName?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide flex items-center gap-1.5">
        {Icon && <Icon size="sm" className={iconClassName || 'text-text-muted'} />}
        {title}
      </h4>
      <ul className="space-y-1 pl-4">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-text-secondary list-disc list-outside">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders keywords as inline chips/tags.
 */
function KeywordChips({ keywords }: { keywords?: string[] }) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide">Keywords</h4>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((keyword, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan text-xs rounded-full"
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Card component displaying agent observations during ideation.
 *
 * Shows:
 * - Header: role icon, role name, confidence badge, collapse toggle
 * - Body: observations, keywords (as chips), questions, concerns
 *
 * Collapsible with state persistence.
 */
export function AgentObservationCard({
  role,
  observations,
  isEditable: _isEditable = false,
  onUpdate: _onUpdate,
  defaultExpanded = true,
}: AgentObservationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const RoleIcon = getRoleIcon(role);
  const displayName = getRoleDisplayName(role);
  const colors = getRoleColorClasses(role);

  const hasContent =
    (observations.observations && observations.observations.length > 0) ||
    (observations.keywords && observations.keywords.length > 0) ||
    (observations.questions && observations.questions.length > 0) ||
    (observations.concerns && observations.concerns.length > 0) ||
    (observations.references && observations.references.length > 0);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={`rounded-lg border ${colors.border} border-opacity-30 bg-bg-secondary overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded ${colors.bg}`}>
            <RoleIcon size="md" className={colors.text} />
          </div>
          <span className="font-medium text-text-primary">{displayName}</span>
          {observations.confidence && (
            <ConfidenceBadge confidence={observations.confidence} variant="compact" />
          )}
        </div>
        <ChevronIcon
          size="sm"
          direction="down"
          className={`text-text-muted transition-transform duration-200 ${
            isExpanded ? '' : '-rotate-90'
          }`}
        />
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 space-y-4">
          {!hasContent && (
            <p className="text-sm text-text-muted italic">No observations recorded yet.</p>
          )}

          <ObservationList title="Observations" items={observations.observations} />

          <KeywordChips keywords={observations.keywords} />

          <ObservationList
            title="Questions"
            items={observations.questions}
            icon={ChatQuestionIcon}
            iconClassName="text-accent-cyan"
          />

          <ObservationList
            title="Concerns"
            items={observations.concerns}
            icon={AlertIcon}
            iconClassName="text-warning"
          />

          <ObservationList
            title="References"
            items={observations.references}
          />

          {observations.updated_at && (
            <p className="text-xs text-text-dim pt-2 border-t border-border-default">
              Last updated: {new Date(observations.updated_at).toLocaleDateString()}
              {observations.updated_by && ` by ${observations.updated_by}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
