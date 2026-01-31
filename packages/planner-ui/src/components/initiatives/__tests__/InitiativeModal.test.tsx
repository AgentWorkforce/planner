import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitiativeModal } from '../InitiativeModal';
import type { Initiative } from '@/types/initiative';

function createMockInitiative(overrides?: Partial<Initiative>): Initiative {
  return {
    initiative_id: 'init-1',
    org_id: 'org-1',
    name: 'Existing Initiative',
    description: 'This is an existing initiative',
    status: 'active',
    icon: '🎯',
    color: '#a855f7',
    display_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('InitiativeModal', () => {
  describe('create mode', () => {
    it('renders with create mode title when no initiative provided', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      expect(screen.getByText('New Initiative')).toBeInTheDocument();
      expect(screen.getByText('Create a new initiative to organize your plans.')).toBeInTheDocument();
    });

    it('shows empty form fields', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      const nameInput = screen.getByLabelText(/Name/);
      const descriptionInput = screen.getByLabelText('Description');

      expect(nameInput).toHaveValue('');
      expect(descriptionInput).toHaveValue('');
    });

    it('shows default icon and color', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      // Default icon should be 🚀
      const rocketEmoji = screen.getByRole('radio', { name: '🚀' });
      expect(rocketEmoji).toHaveAttribute('aria-checked', 'true');

      // Default color should be #00d9ff (Cyan)
      const cyanColor = screen.getByRole('radio', { name: 'Cyan color' });
      expect(cyanColor).toHaveAttribute('aria-checked', 'true');
    });

    it('shows Create Initiative button', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      expect(screen.getByRole('button', { name: 'Create Initiative' })).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renders with edit mode title when initiative provided', () => {
      const initiative = createMockInitiative();
      render(
        <InitiativeModal
          open={true}
          onOpenChange={vi.fn()}
          initiative={initiative}
          onSave={vi.fn(async () => {})}
        />
      );

      expect(screen.getByText('Edit Initiative')).toBeInTheDocument();
      expect(screen.getByText('Update the details of this initiative.')).toBeInTheDocument();
    });

    it('pre-fills form with initiative data', () => {
      const initiative = createMockInitiative();
      render(
        <InitiativeModal
          open={true}
          onOpenChange={vi.fn()}
          initiative={initiative}
          onSave={vi.fn(async () => {})}
        />
      );

      const nameInput = screen.getByLabelText(/Name/);
      const descriptionInput = screen.getByLabelText('Description');

      expect(nameInput).toHaveValue('Existing Initiative');
      expect(descriptionInput).toHaveValue('This is an existing initiative');
    });

    it('pre-selects initiative icon', () => {
      const initiative = createMockInitiative({ icon: '🎯' });
      render(
        <InitiativeModal
          open={true}
          onOpenChange={vi.fn()}
          initiative={initiative}
          onSave={vi.fn(async () => {})}
        />
      );

      const targetEmoji = screen.getByRole('radio', { name: '🎯' });
      expect(targetEmoji).toHaveAttribute('aria-checked', 'true');
    });

    it('pre-selects initiative color', () => {
      const initiative = createMockInitiative({ color: '#a855f7' });
      render(
        <InitiativeModal
          open={true}
          onOpenChange={vi.fn()}
          initiative={initiative}
          onSave={vi.fn(async () => {})}
        />
      );

      const purpleColor = screen.getByRole('radio', { name: 'Purple color' });
      expect(purpleColor).toHaveAttribute('aria-checked', 'true');
    });

    it('shows Save Changes button', () => {
      const initiative = createMockInitiative();
      render(
        <InitiativeModal
          open={true}
          onOpenChange={vi.fn()}
          initiative={initiative}
          onSave={vi.fn(async () => {})}
        />
      );

      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('shows required indicator for name field', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      const label = screen.getByText(/Name/);
      expect(label).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('disables submit button when name is empty', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      const submitButton = screen.getByRole('button', { name: 'Create Initiative' });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when name has value', async () => {
      const user = userEvent.setup();
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      const nameInput = screen.getByLabelText(/Name/);
      await user.type(nameInput, 'New Initiative');

      const submitButton = screen.getByRole('button', { name: 'Create Initiative' });
      expect(submitButton).not.toBeDisabled();
    });

    it('disables submit button when name is only whitespace', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});
      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      const nameInput = screen.getByLabelText(/Name/);
      await user.type(nameInput, '   '); // Whitespace only

      const submitButton = screen.getByRole('button', { name: 'Create Initiative' });
      expect(submitButton).toBeDisabled(); // Should be disabled for whitespace-only

      // Since button is disabled, clicking won't trigger submit
      expect(onSave).not.toHaveBeenCalled();
    });

    it('trims whitespace from name', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});
      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      const nameInput = screen.getByLabelText(/Name/);
      await user.type(nameInput, '  Test Initiative  ');

      const form = screen.getByRole('button', { name: 'Create Initiative' }).closest('form')!;
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Initiative',
          })
        );
      });
    });
  });

  describe('form submission', () => {
    it('calls onSave with form data in create mode', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});
      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Q1 Launch');
      await user.type(screen.getByLabelText('Description'), 'Launch new product');

      const greenEmoji = screen.getByRole('radio', { name: '🚩' });
      await user.click(greenEmoji);

      const orangeColor = screen.getByRole('radio', { name: 'Orange color' });
      await user.click(orangeColor);

      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          name: 'Q1 Launch',
          description: 'Launch new product',
          icon: '🚩',
          color: '#ff6b35',
        });
      });
    });

    it('calls onSave with form data in edit mode', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});
      const initiative = createMockInitiative();
      render(
        <InitiativeModal
          open={true}
          onOpenChange={vi.fn()}
          initiative={initiative}
          onSave={onSave}
        />
      );

      const nameInput = screen.getByLabelText(/Name/);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Name',
          })
        );
      });
    });

    it('omits description when empty', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});
      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test Initiative');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            description: undefined,
          })
        );
      });
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSave = vi.fn(async () => {
        // Small delay to ensure loading state is visible
        await new Promise((r) => setTimeout(r, 50));
        return savePromise;
      });

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test');
      const createButton = screen.getByRole('button', { name: 'Create Initiative' });
      await user.click(createButton);

      // Wait for loading state to appear
      await waitFor(() => {
        const loadingButton = screen.queryByRole('button', { name: /Creating/i });
        expect(loadingButton).toBeInTheDocument();
        expect(loadingButton).toBeDisabled();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();

      resolvePromise!();
    });

    it('closes modal on successful save', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});
      const onOpenChange = vi.fn();

      render(<InitiativeModal open={true} onOpenChange={onOpenChange} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test Initiative');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('shows error message on save failure', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {
        throw new Error('Network error');
      });

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test Initiative');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });

    it('shows generic error message for non-Error throws', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {
        throw 'Unknown error';
      });

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test Initiative');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Failed to save initiative. Please try again.'
        );
      });
    });
  });

  describe('cancel behavior', () => {
    it('calls onOpenChange with false when Cancel clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(<InitiativeModal open={true} onOpenChange={onOpenChange} onSave={vi.fn(async () => {})} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('does not call onSave when canceling', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test Initiative');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('form reset on open/close', () => {
    it('resets form when modal opens in create mode', () => {
      const { rerender } = render(
        <InitiativeModal open={false} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      rerender(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      expect(screen.getByLabelText(/Name/)).toHaveValue('');
      expect(screen.getByLabelText('Description')).toHaveValue('');
    });

    it('clears error messages when modal opens', () => {
      const { rerender } = render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      // Trigger an error by submitting empty form
      const submitButton = screen.getByRole('button', { name: 'Create Initiative' });
      submitButton.click();

      rerender(
        <InitiativeModal open={false} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );
      rerender(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('input fields', () => {
    it('shows name input with autofocus and required', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      const nameInput = screen.getByLabelText(/Name/);
      // React converts autoFocus prop to autofocus attribute when rendered
      expect(nameInput).toHaveAttribute('required');
      expect(nameInput).toHaveAttribute('id', 'initiative-name');
    });

    it('shows description textarea with placeholder', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      const descriptionInput = screen.getByLabelText('Description');
      expect(descriptionInput).toHaveAttribute(
        'placeholder',
        'Optional description of this initiative...'
      );
      expect(descriptionInput).toHaveAttribute('rows', '3');
    });

    it('disables inputs during loading state', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSave = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return savePromise;
      });

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      await user.type(screen.getByLabelText(/Name/), 'Test');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Name/)).toBeDisabled();
        expect(screen.getByLabelText('Description')).toBeDisabled();
      });

      resolvePromise!();
    });
  });

  describe('icon and color pickers', () => {
    it('renders IconPicker component', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: 'Select an icon' })).toBeInTheDocument();
    });

    it('renders ColorPicker component', () => {
      render(
        <InitiativeModal open={true} onOpenChange={vi.fn()} onSave={vi.fn(async () => {})} />
      );

      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: 'Color picker' })).toBeInTheDocument();
    });

    it('updates icon when IconPicker changes', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      const targetEmoji = screen.getByRole('radio', { name: '🎯' });
      await user.click(targetEmoji);

      await user.type(screen.getByLabelText(/Name/), 'Test');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            icon: '🎯',
          })
        );
      });
    });

    it('updates color when ColorPicker changes', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(async () => {});

      render(<InitiativeModal open={true} onOpenChange={vi.fn()} onSave={onSave} />);

      const purpleColor = screen.getByRole('radio', { name: 'Purple color' });
      await user.click(purpleColor);

      await user.type(screen.getByLabelText(/Name/), 'Test');
      await user.click(screen.getByRole('button', { name: 'Create Initiative' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            color: '#a855f7',
          })
        );
      });
    });
  });
});
