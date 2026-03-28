import { describe, it, expect, vi } from 'vitest';
import { render, screen, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleContextCard } from '../RoleContextCard';
import { ToastProvider } from '@/contexts/ToastContext';

// Wrapper that provides required context
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const renderWithProviders = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });

describe('RoleContextCard', () => {
  it('renders role name and icon in header', () => {
    renderWithProviders(
      <RoleContextCard
        role="designer"
        context={{ library: 'shadcn/ui' }}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('designer')).toBeInTheDocument();
  });

  it('renders context fields using KeyValueEditor', () => {
    renderWithProviders(
      <RoleContextCard
        role="architect"
        context={{ tech_stack: 'TypeScript', storage: 'SQLite' }}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // When not editable, keys and values are rendered as text spans
    expect(screen.getByText('tech_stack')).toBeInTheDocument();
    expect(screen.getByText('storage')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('SQLite')).toBeInTheDocument();
  });

  it('shows empty state when context is empty and not editable', () => {
    renderWithProviders(
      <RoleContextCard
        role="tester"
        context={{}}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/No context defined for this role/i)).toBeInTheDocument();
  });

  it('shows "Add field" CTA when context is empty and editable', () => {
    renderWithProviders(
      <RoleContextCard
        role="security"
        context={{}}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/No fields yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Click "Add field" below/i)).toBeInTheDocument();
  });

  it('shows delete button when editable', () => {
    renderWithProviders(
      <RoleContextCard
        role="modeler"
        context={{}}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTitle('Delete modeler context')).toBeInTheDocument();
  });

  it('hides delete button when not editable', () => {
    renderWithProviders(
      <RoleContextCard
        role="modeler"
        context={{}}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Delete modeler context')).not.toBeInTheDocument();
  });

  it('calls onDelete after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(
      <RoleContextCard
        role="designer"
        context={{}}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteButton = screen.getByTitle('Delete designer context');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete the context for role "designer"? This action cannot be undone.'
    );
    expect(onDelete).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it('does not call onDelete when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithProviders(
      <RoleContextCard
        role="designer"
        context={{}}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteButton = screen.getByTitle('Delete designer context');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('passes field hints to KeyValueEditor for known roles', () => {
    renderWithProviders(
      <RoleContextCard
        role="designer"
        context={{ library: '' }}
        isEditable={true}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // KeyValueEditor shows field hints as title attributes on key elements
    const keyElement = screen.getByText('library');
    expect(keyElement).toHaveAttribute('title', 'Component library (e.g., shadcn/ui)');
  });

  it('uses generic SettingsIcon for unknown roles', () => {
    const { container } = renderWithProviders(
      <RoleContextCard
        role="custom_role"
        context={{}}
        isEditable={false}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('custom_role')).toBeInTheDocument();
    // Component should render without crashing for custom roles
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
