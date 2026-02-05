import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownEditor } from '../MarkdownEditor';

describe('MarkdownEditor', () => {
  it('renders with initial value', () => {
    render(
      <MarkdownEditor
        value="# Hello World"
        onChange={vi.fn()}
      />
    );

    // Should start in preview mode by default
    expect(screen.getByText(/Hello World/i)).toBeInTheDocument();
  });

  it('toggles between edit and preview modes', async () => {
    const user = userEvent.setup();
    render(
      <MarkdownEditor
        value="# Hello World"
        onChange={vi.fn()}
      />
    );

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit markdown/i });
    await user.click(editButton);

    // Should show textarea in edit mode
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('# Hello World');

    // Click preview button
    const previewButton = screen.getByRole('button', { name: /preview markdown/i });
    await user.click(previewButton);

    // Should show rendered markdown
    expect(screen.getByText(/Hello World/i)).toBeInTheDocument();
  });

  it('calls onChange with userEdited flag when content is modified', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <MarkdownEditor
        value="Original content"
        onChange={handleChange}
        defaultEditMode={true}
      />
    );

    const textarea = screen.getByRole('textbox');

    // Clear and type new content
    await user.clear(textarea);
    await user.type(textarea, 'Modified content');

    // Blur to trigger save
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('Modified content', true);
    });
  });

  it('renders markdown in preview mode', () => {
    const markdown = `
# Heading
**Bold text**
- List item 1
- List item 2
    `.trim();

    render(
      <MarkdownEditor
        value={markdown}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('Bold text')).toBeInTheDocument();
    expect(screen.getByText('List item 1')).toBeInTheDocument();
  });

  it('shows placeholder when empty', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        placeholder="Enter your content here..."
      />
    );

    expect(screen.getByText('Enter your content here...')).toBeInTheDocument();
  });

  it('auto-saves on blur in edit mode', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <MarkdownEditor
        value="Original"
        onChange={handleChange}
        defaultEditMode={true}
      />
    );

    const textarea = screen.getByRole('textbox');

    // Modify content
    await user.type(textarea, ' content');

    // Blur should trigger save
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('Original content', true);
    });
  });
});
