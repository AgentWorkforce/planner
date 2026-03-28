import { z } from 'zod';

/**
 * Initiative status lifecycle:
 * - active: currently being worked on
 * - completed: finished
 * - archived: no longer relevant
 */
export const InitiativeStatus = {
  Active: 'active',
  Completed: 'completed',
  Archived: 'archived',
} as const;

export type InitiativeStatus = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];

export const InitiativeStatusSchema = z.enum(['active', 'completed', 'archived']);

/**
 * Organization member roles:
 * - owner: full control, can delete org
 * - admin: can manage members and initiatives
 * - member: can view and participate
 */
export const OrgMemberRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;

export type OrgMemberRole = (typeof OrgMemberRole)[keyof typeof OrgMemberRole];

export const OrgMemberRoleSchema = z.enum(['owner', 'admin', 'member']);

/**
 * Organization is a container for initiatives and members.
 * Provides workspace isolation and access control.
 */
export const OrganizationSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * Initiative represents a strategic goal or project within an organization.
 * Plans are associated with initiatives to provide context and organization.
 */
export const InitiativeSchema = z.object({
  initiative_id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: InitiativeStatusSchema,
  icon: z.string().optional(),
  color: z.string().optional(),
  display_order: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Initiative = z.infer<typeof InitiativeSchema>;

/**
 * OrgMember represents a user's membership in an organization.
 * Defines access control and permissions.
 */
export const OrgMemberSchema = z.object({
  org_id: z.string().uuid(),
  user_id: z.string(),
  role: OrgMemberRoleSchema,
  created_at: z.string().datetime(),
});

export type OrgMember = z.infer<typeof OrgMemberSchema>;

/**
 * Creates a new Organization with generated UUID and timestamps
 */
export function createOrganization(name: string, slug: string): Organization {
  const now = new Date().toISOString();
  const org: Organization = {
    org_id: crypto.randomUUID(),
    name,
    slug,
    created_at: now,
    updated_at: now,
  };
  return OrganizationSchema.parse(org);
}

/**
 * Creates a new Initiative with generated UUID and timestamps
 */
export function createInitiative(
  org_id: string,
  name: string,
  options?: {
    description?: string;
    icon?: string;
    color?: string;
    display_order?: number;
  }
): Initiative {
  const now = new Date().toISOString();
  const initiative: Initiative = {
    initiative_id: crypto.randomUUID(),
    org_id,
    name,
    description: options?.description,
    status: InitiativeStatus.Active,
    icon: options?.icon,
    color: options?.color,
    display_order: options?.display_order ?? 0,
    created_at: now,
    updated_at: now,
  };
  return InitiativeSchema.parse(initiative);
}
