/**
 * Tests for Context UI Components
 *
 * Tests:
 * - ContextTab: renders role tabs dynamically, empty state, adding roles
 * - KeyValueEditor: renders fields, allows editing, adding/deleting fields
 * - AddRolePopover: shows suggested roles, custom input, disables existing roles
 * - RoleContextCard: renders role with icon, editable fields, delete confirmation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, type RenderOptions } from '@testing-library/react';
import { ContextTab } from '../ContextTab';
import { KeyValueEditor } from '../context/KeyValueEditor';
import { AddRolePopover } from '../context/AddRolePopover';
import { RoleContextCard } from '../context/RoleContextCard';
import { ToastProvider } from '@/contexts/ToastContext';
import type { Context } from '@/types';

// Mock the API client
vi.mock('@/api/client', () => ({
  updateContext: vi.fn().mockResolvedValue({}),
}));

// Wrapper that provides required context
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const renderWithProviders = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });

describe('ContextTab', () => {
  const mockContext: Context = {
    designer: {
      library: 'shadcn/ui',
      theme: 'dark',
    },
    architect: {
      tech_stack: 'TypeScript, Express',
    },
  };

  it('renders role tabs dynamically from context keys', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={true}
      />
    );

    // Should have tabs for each role (CSS capitalize shows as uppercase visually but DOM text is lowercase)
    // Use getAllByText since designer appears in both tab and RoleContextCard header
    expect(screen.getAllByText('designer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('architect').length).toBeGreaterThan(0);
  });

  it('shows field count badge for each role tab', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={true}
      />
    );

    // Total field count badge (2 + 1 = 3)
    const totalBadge = screen.getByText('3');
    expect(totalBadge).toBeInTheDocument();
  });

  it('shows roles count text', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={true}
      />
    );

    expect(screen.getByText('2 roles')).toBeInTheDocument();
  });

  it('shows empty state when no context', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={undefined}
        isEditable={true}
      />
    );

    expect(screen.getByText('No context defined yet')).toBeInTheDocument();
    expect(screen.getByText(/Add context to capture formalized decisions/)).toBeInTheDocument();
  });

  it('shows empty state with Add First Role button when editable', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={{}}
        isEditable={true}
      />
    );

    expect(screen.getByText('Add First Role')).toBeInTheDocument();
  });

  it('selects first role by default', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={true}
      />
    );

    // Designer tab should be selected (has different styling)
    // Find the tab by looking for the button containing "designer" span with capitalize class
    const tabs = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('span.capitalize')?.textContent === 'designer'
    );
    expect(tabs[0]).toHaveClass('bg-bg-secondary');
  });

  it('switches tabs when clicking another role', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={true}
      />
    );

    // Find architect tab button
    const tabs = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('span.capitalize')?.textContent === 'architect'
    );
    fireEvent.click(tabs[0]);

    // Architect should now be selected
    expect(tabs[0]).toHaveClass('bg-bg-secondary');
  });

  it('shows + button for adding role when editable', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={true}
      />
    );

    // Should have a + button (title="Add role")
    expect(screen.getByTitle('Add role')).toBeInTheDocument();
  });

  it('hides + button when not editable', () => {
    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={mockContext}
        isEditable={false}
      />
    );

    // Should not have a + button
    expect(screen.queryByTitle('Add role')).not.toBeInTheDocument();
  });

  it('sorts roles in preferred order (designer, architect, modeler, tester, security)', () => {
    const context: Context = {
      security: { auth: 'JWT' },
      tester: { framework: 'Vitest' },
      architect: { tech_stack: 'TypeScript' },
      designer: { library: 'shadcn' },
    };

    renderWithProviders(
      <ContextTab
        planId="plan-1"
        context={context}
        isEditable={true}
      />
    );

    const tabs = screen.getAllByRole('button').filter(btn =>
      ['designer', 'architect', 'tester', 'security'].some(role =>
        btn.textContent?.includes(role)
      )
    );

    // Should be in order: designer, architect, tester, security (CSS capitalize renders visually)
    expect(tabs[0].textContent).toContain('designer');
    expect(tabs[1].textContent).toContain('architect');
    expect(tabs[2].textContent).toContain('tester');
    expect(tabs[3].textContent).toContain('security');
  });
});

describe('KeyValueEditor', () => {
  const mockFields = {
    library: 'shadcn/ui',
    theme: 'dark mode',
  };

  it('renders existing fields', () => {
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={vi.fn()}
        isEditable={true}
      />
    );

    expect(screen.getByDisplayValue('shadcn/ui')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dark mode')).toBeInTheDocument();
  });

  it('shows Add field button when editable', () => {
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={vi.fn()}
        isEditable={true}
      />
    );

    expect(screen.getByText('Add field')).toBeInTheDocument();
  });

  it('hides Add field button when not editable', () => {
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={vi.fn()}
        isEditable={false}
      />
    );

    expect(screen.queryByText('Add field')).not.toBeInTheDocument();
  });

  it('calls onChange when adding a field', () => {
    const handleChange = vi.fn();
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={handleChange}
        isEditable={true}
      />
    );

    fireEvent.click(screen.getByText('Add field'));

    expect(handleChange).toHaveBeenCalledWith({
      ...mockFields,
      '': '',
    });
  });

  it('calls onChange when editing a value', () => {
    const handleChange = vi.fn();
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={handleChange}
        isEditable={true}
      />
    );

    const input = screen.getByDisplayValue('shadcn/ui');
    fireEvent.change(input, { target: { value: 'radix-ui' } });

    expect(handleChange).toHaveBeenCalledWith({
      ...mockFields,
      library: 'radix-ui',
    });
  });

  it('shows empty state when no fields and not editable', () => {
    render(
      <KeyValueEditor
        fields={{}}
        onChange={vi.fn()}
        isEditable={false}
      />
    );

    expect(screen.getByText('No fields defined')).toBeInTheDocument();
  });

  it('renders field hints when provided', () => {
    render(
      <KeyValueEditor
        fields={{ library: 'shadcn/ui' }}
        onChange={vi.fn()}
        isEditable={true}
        fieldHints={{ library: 'Component library to use' }}
      />
    );

    // Field hints are shown as title attributes in the table view
    expect(screen.getByTitle('Component library to use')).toBeInTheDocument();
  });

  it('shows delete button on hover when editable', () => {
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={vi.fn()}
        isEditable={true}
      />
    );

    // Delete buttons exist but may be hidden via opacity
    const deleteButtons = screen.getAllByTitle('Delete field');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('calls onChange without deleted field when delete clicked', () => {
    const handleChange = vi.fn();
    render(
      <KeyValueEditor
        fields={mockFields}
        onChange={handleChange}
        isEditable={true}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete field');
    fireEvent.click(deleteButtons[0]);

    // Should have called with the field removed
    expect(handleChange).toHaveBeenCalled();
    const calledWith = handleChange.mock.calls[0][0];
    expect(Object.keys(calledWith).length).toBe(1);
  });
});

describe('AddRolePopover', () => {
  it('shows popover when trigger clicked', () => {
    render(
      <AddRolePopover
        existingRoles={[]}
        onAddRole={vi.fn()}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));

    expect(screen.getByText('Suggested:')).toBeInTheDocument();
    expect(screen.getByText('Custom role:')).toBeInTheDocument();
  });

  it('shows all suggested roles', () => {
    render(
      <AddRolePopover
        existingRoles={[]}
        onAddRole={vi.fn()}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));

    expect(screen.getByText('Designer')).toBeInTheDocument();
    expect(screen.getByText('Architect')).toBeInTheDocument();
    expect(screen.getByText('Modeler')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('disables existing roles with "(added)" indicator', () => {
    render(
      <AddRolePopover
        existingRoles={['Designer']}
        onAddRole={vi.fn()}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));

    const designerButton = screen.getByText('Designer').closest('button');
    expect(designerButton).toBeDisabled();
    expect(screen.getByText('(added)')).toBeInTheDocument();
  });

  it('calls onAddRole when suggested role clicked', () => {
    const handleAddRole = vi.fn();
    render(
      <AddRolePopover
        existingRoles={[]}
        onAddRole={handleAddRole}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));
    fireEvent.click(screen.getByText('Architect'));

    expect(handleAddRole).toHaveBeenCalledWith('Architect');
  });

  it('has custom role input', () => {
    render(
      <AddRolePopover
        existingRoles={[]}
        onAddRole={vi.fn()}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));

    expect(screen.getByPlaceholderText('Enter role name...')).toBeInTheDocument();
  });

  it('calls onAddRole with custom role when Add button clicked', async () => {
    const handleAddRole = vi.fn();
    render(
      <AddRolePopover
        existingRoles={[]}
        onAddRole={handleAddRole}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));

    const input = screen.getByPlaceholderText('Enter role name...');
    fireEvent.change(input, { target: { value: 'CustomAgent' } });

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(handleAddRole).toHaveBeenCalledWith('CustomAgent');
  });

  it('disables Add button when custom role input is empty', () => {
    render(
      <AddRolePopover
        existingRoles={[]}
        onAddRole={vi.fn()}
        trigger={<button>Add Role</button>}
      />
    );

    fireEvent.click(screen.getByText('Add Role'));

    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeDisabled();
  });
});

describe('RoleContextCard', () => {
  const mockContext = {
    library: 'shadcn/ui',
    theme: 'dark',
  };

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders role name capitalized', () => {
    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('designer')).toBeInTheDocument();
  });

  it('renders context fields', () => {
    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('shadcn/ui')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dark')).toBeInTheDocument();
  });

  it('shows delete button when editable', () => {
    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTitle('Delete designer context')).toBeInTheDocument();
  });

  it('hides delete button when not editable', () => {
    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Delete designer context')).not.toBeInTheDocument();
  });

  it('calls onDelete after confirmation', () => {
    const handleDelete = vi.fn();
    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={handleDelete}
      />
    );

    fireEvent.click(screen.getByTitle('Delete designer context'));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('designer')
    );
    expect(handleDelete).toHaveBeenCalled();
  });

  it('does not call onDelete when confirmation cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const handleDelete = vi.fn();

    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={handleDelete}
      />
    );

    fireEvent.click(screen.getByTitle('Delete designer context'));

    expect(handleDelete).not.toHaveBeenCalled();
  });

  it('shows empty state when context is empty and editable', () => {
    render(
      <RoleContextCard
        role="designer"
        context={{}}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('No fields yet')).toBeInTheDocument();
    // Check for the hint text about adding fields
    expect(screen.getByText(/Click "Add field" below/)).toBeInTheDocument();
  });

  it('shows empty message when context is empty and not editable', () => {
    render(
      <RoleContextCard
        role="designer"
        context={{}}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('No context defined for this role')).toBeInTheDocument();
  });

  it('calls onChange when field is edited', () => {
    const handleChange = vi.fn();
    render(
      <RoleContextCard
        role="designer"
        context={mockContext}
        isEditable={true}
        onChange={handleChange}
        onDelete={vi.fn()}
      />
    );

    const input = screen.getByDisplayValue('shadcn/ui');
    fireEvent.change(input, { target: { value: 'radix-ui' } });

    expect(handleChange).toHaveBeenCalledWith({
      ...mockContext,
      library: 'radix-ui',
    });
  });

  it('renders appropriate icon for known roles', () => {
    const { rerender } = render(
      <RoleContextCard
        role="architect"
        context={{}}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Architect icon should be rendered (we can check for svg)
    expect(screen.getByText('architect').closest('div')?.querySelector('svg')).toBeInTheDocument();

    rerender(
      <RoleContextCard
        role="security"
        context={{}}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('security').closest('div')?.querySelector('svg')).toBeInTheDocument();
  });
});
