import { describe, it, expect } from 'vitest';
import {
  OrganizationSchema,
  InitiativeSchema,
  OrgMemberSchema,
  InitiativeStatusSchema,
  OrgMemberRoleSchema,
  InitiativeStatus,
  OrgMemberRole,
  createOrganization,
  createInitiative,
} from './organization.js';

describe('OrganizationSchema', () => {
  it('should validate a valid organization', () => {
    const validOrg = {
      org_id: crypto.randomUUID(),
      name: 'Test Org',
      slug: 'test-org',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = OrganizationSchema.safeParse(validOrg);
    expect(result.success).toBe(true);
  });

  it('should reject organization with invalid UUID', () => {
    const invalidOrg = {
      org_id: 'not-a-uuid',
      name: 'Test Org',
      slug: 'test-org',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = OrganizationSchema.safeParse(invalidOrg);
    expect(result.success).toBe(false);
  });

  it('should reject organization with empty name', () => {
    const invalidOrg = {
      org_id: crypto.randomUUID(),
      name: '',
      slug: 'test-org',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = OrganizationSchema.safeParse(invalidOrg);
    expect(result.success).toBe(false);
  });

  it('should reject organization with invalid slug format', () => {
    const invalidSlugs = ['Test Org', 'TEST-ORG', 'test@org'];

    for (const slug of invalidSlugs) {
      const invalidOrg = {
        org_id: crypto.randomUUID(),
        name: 'Test Org',
        slug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = OrganizationSchema.safeParse(invalidOrg);
      expect(result.success).toBe(false);
    }
  });

  it('should accept valid slug formats', () => {
    const validSlugs = ['test', 'test-org', 'test-org-123', '123-test'];

    for (const slug of validSlugs) {
      const validOrg = {
        org_id: crypto.randomUUID(),
        name: 'Test Org',
        slug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = OrganizationSchema.safeParse(validOrg);
      expect(result.success).toBe(true);
    }
  });
});

describe('InitiativeSchema', () => {
  it('should validate a valid initiative with all fields', () => {
    const validInitiative = {
      initiative_id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: 'Test Initiative',
      description: 'A test initiative',
      status: InitiativeStatus.Active,
      icon: 'rocket',
      color: '#FF5733',
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = InitiativeSchema.safeParse(validInitiative);
    expect(result.success).toBe(true);
  });

  it('should validate a minimal valid initiative', () => {
    const validInitiative = {
      initiative_id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: 'Test Initiative',
      status: InitiativeStatus.Active,
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = InitiativeSchema.safeParse(validInitiative);
    expect(result.success).toBe(true);
  });

  it('should reject initiative with invalid status', () => {
    const invalidInitiative = {
      initiative_id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: 'Test Initiative',
      status: 'invalid-status',
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = InitiativeSchema.safeParse(invalidInitiative);
    expect(result.success).toBe(false);
  });

  it('should accept all valid initiative statuses', () => {
    const statuses = [
      InitiativeStatus.Active,
      InitiativeStatus.Completed,
      InitiativeStatus.Archived,
    ];

    for (const status of statuses) {
      const validInitiative = {
        initiative_id: crypto.randomUUID(),
        org_id: crypto.randomUUID(),
        name: 'Test Initiative',
        status,
        display_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = InitiativeSchema.safeParse(validInitiative);
      expect(result.success).toBe(true);
    }
  });

  it('should reject initiative with negative display_order', () => {
    const invalidInitiative = {
      initiative_id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: 'Test Initiative',
      status: InitiativeStatus.Active,
      display_order: -1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = InitiativeSchema.safeParse(invalidInitiative);
    expect(result.success).toBe(false);
  });

  it('should reject initiative with non-integer display_order', () => {
    const invalidInitiative = {
      initiative_id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: 'Test Initiative',
      status: InitiativeStatus.Active,
      display_order: 1.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = InitiativeSchema.safeParse(invalidInitiative);
    expect(result.success).toBe(false);
  });

  it('should reject initiative with empty name', () => {
    const invalidInitiative = {
      initiative_id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: '',
      status: InitiativeStatus.Active,
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = InitiativeSchema.safeParse(invalidInitiative);
    expect(result.success).toBe(false);
  });
});

describe('OrgMemberSchema', () => {
  it('should validate a valid org member', () => {
    const validMember = {
      org_id: crypto.randomUUID(),
      user_id: 'user-123',
      role: OrgMemberRole.Member,
      created_at: new Date().toISOString(),
    };

    const result = OrgMemberSchema.safeParse(validMember);
    expect(result.success).toBe(true);
  });

  it('should accept all valid org member roles', () => {
    const roles = [OrgMemberRole.Owner, OrgMemberRole.Admin, OrgMemberRole.Member];

    for (const role of roles) {
      const validMember = {
        org_id: crypto.randomUUID(),
        user_id: 'user-123',
        role,
        created_at: new Date().toISOString(),
      };

      const result = OrgMemberSchema.safeParse(validMember);
      expect(result.success).toBe(true);
    }
  });

  it('should reject org member with invalid role', () => {
    const invalidMember = {
      org_id: crypto.randomUUID(),
      user_id: 'user-123',
      role: 'invalid-role',
      created_at: new Date().toISOString(),
    };

    const result = OrgMemberSchema.safeParse(invalidMember);
    expect(result.success).toBe(false);
  });
});

describe('InitiativeStatusSchema', () => {
  it('should accept valid initiative statuses', () => {
    expect(InitiativeStatusSchema.safeParse('active').success).toBe(true);
    expect(InitiativeStatusSchema.safeParse('completed').success).toBe(true);
    expect(InitiativeStatusSchema.safeParse('archived').success).toBe(true);
  });

  it('should reject invalid initiative statuses', () => {
    expect(InitiativeStatusSchema.safeParse('pending').success).toBe(false);
    expect(InitiativeStatusSchema.safeParse('invalid').success).toBe(false);
    expect(InitiativeStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('OrgMemberRoleSchema', () => {
  it('should accept valid org member roles', () => {
    expect(OrgMemberRoleSchema.safeParse('owner').success).toBe(true);
    expect(OrgMemberRoleSchema.safeParse('admin').success).toBe(true);
    expect(OrgMemberRoleSchema.safeParse('member').success).toBe(true);
  });

  it('should reject invalid org member roles', () => {
    expect(OrgMemberRoleSchema.safeParse('superadmin').success).toBe(false);
    expect(OrgMemberRoleSchema.safeParse('guest').success).toBe(false);
    expect(OrgMemberRoleSchema.safeParse('').success).toBe(false);
  });
});

describe('createOrganization', () => {
  it('should create a valid organization', () => {
    const org = createOrganization('Test Org', 'test-org');

    expect(org.name).toBe('Test Org');
    expect(org.slug).toBe('test-org');
    expect(org.org_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(org.created_at).toBeTruthy();
    expect(org.updated_at).toBeTruthy();
    expect(org.created_at).toBe(org.updated_at);
  });

  it('should create unique UUIDs for different organizations', () => {
    const org1 = createOrganization('Org 1', 'org-1');
    const org2 = createOrganization('Org 2', 'org-2');

    expect(org1.org_id).not.toBe(org2.org_id);
  });

  it('should validate created organization against schema', () => {
    const org = createOrganization('Test Org', 'test-org');
    const result = OrganizationSchema.safeParse(org);

    expect(result.success).toBe(true);
  });

  it('should throw validation error for invalid slug', () => {
    expect(() => createOrganization('Test Org', 'INVALID-SLUG')).toThrow();
  });

  it('should throw validation error for empty name', () => {
    expect(() => createOrganization('', 'test-org')).toThrow();
  });

  it('should handle special characters in name', () => {
    const org = createOrganization('Test & Org "Inc."', 'test-org');
    expect(org.name).toBe('Test & Org "Inc."');
  });
});

describe('createInitiative', () => {
  const testOrgId = crypto.randomUUID();

  it('should create a minimal valid initiative', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative');

    expect(initiative.name).toBe('Test Initiative');
    expect(initiative.org_id).toBe(testOrgId);
    expect(initiative.status).toBe(InitiativeStatus.Active);
    expect(initiative.display_order).toBe(0);
    expect(initiative.initiative_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(initiative.created_at).toBeTruthy();
    expect(initiative.updated_at).toBeTruthy();
    expect(initiative.created_at).toBe(initiative.updated_at);
  });

  it('should create initiative with all optional fields', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative', {
      description: 'A test initiative',
      icon: 'rocket',
      color: '#FF5733',
      display_order: 5,
    });

    expect(initiative.description).toBe('A test initiative');
    expect(initiative.icon).toBe('rocket');
    expect(initiative.color).toBe('#FF5733');
    expect(initiative.display_order).toBe(5);
  });

  it('should create initiative with partial options', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative', {
      description: 'Description only',
    });

    expect(initiative.description).toBe('Description only');
    expect(initiative.icon).toBeUndefined();
    expect(initiative.color).toBeUndefined();
    expect(initiative.display_order).toBe(0);
  });

  it('should default to active status', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative');
    expect(initiative.status).toBe(InitiativeStatus.Active);
  });

  it('should default display_order to 0', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative');
    expect(initiative.display_order).toBe(0);
  });

  it('should create unique UUIDs for different initiatives', () => {
    const initiative1 = createInitiative(testOrgId, 'Initiative 1');
    const initiative2 = createInitiative(testOrgId, 'Initiative 2');

    expect(initiative1.initiative_id).not.toBe(initiative2.initiative_id);
  });

  it('should validate created initiative against schema', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative', {
      description: 'Test',
      icon: 'star',
      color: '#FF0000',
      display_order: 3,
    });
    const result = InitiativeSchema.safeParse(initiative);

    expect(result.success).toBe(true);
  });

  it('should throw validation error for empty name', () => {
    expect(() => createInitiative(testOrgId, '')).toThrow();
  });

  it('should throw validation error for negative display_order', () => {
    expect(() =>
      createInitiative(testOrgId, 'Test Initiative', { display_order: -1 })
    ).toThrow();
  });

  it('should preserve undefined vs null for optional fields', () => {
    const initiative = createInitiative(testOrgId, 'Test Initiative');

    expect(initiative.description).toBeUndefined();
    expect(initiative.icon).toBeUndefined();
    expect(initiative.color).toBeUndefined();
  });
});
