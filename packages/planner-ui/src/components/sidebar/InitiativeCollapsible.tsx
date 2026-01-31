import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { ChevronRightIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { PlanStatus } from '@/types';

/**
 * Plan summary for nested list display
 */
interface PlanSummary {
  plan_id: string;
  goal: string;
  status: PlanStatus;
}

/**
 * Initiative for sidebar display
 */
interface InitiativeData {
  initiative_id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface InitiativeCollapsibleProps {
  initiative: InitiativeData;
  plans: PlanSummary[];
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

/**
 * InitiativeCollapsible - Collapsible sidebar item for initiatives
 *
 * Features:
 * - Initiative header with color dot, icon, name, and plan count
 * - Chevron indicator that rotates on expand/collapse
 * - Nested list of plan links when expanded
 * - Status dots for each plan (draft=muted, approved=cyan, published=green)
 * - Active state highlighting for both initiative and plans
 * - Smooth transitions for expand/collapse animation
 *
 * Usage:
 * ```tsx
 * <InitiativeCollapsible
 *   initiative={initiative}
 *   plans={plans}
 *   isExpanded={expanded}
 *   onToggleExpanded={() => setExpanded(!expanded)}
 * />
 * ```
 */
export function InitiativeCollapsible({
  initiative,
  plans,
  isExpanded: controlledExpanded,
  onToggleExpanded,
}: InitiativeCollapsibleProps) {
  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledExpanded ?? internalExpanded;
  const setExpanded = onToggleExpanded ?? (() => setInternalExpanded(!internalExpanded));

  const location = useLocation();

  // Check if current initiative or any of its plans is active
  const isInitiativeActive = location.pathname.startsWith(
    `/initiatives/${initiative.initiative_id}`
  );
  const hasActivePlan = plans.some((plan) =>
    location.pathname.startsWith(`/plans/${plan.plan_id}`)
  );
  const isActive = isInitiativeActive || hasActivePlan;

  /**
   * Get status indicator color for plan status
   */
  const getStatusColor = (status: PlanStatus): string => {
    switch (status) {
      case 'draft':
        return 'bg-text-muted';
      case 'approved':
        return 'bg-accent-cyan';
      case 'published':
        return 'bg-accent-green';
      default:
        return 'bg-text-muted';
    }
  };

  /**
   * Check if specific plan is active
   */
  const isPlanActive = (planId: string): boolean => {
    return location.pathname.startsWith(`/plans/${planId}`);
  };

  return (
    <SidebarMenuItem>
      {/* Initiative header - main area navigates, chevron expands */}
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={initiative.name}
        className="group/initiative"
      >
        <Link to={`/initiatives/${initiative.initiative_id}`}>
          {/* Color dot indicator */}
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: initiative.color || '#6b7280' }}
            aria-hidden="true"
          />

          {/* Initiative name */}
          <span className="flex-1 truncate">{initiative.name}</span>

          {/* Plan count badge */}
          {plans.length > 0 && (
            <span className="text-xs text-sidebar-foreground/50 tabular-nums">
              {plans.length}
            </span>
          )}

          {/* Chevron indicator - click to expand/collapse */}
          {plans.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded();
              }}
              className="p-0.5 -mr-1 rounded hover:bg-sidebar-accent transition-colors"
              aria-label={isExpanded ? 'Collapse plans' : 'Expand plans'}
            >
              <ChevronRightIcon
                size="sm"
                className={cn(
                  'shrink-0 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          )}
        </Link>
      </SidebarMenuButton>

      {/* Nested plans list - shown when expanded */}
      {isExpanded && plans.length > 0 && (
        <SidebarMenuSub>
          {plans.map((plan) => (
            <SidebarMenuSubItem key={plan.plan_id}>
              <SidebarMenuSubButton
                asChild
                isActive={isPlanActive(plan.plan_id)}
              >
                <Link to={`/plans/${plan.plan_id}`}>
                  {/* Status dot */}
                  <div
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      getStatusColor(plan.status)
                    )}
                    aria-label={`Status: ${plan.status}`}
                  />
                  {/* Plan title */}
                  <span className="truncate">{plan.goal}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
